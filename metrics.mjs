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
let metricsCache = { expiresAt: 0, data: null };

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
  const value = { id: path.basename(file, ".jsonl"), cwd: "", title: "", startedAt: "", updatedAt: "", status: "unknown", tokenUsage: null, lastUsage: null, turns: 0, toolCalls: 0, toolNames: {}, skills: {} };
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
      if (payload.type === "task_started") value.status = "active";
      if (payload.type === "task_complete") value.status = "completed";
      if (payload.type === "user_message") value.turns += 1;
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

// Capture changed lines and recent commits from the current local repository.
async function loadLocalGitMetrics(username) {
  const runGit = async (args) => { try { return (await execFileAsync("git", ["-C", projectRoot, ...args], { maxBuffer: 4 * 1024 * 1024 })).stdout; } catch { return ""; } };
  const remote = (await runGit(["remote", "get-url", "origin"])).trim();
  const identity = (await runGit(["config", "user.email"])).trim() || (await runGit(["config", "user.name"])).trim();
  const diff = await runGit(["diff", "--numstat", "HEAD"]);
  const log = await runGit(["log", "-30", "--author", identity || username, "--numstat", "--format=commit%x09%h%x09%ad%x09%s", "--date=short"]);
  const parseLines = (text) => text.split("\n").reduce((result, line) => { const match = line.trim().match(/^(\d+)\s+(\d+)\s+/); if (match) { result.additions += Number(match[1]); result.deletions += Number(match[2]); result.files += 1; } return result; }, { additions: 0, deletions: 0, files: 0 });
  const commits = log.split("\n").filter((line) => line.startsWith("commit\t")).map((line) => { const [, sha, date, message] = line.split("\t"); return { sha, date, message }; });
  return { repository: remote || projectRoot, identity, workingTree: parseLines(diff), commitCount: commits.length, commits, history: parseLines(log) };
}

// Build the complete development dashboard payload with a short cache for refreshes.
export async function loadDevelopmentMetrics() {
  if (metricsCache.data && metricsCache.expiresAt > Date.now()) return metricsCache.data;
  const username = process.env.GITHUB_USERNAME || "jcyjessie";
  const files = [...await listSessionFiles(path.join(codexRoot, "sessions")), ...await listSessionFiles(path.join(codexRoot, "archived_sessions"))];
  const sessions = (await Promise.all(files.map(parseSession))).filter(Boolean);
  const now = Date.now();
  const recentSessions = sessions.filter((session) => now - new Date(session.updatedAt || 0).getTime() < 7 * 24 * 60 * 60 * 1000);
  const daily = {};
  const skills = {};
  const tools = {};
  let turns = 0;
  let toolCalls = 0;
  for (const session of sessions) {
    const day = (session.updatedAt || session.startedAt || "").slice(0, 10);
    if (day) daily[day] = (daily[day] || 0) + 1;
    turns += session.turns;
    toolCalls += session.toolCalls;
    for (const [name, count] of Object.entries(session.skills)) skills[name] = (skills[name] || 0) + count;
    for (const [name, count] of Object.entries(session.toolNames)) tools[name] = (tools[name] || 0) + count;
  }
  const [githubResult, local] = await Promise.allSettled([loadGithubMetrics(username), loadLocalGitMetrics(username)]);
  const github = githubResult.status === "fulfilled" ? githubResult.value : { state: "error", username, detail: githubResult.reason?.message || "GitHub 暂不可用" };
  const localGit = local.status === "fulfilled" ? local.value : { repository: projectRoot, workingTree: { additions: 0, deletions: 0, files: 0 }, commitCount: 0, commits: [], history: { additions: 0, deletions: 0, files: 0 } };
  const data = { fetchedAt: new Date().toISOString(), codex: { state: "ready", source: "本机 Codex 会话记录", sessionCount: sessions.length, recentSessionCount: recentSessions.length, activeSessionCount: sessions.filter((session) => session.status === "active").length, turns, toolCalls, tokenUsage: sumTokenUsage(sessions), recentTokenUsage: sumTokenUsage(recentSessions), daily, skills: Object.entries(skills).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 12), tools: Object.entries(tools).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 12), quota: { state: "unavailable", detail: "Codex CLI 本地记录不包含账户额度或账单数据" } }, github, localGit };
  metricsCache = { data, expiresAt: Date.now() + 30 * 1000 };
  return data;
}
