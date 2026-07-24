// Development analytics: aggregate local Codex session records and public GitHub activity without exposing private content.
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const projectRoot = path.dirname(new URL(import.meta.url).pathname);
const codexRoot = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const sessionCache = new Map();
const metricsCache = new Map();

// Turn the first user message into a compact, readable conversation title.
function summarizeConversationTitle(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 96);
}

// Recursively find Codex session records without reading authentication files.
async function listSessionFiles(directory) {
  const result = [];
  let entries = [];
  try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return result; }
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await listSessionFiles(target));
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) result.push(target);
  }
  return result;
}

// Extract only aggregate fields from one JSONL session, never returning prompts or tool arguments.
async function parseSession(file) {
  let stats;
  try { stats = await fs.stat(file); } catch { return null; }
  const cacheKey = `${stats.mtimeMs}:${stats.size}`;
  const cached = sessionCache.get(file);
  if (cached?.cacheKey === cacheKey) return cached.value;
  const value = { id: path.basename(file, ".jsonl"), cwd: "", model: "Unknown", startedAt: "", updatedAt: "", status: "unknown", tokenUsage: null, lastUsage: null, turns: 0, toolCalls: 0, toolNames: {}, skills: {} };
  try {
    const input = readline.createInterface({ input: createReadStream(file), crlfDelay: Infinity });
    for await (const line of input) {
      if (!line) continue;
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      value.updatedAt = event.timestamp || value.updatedAt;
      const payload = event.payload || {};
      if (event.type === "session_meta") {
        value.id = payload.session_id || payload.id || value.id;
        value.cwd = payload.cwd || value.cwd;
        value.startedAt = payload.timestamp || event.timestamp || value.startedAt;
      }
      if (payload.type === "thread_settings_applied" && payload.thread_settings?.model) value.model = payload.thread_settings.model;
      if (payload.type === "task_started") value.status = "active";
      if (payload.type === "task_complete") value.status = "completed";
      if (payload.type === "user_message") {
        value.turns += 1;
        if (!value.title) value.title = summarizeConversationTitle(payload.message);
      }
      if (payload.type === "token_count" && payload.info?.total_token_usage) {
        value.tokenUsage = payload.info.total_token_usage;
        value.lastUsage = payload.info.last_token_usage || null;
      }
      if (payload.type === "custom_tool_call" || payload.type === "function_call") {
        value.toolCalls += 1;
        const name = payload.name || "tool";
        value.toolNames[name] = (value.toolNames[name] || 0) + 1;
        const inputText = typeof payload.input === "string" ? payload.input : typeof payload.arguments === "string" ? payload.arguments : "";
        for (const match of inputText.matchAll(/([A-Za-z0-9][A-Za-z0-9._-]{2,})[/]SKILL\.md\b/gi)) {
          const skill = match[1];
          if (skill && skill.toUpperCase() !== "SKILL") value.skills[skill] = (value.skills[skill] || 0) + 1;
        }
      }
    }
  } catch { return null; }
  sessionCache.set(file, { cacheKey, value });
  return value;
}

// Sum final cumulative token counts so repeated token events do not inflate totals.
function sumTokenUsage(sessions) {
  return sessions.reduce((total, session) => {
    const usage = session.tokenUsage || {};
    for (const key of ["input_tokens", "cached_input_tokens", "cache_write_input_tokens", "output_tokens", "reasoning_output_tokens", "total_tokens"]) total[key] = (total[key] || 0) + Number(usage[key] || 0);
    return total;
  }, {});
}

// Return privacy-safe summaries for every local Codex session, ordered by recent activity.
export async function loadCodexSessionSummaries() {
  const files = [...await listSessionFiles(path.join(codexRoot, "sessions")), ...await listSessionFiles(path.join(codexRoot, "archived_sessions"))];
  const sessions = (await Promise.all(files.map(parseSession))).filter(Boolean);
  return sessions
    .map(({ id, cwd, title, model, status, startedAt, updatedAt }) => ({ id, cwd, title, model, status, startedAt, updatedAt }))
    .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0));
}

// Read recent public GitHub events and commit statistics for the configured account.
async function loadGithubMetrics(username) {
  const headers = { "user-agent": "jessboard-development-metrics/0.1", accept: "application/vnd.github+json" };
  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100`, { headers });
  if (!response.ok) throw new Error(`GitHub 公共活动 HTTP ${response.status}`);
  const events = await response.json();
  const counts = {};
  const commits = [];
  const pushEvents = [];
  for (const event of Array.isArray(events) ? events : []) {
    counts[event.type] = (counts[event.type] || 0) + 1;
    if (event.type === "PushEvent") {
      pushEvents.push(event);
      for (const commit of event.payload?.commits || []) commits.push({ repo: event.repo?.name, sha: commit.sha, message: commit.message });
    }
  }
  // Public user events omit commit arrays, so resolve recent push ranges through GitHub Compare.
  const compareResults = await Promise.allSettled(pushEvents.slice(0, 16).map(async (event) => {
    const before = event.payload?.before;
    const head = event.payload?.head;
    if (!event.repo?.name || !before || !head || /^0+$/.test(before)) return [];
    const compareResponse = await fetch(`https://api.github.com/repos/${event.repo.name}/compare/${before}...${head}`, { headers });
    if (!compareResponse.ok) return [];
    const compare = await compareResponse.json();
    return (compare.commits || []).map((commit) => ({ repo: event.repo.name, sha: commit.sha, message: commit.commit?.message || "未命名提交" }));
  }));
  compareResults.forEach((result) => { if (result.status === "fulfilled") commits.push(...result.value); });
  const uniqueCommits = [...new Map(commits.filter((entry) => entry.repo && entry.sha).map((entry) => [`${entry.repo}:${entry.sha}`, entry])).values()].slice(0, 24);
  const details = await Promise.allSettled(uniqueCommits.map(async (commit) => {
    const detailResponse = await fetch(`https://api.github.com/repos/${commit.repo}/commits/${commit.sha}`, { headers });
    if (!detailResponse.ok) return null;
    const detail = await detailResponse.json();
    return { repo: commit.repo, sha: commit.sha, message: commit.message, additions: Number(detail.stats?.additions || 0), deletions: Number(detail.stats?.deletions || 0), files: Array.isArray(detail.files) ? detail.files.length : 0, url: detail.html_url };
  }));
  const commitStats = details.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
  return { state: "ready", username, fetchedAt: new Date().toISOString(), eventCount: events.length, eventTypes: counts, commitCount: uniqueCommits.length, additions: commitStats.reduce((sum, entry) => sum + entry.additions, 0), deletions: commitStats.reduce((sum, entry) => sum + entry.deletions, 0), files: commitStats.reduce((sum, entry) => sum + entry.files, 0), commits: commitStats.slice(0, 8) };
}

// Capture this user's recent commits across checked-out repositories in the local source folder.
async function loadLocalGitMetrics(username) {
  const runGit = async (directory, args) => { try { return (await execFileAsync("git", ["-C", directory, ...args], { maxBuffer: 4 * 1024 * 1024 })).stdout; } catch { return ""; } };
  const parseLines = (text) => text.split("\n").reduce((result, line) => { const match = line.trim().match(/^(\d+)\s+(\d+)\s+/); if (match) { result.additions += Number(match[1]); result.deletions += Number(match[2]); result.files += 1; } return result; }, { additions: 0, deletions: 0, files: 0 });
  const sourceRoot = path.dirname(projectRoot);
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true });
  const folders = [...new Set([projectRoot, ...entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(sourceRoot, entry.name))])];
  const records = await Promise.all(folders.map(async (directory) => {
    try { await fs.access(path.join(directory, ".git")); } catch { return null; }
    const identity = (await runGit(directory, ["config", "user.email"])).trim() || (await runGit(directory, ["config", "user.name"])).trim() || username;
    const log = await runGit(directory, ["log", "--all", "-30", "--author", identity, "--numstat", "--format=commit%x09%h%x09%ad%x09%s", "--date=short"]);
    const commits = log.split("\n").filter((line) => line.startsWith("commit\t")).map((line) => { const [, sha, date, message] = line.split("\t"); return { repo: path.basename(directory), sha, date, message }; });
    return { commits, history: parseLines(log) };
  }));
  const valid = records.filter(Boolean);
  const commits = valid.flatMap((record) => record.commits).sort((left, right) => String(right.date).localeCompare(String(left.date))).slice(0, 30);
  const history = valid.reduce((total, record) => ({ additions: total.additions + record.history.additions, deletions: total.deletions + record.history.deletions, files: total.files + record.history.files }), { additions: 0, deletions: 0, files: 0 });
  const diff = await runGit(projectRoot, ["diff", "--numstat", "HEAD"]);
  return { repository: `${valid.length} local repositories`, identity: username, repositoryCount: valid.length, workingTree: parseLines(diff), commitCount: commits.length, commits, history };
}

// Convert a dashboard range into a millisecond cutoff or no limit.
function rangeCutoff(range, now) { return { "24h": now - 24 * 60 * 60 * 1000, "7d": now - 7 * 24 * 60 * 60 * 1000, "30d": now - 30 * 24 * 60 * 60 * 1000 }[range] || 0; }

// Build the complete development dashboard payload with a short cache for refreshes.
export async function loadDevelopmentMetrics(range = "all") {
  const cached = metricsCache.get(range);
  if (cached?.data && cached.expiresAt > Date.now()) return cached.data;
  const username = process.env.GITHUB_USERNAME || "jcyjessie";
  const files = [...await listSessionFiles(path.join(codexRoot, "sessions")), ...await listSessionFiles(path.join(codexRoot, "archived_sessions"))];
  const sessions = (await Promise.all(files.map(parseSession))).filter(Boolean);
  const now = Date.now();
  const cutoff = rangeCutoff(range, now);
  const scopedSessions = cutoff ? sessions.filter((session) => new Date(session.updatedAt || session.startedAt || 0).getTime() >= cutoff) : sessions;
  const daily = {};
  const skills = {};
  const tools = {};
  let turns = 0;
  let toolCalls = 0;
  for (const session of scopedSessions) {
    const day = (session.updatedAt || session.startedAt || "").slice(0, 10);
    if (day) daily[day] = (daily[day] || 0) + 1;
    turns += session.turns;
    toolCalls += session.toolCalls;
    for (const [name, count] of Object.entries(session.skills)) skills[name] = (skills[name] || 0) + count;
    for (const [name, count] of Object.entries(session.toolNames)) tools[name] = (tools[name] || 0) + count;
  }
  const models = Object.entries(scopedSessions.reduce((result, session) => {
    const model = session.model || "Unknown";
    const current = result[model] || { count: 0, tokens: 0 };
    current.count += 1;
    current.tokens += Number(session.tokenUsage?.total_tokens || 0);
    result[model] = current;
    return result;
  }, {})).map(([name, value]) => ({ name, ...value })).sort((left, right) => right.tokens - left.tokens);
  const highestTokenSessions = scopedSessions.map((session) => ({ id: session.id, title: session.title || "Untitled conversation", workspace: path.basename(session.cwd || "") || "Unknown workspace", model: session.model || "Unknown", updatedAt: session.updatedAt, tokens: Number(session.tokenUsage?.total_tokens || 0) })).filter((session) => session.tokens > 0).sort((left, right) => right.tokens - left.tokens).slice(0, 5);
  const [githubResult, local] = await Promise.allSettled([loadGithubMetrics(username), loadLocalGitMetrics(username)]);
  const localGit = local.status === "fulfilled" ? local.value : { repository: projectRoot, repositoryCount: 0, workingTree: { additions: 0, deletions: 0, files: 0 }, commitCount: 0, commits: [], history: { additions: 0, deletions: 0, files: 0 } };
  const github = githubResult.status === "fulfilled" ? githubResult.value : { state: "fallback", username, detail: "GitHub public API rate-limited; showing local repository history.", commitCount: localGit.commitCount, additions: localGit.history.additions, deletions: localGit.history.deletions, commits: localGit.commits };
  const weekSessions = sessions.filter((session) => now - new Date(session.updatedAt || session.startedAt || 0).getTime() < 7 * 24 * 60 * 60 * 1000);
  const overview = { allTokens: sumTokenUsage(sessions).total_tokens, weekTokens: sumTokenUsage(weekSessions).total_tokens, allSessions: sessions.length, activeSessions: sessions.filter((session) => session.status === "active").length };
  const data = { fetchedAt: new Date().toISOString(), range, overview, codex: { state: "ready", source: "本机 Codex 会话记录", sessionCount: scopedSessions.length, activeSessionCount: scopedSessions.filter((session) => session.status === "active").length, turns, toolCalls, tokenUsage: sumTokenUsage(scopedSessions), daily, models, highestTokenSessions, skills: Object.entries(skills).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 12), tools: Object.entries(tools).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 12), quota: { state: "unavailable", detail: "Codex CLI 本地记录不包含账户额度或账单数据" } }, github, localGit };
  metricsCache.set(range, { data, expiresAt: Date.now() + 30 * 1000 });
  return data;
}
