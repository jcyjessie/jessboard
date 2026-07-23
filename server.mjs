// Jessboard local service serves the static workbench and safely aggregates public news feeds.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import { loadDevelopmentMetrics } from "./metrics.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const userAgent = "jessboard-news/0.2.0 (+https://github.com/jcyjessie/jessboard)";
const followBuildersBase = "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/";
const translationCache = new Map();
const ollamaCache = new Map();
let worldMonitorDetail = "本地 RSS · 原文";
let weatherCache = { expiresAt: 0, data: null };
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", trimValues: true });

// Return JSON with consistent headers for the browser client.
function sendJson(response, status, payload) { response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); response.end(JSON.stringify(payload)); }

// Fetch JSON with a short timeout and an explicit source identity.
async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 15000);
  try {
    const result = await fetch(url, { ...options, signal: controller.signal, headers: { "user-agent": userAgent, ...(options.headers || {}) } });
    if (!result.ok) throw new Error(`HTTP ${result.status}`);
    return await result.json();
  } finally { clearTimeout(timeout); }
}

// Fetch an RSS or Atom document with the same timeout and source identity as JSON feeds.
async function fetchXml(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 15000);
  try {
    const result = await fetch(url, { ...options, signal: controller.signal, headers: { "user-agent": userAgent, accept: "application/rss+xml, application/atom+xml, text/xml, */*", ...(options.headers || {}) } });
    if (!result.ok) throw new Error(`HTTP ${result.status}`);
    return await result.text();
  } finally { clearTimeout(timeout); }
}

// Normalize provider output into the small card format used by the UI.
function item({ source, sourceLabel, title, summary, originalTitle, originalSummary, url, publishedAt, author, attribution }) { return { id: `${source}-${url || title}-${publishedAt || ""}`, source, sourceLabel, title, summary, originalTitle: originalTitle || title, originalSummary: originalSummary || summary, url, publishedAt, author, attribution }; }

// Run a local Codex translation request over public news text only.
function runCodexTranslation(prompt) {
  const binary = process.env.CODEX_BIN || "codex";
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ["exec", "--ephemeral", "--json", "--sandbox", "read-only", "--skip-git-repo-check", "-C", root], { cwd: root, env: process.env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("翻译超时")); }, 90000);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => { clearTimeout(timeout); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(stderr.trim() || `Codex 翻译退出码 ${code}`));
      const messages = stdout.split("\n").map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean).filter((event) => event.item?.type === "agent_message").map((event) => event.item.text).join("\n");
      if (!messages) return reject(new Error("Codex 没有返回译文"));
      resolve(messages);
    });
    child.stdin.end(prompt);
  });
}

// Parse a JSON array even when the model wraps it in a markdown code fence.
function parseTranslation(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const arrayStart = text.indexOf("[");
  const arrayEnd = text.lastIndexOf("]");
  const candidate = fenced ? fenced[1] : arrayStart >= 0 && arrayEnd > arrayStart ? text.slice(arrayStart, arrayEnd + 1) : text.trim();
  const parsed = JSON.parse(candidate);
  return Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : parsed.id ? [parsed] : [];
}

// Translate non-Chinese provider items and cache the result for this server run.
async function translateItems(items) {
  if (process.env.NEWS_TRANSLATE === "off" || !items.length) return { items, translated: false, detail: "原文" };
  const pending = items.filter((entry) => !translationCache.has(entry.id));
  let translatedCount = 0;
  let lastError = "";
  for (let index = 0; index < pending.length; index += 10) {
    const batch = pending.slice(index, index + 10);
    const prompt = `你是资讯编辑。请把下面公开资讯翻译成简体中文。保留每个 id、URL、人名、公司名、产品名和技术词；只返回 JSON 数组，每项包含 id、title、summary，不要 Markdown，不要解释。中文要自然、简洁，适合资讯卡片。\n\n${JSON.stringify(batch.map((entry) => ({ id: entry.id, title: entry.title, summary: entry.summary, url: entry.url })))}`;
    try {
      parseTranslation(await runCodexTranslation(prompt)).forEach((entry) => { if (entry.id) { translationCache.set(entry.id, { title: entry.title, summary: entry.summary }); translatedCount += 1; } });
    } catch (error) { lastError = error.message; }
  }
  const translatedItems = items.map((entry) => ({ ...entry, ...(translationCache.get(entry.id) || {}) }));
  if (!translatedCount) return { items: translatedItems, translated: false, detail: `原文 · ${lastError || "翻译未返回"}` };
  return { items: translatedItems, translated: true, detail: translatedCount < pending.length ? `中文 · ${translatedCount}/${pending.length}` : "中文" };
}

// Read the public AI HOT API using its required non-browser identity.
async function loadAihot() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await fetchJson("https://aihot.virxact.com/api/public/version", { headers: { "user-agent": "aihot-skill/0.3.6 (+https://aihot.virxact.com/aihot-skill/)" }, timeout: 10000 });
  const payload = await fetchJson(`https://aihot.virxact.com/api/public/items?mode=selected&since=${encodeURIComponent(since)}&take=30`, { headers: { "user-agent": "aihot-skill/0.3.6 (+https://aihot.virxact.com/aihot-skill/)" }, timeout: 20000 });
  const rows = Array.isArray(payload) ? payload : payload.items || [];
  return rows.map((entry) => item({ source: "aihot", sourceLabel: "AI HOT", title: entry.title || entry.title_en, originalTitle: entry.title_en || entry.title, summary: entry.summary || "暂无摘要", originalSummary: entry.summary_en || entry.summary, url: entry.permalink || entry.url, publishedAt: entry.publishedAt, author: entry.source || "AI HOT", attribution: payload.attribution?.canonical || "AI HOT" }));
}

// Read the central Follow Builders feeds without asking for private social credentials.
async function loadBuilders() {
  const [blogs, x] = await Promise.all([fetchJson(`${followBuildersBase}feed-blogs.json`), fetchJson(`${followBuildersBase}feed-x.json`)]);
  const blogItems = (blogs.blogs || []).map((entry) => item({ source: "builders", sourceLabel: "Follow Builders", title: entry.title, summary: entry.description || entry.content?.slice(0, 280) || "暂无摘要", url: entry.url, publishedAt: entry.publishedAt, author: entry.name, attribution: "Follow Builders" }));
  const xItems = (x.x || []).flatMap((builder) => (builder.tweets || []).map((tweet) => {
    const cleanText = cleanSocialText(tweet.text);
    if (!isMeaningfulSocialText(cleanText)) return null;
    return item({ source: "builders", sourceLabel: "Follow Builders", title: `${builder.name}：${cleanText.slice(0, 100)}`, summary: cleanText || "这是一条 Builder 动态。", url: tweet.url, publishedAt: tweet.createdAt, author: `@${builder.handle}`, attribution: "Follow Builders" });
  }).filter(Boolean));
  return [...blogItems, ...xItems].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)).slice(0, 30);
}

// Remove tracking links and repeated whitespace from social posts before editing.
function cleanSocialText(value) { return String(value || "").replace(/https?:\/\/\S+/gi, "").replace(/\bwww\.\S+/gi, "").replace(/\s+/g, " ").trim(); }

// Exclude posts that contain no usable context beyond a short reaction or link.
function isMeaningfulSocialText(value) { const compact = value.replace(/[\s\p{P}\p{S}]/gu, ""); return compact.length >= 8; }

// Convert RSS and Atom documents into the normalized Jessboard item shape.
function parseFeed(xml, feed) {
  const document = xmlParser.parse(xml);
  const rssItems = document.rss?.channel?.item;
  const atomEntries = document.feed?.entry;
  const rows = Array.isArray(rssItems) ? rssItems : rssItems ? [rssItems] : Array.isArray(atomEntries) ? atomEntries : atomEntries ? [atomEntries] : [];
  return rows.map((entry) => {
    const linkValue = Array.isArray(entry.link) ? entry.link[0] : entry.link;
    const link = typeof linkValue === "object" ? linkValue?.["@_href"] : linkValue;
    const title = cleanFeedText(entry.title);
    const summary = cleanFeedText(entry.description || entry.summary || entry.content || "暂无摘要");
    const publishedAt = entry.pubDate || entry.published || entry.updated;
    const author = cleanFeedText(entry.author?.name || entry.author || entry.creator || feed.name);
    if (!title || !link) return null;
    return item({ source: "worldmonitor", sourceLabel: "World Monitor Local", title, summary: summary.slice(0, 500), url: link, publishedAt, author, attribution: feed.name });
  }).filter(Boolean);
}

// Remove feed markup and entities before displaying or summarizing a story.
function cleanFeedText(value) {
  const text = typeof value === "object" ? value?.["#text"] || "" : String(value || "");
  return text.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
}

// Ask the local Ollama service for compact Chinese headline and summary text.
async function summarizeWithOllama(items) {
  const model = process.env.OLLAMA_MODEL || "qwen3:0.6b";
  if (process.env.NEWS_TRANSLATE === "off" || !items.length) return { items, translated: false, detail: "原文" };
  const pending = items.filter((entry) => !ollamaCache.has(entry.id)).slice(0, 1);
  if (pending.length) {
    const prompt = `你是中文报纸编辑。请把下面公开 RSS 资讯改写成简体中文，保留 id、URL、人名、公司名和技术词。只返回一个 JSON 对象，包含 id、title、summary。标题不超过 32 字，摘要不超过 80 字，不要 Markdown，不要解释。\n\n${JSON.stringify(pending[0])}`;
    try {
      const response = await fetchJson(`${process.env.OLLAMA_API_URL || "http://127.0.0.1:11434"}/api/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, prompt, stream: false, format: "json", think: false }), timeout: 120000 });
      const parsed = parseTranslation(response.response || "[]");
      parsed.forEach((entry) => { if (entry.id && entry.title) ollamaCache.set(entry.id, { title: entry.title, summary: entry.summary || "暂无摘要" }); });
      const first = parsed[0];
      if (first?.title && !ollamaCache.has(pending[0].id)) ollamaCache.set(pending[0].id, { title: first.title, summary: first.summary || "暂无摘要" });
      if (!first?.title) return { items, translated: false, detail: "原文 · Ollama 返回格式无法匹配" };
    } catch (error) {
      return { items, translated: false, detail: `原文 · Ollama 未连接 (${error.message})` };
    }
  }
  return { items: items.map((entry) => ({ ...entry, ...(ollamaCache.get(entry.id) || {}) })), translated: true, detail: `中文 · Ollama ${model}（头条优先）` };
}

// Load a curated, public subset of the official World Monitor feed catalog locally.
async function loadWorldMonitorLocal() {
  const feeds = JSON.parse(await fs.readFile(path.join(root, "data", "worldmonitor-feeds.json"), "utf8"));
  const results = await Promise.allSettled(feeds.map(async (feed) => parseFeed(await fetchXml(feed.url, { timeout: 12000 }), feed)));
  const entries = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const seen = new Set();
  const deduped = entries.filter((entry) => { const key = entry.url || entry.title; if (seen.has(key)) return false; seen.add(key); return true; });
  const translated = await summarizeWithOllama(deduped.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)).slice(0, 40));
  worldMonitorDetail = translated.detail;
  return translated.items;
}

// Read World Monitor's read-only news tool through its public MCP endpoint.
async function loadWorldMonitorHosted() {
  const apiKey = process.env.WORLD_MONITOR_API_KEY;
  if (!apiKey) throw new Error("未配置 API Key；World Monitor MCP 的 tools/call 需要 WORLD_MONITOR_API_KEY");
  const payload = await fetchJson("https://worldmonitor.app/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "x-worldmonitor-key": apiKey }, body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: "get_news_intelligence", arguments: { limit: 20 } } }), timeout: 30000 });
  const structured = payload.result?.structuredContent || payload.result?.data;
  const textContent = payload.result?.content?.find((entry) => entry.type === "text")?.text;
  const data = structured || (textContent ? JSON.parse(textContent) : payload.result || payload);
  const rows = data.data?.insights?.topStories || data.insights?.topStories || data.topStories || [];
  return rows.map((entry) => item({ source: "worldmonitor", sourceLabel: "World Monitor", title: entry.primaryTitle || entry.title, summary: `${entry.primarySource || "World Monitor"} · ${entry.category || "general"}${entry.sourceCount ? ` · ${entry.sourceCount} 个信源` : ""}`, url: entry.primaryLink || entry.url, publishedAt: entry.pubDate || entry.publishedAt, author: entry.primarySource || "World Monitor", attribution: "World Monitor" }));
}

// Select local RSS aggregation by default; hosted MCP remains an explicit opt-in.
async function loadWorldMonitor() {
  return process.env.WORLD_MONITOR_MODE === "hosted" ? loadWorldMonitorHosted() : loadWorldMonitorLocal();
}

// Read current Shanghai weather and cache it briefly to keep manual refreshes lightweight.
async function loadShanghaiWeather() {
  if (weatherCache.data && weatherCache.expiresAt > Date.now()) return weatherCache.data;
  const payload = await fetchJson("https://api.open-meteo.com/v1/forecast?latitude=31.2304&longitude=121.4737&current=temperature_2m,relative_humidity_2m,weather_code&timezone=Asia%2FShanghai", { timeout: 10000 });
  const current = payload.current || {};
  const data = { city: "上海", temperature: current.temperature_2m, humidity: current.relative_humidity_2m, weatherCode: current.weather_code, observedAt: current.time };
  weatherCache = { data, expiresAt: Date.now() + 10 * 60 * 1000 };
  return data;
}

// Run the three providers independently so one failure never hides the others.
async function loadNews() {
  const providers = {};
  const results = await Promise.allSettled([loadAihot(), loadBuilders(), loadWorldMonitor()]);
  const names = ["aihot", "builders", "worldmonitor"];
  const items = [];
  results.forEach((result, index) => { const name = names[index]; if (result.status === "fulfilled") { providers[name] = { state: "ready", detail: `${result.value.length} 条` }; items.push(...result.value); } else { providers[name] = { state: "error", detail: result.reason?.message || "暂不可用" }; } });
  const [builderTranslation, worldTranslation] = await Promise.all([
    translateItems(items.filter((entry) => entry.source === "builders")),
    translateItems(items.filter((entry) => entry.source === "worldmonitor"))
  ]);
  const translatedById = new Map([...builderTranslation.items, ...worldTranslation.items].map((entry) => [entry.id, entry]));
  items.splice(0, items.length, ...items.map((entry) => translatedById.get(entry.id) || entry));
  if (providers.builders?.state === "ready") providers.builders.detail = `${providers.builders.detail} · ${builderTranslation.detail}`;
  if (providers.worldmonitor?.state === "ready") providers.worldmonitor.detail = `${providers.worldmonitor.detail} · ${worldMonitorDetail} · ${worldTranslation.detail}`;
  items.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  return { fetchedAt: new Date().toISOString(), providers, items };
}

// Read the local context snapshot written by the sync command.
async function loadContext() { try { return JSON.parse(await fs.readFile(path.join(root, "data", "context.json"), "utf8")); } catch { return { codex: [], feishu: { tasks: [], schedule: [], notes: [], messages: [] }, sources: { codex: "empty", feishu: "not-configured" } }; } }

// Serve a requested static file from the repository without allowing path traversal.
async function serveStatic(requestPath, response) {
  const pathname = requestPath === "/" ? "/index.html" : requestPath;
  const target = path.resolve(root, `.${pathname}`);
  if (!target.startsWith(root)) return sendJson(response, 403, { error: "Forbidden" });
  try {
    const content = await fs.readFile(target);
    const ext = path.extname(target).toLowerCase();
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };
    response.writeHead(200, { "content-type": types[ext] || "application/octet-stream" }); response.end(content);
  } catch { sendJson(response, 404, { error: "Not found" }); }
}

// Route API requests and static files for the local workbench.
const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (request.method === "GET" && requestUrl.pathname === "/api/news") { try { sendJson(response, 200, await loadNews()); } catch (error) { sendJson(response, 502, { error: error.message }); } return; }
  if (request.method === "GET" && requestUrl.pathname === "/api/weather/shanghai") { try { sendJson(response, 200, await loadShanghaiWeather()); } catch (error) { sendJson(response, 502, { error: `上海天气暂不可用：${error.message}` }); } return; }
  if (request.method === "GET" && requestUrl.pathname === "/api/context") { sendJson(response, 200, await loadContext()); return; }
  if (request.method === "GET" && requestUrl.pathname === "/api/dev-metrics") { try { sendJson(response, 200, await loadDevelopmentMetrics()); } catch (error) { sendJson(response, 502, { error: `开发数据暂不可用：${error.message}` }); } return; }
  if (request.method === "GET" && requestUrl.pathname === "/api/health") { sendJson(response, 200, { ok: true, service: "jessboard" }); return; }
  if (request.method === "GET") { await serveStatic(requestUrl.pathname, response); return; }
  sendJson(response, 405, { error: "Method not allowed" });
});

server.listen(port, "127.0.0.1", () => console.log(`Jessboard running at http://127.0.0.1:${port}`));
