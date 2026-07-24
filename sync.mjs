// Jessboard syncs safe Feishu Project task and workflow data into the local context snapshot.
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { loadCodexSessionSummaries } from "./metrics.mjs";

const runFile = promisify(execFile);
const root = process.cwd();
const target = path.join(root, "data", "context.json");
const configPath = path.join(root, "sync.config.json");
const emptyFeishu = { tasks: [], todoTasks: [], inferredTasks: [], schedule: [], notes: [], messages: [] };
const defaultActionability = {
  personalKeywords: ["曹逸婕", "Jessie", "@Jessie"],
  businessKeywords: ["实时&EOD", "实时和EOD", "实时", "EOD", "end of day", "real-time", "realtime", "行情", "市场数据", "图表", "K线", "K线图", "kline", "candlestick", "OHLC", "ticker", "报价", "NAV", "PnL", "shadow NAV", "基金净值", "Open API", "fund", "基金", "portfolio", "投资组合", "资产组合", "ta", "技术分析", "capital movement", "capital movements", "资金流动", "资金变动", "资金划转", "report", "报告", "multiple portfolio report", "多组合报告", "多投资组合报告", "live risk", "实时风险", "risk table", "风险表", "风险表格", "risk indicator", "风险指标", "monitor", "monitoring", "监控", "监测", "table view", "表格视图", "表视图", "graph view", "图表视图", "图形视图", "time series data", "时间序列数据", "时序数据", "mobile version", "移动端", "移动版", "home page", "homepage", "首页", "widget", "小组件", "组件", "auto ta", "自动技术分析"],
  actionKeywords: ["待办", "todo", "action item", "跟进", "处理", "确认", "补充", "完成", "评审", "查看", "回复", "安排", "测试", "发布", "更新", "负责", "review", "follow up", "confirm", "deliver", "prepare"]
};

// Read a JSON file and fall back when it has not been created yet.
async function readJson(filePath, fallback) {
  try { return JSON.parse(await fs.readFile(filePath, "utf8")); }
  catch { return fallback; }
}

// Keep user-configurable sync limits within practical local bounds.
function boundedNumber(value, fallback, minimum, maximum) {
  return Math.min(Math.max(Number(value) || fallback, minimum), maximum);
}

// Load and validate the non-secret Feishu Project sync settings.
async function loadSyncConfig() {
  const config = await readJson(configPath, {});
  const project = config.feishuProject || {};
  const lark = config.lark || {};
  if (!project.sourceDirectory) throw new Error("sync.config.json must set feishuProject.sourceDirectory.");
  return {
    sourceDirectory: path.resolve(root, project.sourceDirectory),
    taskTypeKey: project.taskTypeKey || "sub_task",
    taskPageSize: boundedNumber(project.taskPageSize, 50, 1, 50),
    scheduleItemLimit: boundedNumber(project.scheduleItemLimit, 50, 0, 50),
    lark: {
      calendarDays: boundedNumber(lark.calendarDays, 7, 1, 31),
      documentLimit: boundedNumber(lark.documentLimit, 100, 1, 100),
      messageDays: boundedNumber(lark.messageDays, 7, 1, 31),
      messageLimit: boundedNumber(lark.messageLimit, 100, 1, 100),
      actionability: {
        personalKeywords: Array.isArray(lark.actionability?.personalKeywords) ? lark.actionability.personalKeywords : defaultActionability.personalKeywords,
        businessKeywords: Array.isArray(lark.actionability?.businessKeywords) ? lark.actionability.businessKeywords : defaultActionability.businessKeywords,
        actionKeywords: Array.isArray(lark.actionability?.actionKeywords) ? lark.actionability.actionKeywords : defaultActionability.actionKeywords
      }
    }
  };
}

// Run the reference project's read-only Feishu Project helper and parse its JSON output.
async function fetchProjectData(config, args) {
  const python = path.join(config.sourceDirectory, ".venv", "bin", "python");
  const script = path.join(config.sourceDirectory, "scripts", "feishu_project_client.py");
  try { await fs.access(python); await fs.access(script); }
  catch { throw new Error("The configured Feishu Project source is missing its local Python helper."); }
  const { stdout } = await runFile(python, [script, ...args], { cwd: config.sourceDirectory, maxBuffer: 4 * 1024 * 1024 });
  try { return JSON.parse(stdout); }
  catch { throw new Error("The Feishu Project helper returned unreadable data."); }
}

// Locate the globally installed Lark CLI without storing a machine-specific path.
async function resolveLarkCli() {
  if (process.env.LARK_CLI_PATH) return process.env.LARK_CLI_PATH;
  const { stdout } = await runFile("npm", ["prefix", "-g"]);
  const executable = path.join(stdout.trim(), "bin", "lark-cli");
  try { await fs.access(executable); return executable; }
  catch { throw new Error("Lark CLI was not found. Set LARK_CLI_PATH or install it globally."); }
}

// Run a Lark CLI read request and return its documented JSON envelope.
async function fetchLarkData(args) {
  const executable = await resolveLarkCli();
  try {
    const { stdout } = await runFile(executable, [...args, "--json"], { maxBuffer: 4 * 1024 * 1024 });
    const response = JSON.parse(stdout);
    if (!response.ok) throw new Error(response.error?.message || "Lark CLI returned an unsuccessful response.");
    return response.data;
  } catch (error) {
    const detail = String(error.stderr || error.message || error).trim();
    try {
      const response = JSON.parse(detail);
      throw new Error(response.error?.message || detail);
    } catch (parseError) {
      if (parseError instanceof SyntaxError) throw new Error(detail || "Lark CLI request failed.");
      throw parseError;
    }
  }
}

// Produce an ISO date string for the current Shanghai calendar day.
function shanghaiDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

// Add a number of calendar days to an ISO date string.
function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Reduce text for the local snapshot without retaining full message or document content.
function summarizeText(value, limit = 280) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

// Convert a Lark calendar event into the normalized schedule shape.
function normalizeCalendarEvent(event) {
  return {
    id: `lark-calendar-${event.event_id}`,
    title: event.summary || "Untitled calendar event",
    start: event.start_time?.datetime || null,
    end: event.end_time?.datetime || null,
    availability: event.free_busy_status || null,
    link: event.app_link || null,
    source: "lark-calendar"
  };
}

// Convert Lark document search metadata into a compact local note record.
function normalizeDocument(result) {
  const meta = result.result_meta || {};
  return {
    id: `lark-doc-${meta.token || meta.url || result.title_highlighted}`,
    title: summarizeText(result.title_highlighted, 160) || "Untitled document",
    type: result.entity_type || "DOC",
    updatedAt: meta.update_time_iso || null,
    openedAt: meta.last_open_time_iso || null,
    owner: meta.owner_name || null,
    link: meta.url || null,
    source: "lark-docs"
  };
}

// Convert a recent Lark message into a bounded preview for the local snapshot.
function normalizeMessage(message) {
  return {
    id: `lark-message-${message.message_id}`,
    chat: message.chat_name || (message.chat_type === "p2p" ? "Direct message" : "Untitled chat"),
    sender: message.sender?.name || "Unknown sender",
    preview: summarizeText(message.content),
    createdAt: message.create_time || null,
    type: message.msg_type || null,
    link: message.message_app_link || null,
    source: "lark-im"
  };
}

// Match configured keywords without interpreting them as regular expressions.
function includesAnyKeyword(value, keywords) {
  const text = String(value || "").toLocaleLowerCase("zh-CN");
  return keywords.some((keyword) => {
    const normalized = String(keyword || "").trim().toLocaleLowerCase("zh-CN");
    if (!normalized) return false;
    if (/^[a-z0-9][a-z0-9 .&-]*$/i.test(normalized)) {
      const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(text);
    }
    return text.includes(normalized);
  });
}

// Require a request, assignment, or explicit ToDo marker before suggesting work.
function hasExplicitActionCue(value, actionKeywords) {
  const escaped = actionKeywords.map((keyword) => String(keyword || "").trim()).filter(Boolean).map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return false;
  const action = `(?:${escaped.join("|")})`;
  const text = String(value || "");
  return /(?:待办|todo|action items?|负责人|owner)/i.test(text)
    || new RegExp(`(?:请|麻烦|需要|请你|麻烦你|能否|帮忙|please|need to|需(?=${action})).{0,24}?${action}`, "i").test(text)
    || new RegExp(`${action}.{0,16}?(?:给|由|请|@|Jessie|曹逸婕)`, "i").test(text);
}

// Convert explicit, scoped message or meeting action cues into reviewable suggested ToDos.
function inferActionTasks(notes, messages, actionability) {
  const personalKeywords = actionability.personalKeywords.filter(Boolean);
  const businessKeywords = actionability.businessKeywords.filter(Boolean);
  const actionKeywords = actionability.actionKeywords.filter(Boolean);
  const records = [...notes.map((note) => ({ ...note, text: note.title, origin: "会议纪要" })), ...messages.map((message) => ({ ...message, text: `${message.chat} ${message.preview}`, origin: "飞书消息" }))];
  return records.filter((record) => {
    const isRelevant = includesAnyKeyword(record.text, personalKeywords) || includesAnyKeyword(record.text, businessKeywords);
    return isRelevant && hasExplicitActionCue(record.text, actionKeywords);
  }).slice(0, 20).map((record) => ({
    id: `inferred-${record.id}`,
    title: summarizeText(record.text, 120),
    project: record.origin,
    status: "todo",
    dueAt: null,
    updatedAt: record.updatedAt || record.createdAt || null,
    link: record.link || null,
    source: "lark-inferred",
    suggested: true
  }));
}

// Convert an assigned Feishu Task into the common read-only work item shape.
function normalizeTodoTask(task) {
  return {
    id: `lark-task-${task.guid}`,
    title: summarizeText(task.summary, 220) || "Untitled Feishu Task",
    project: "Feishu Task",
    status: task.completed ? "done" : "todo",
    dueAt: task.due_at || null,
    updatedAt: task.updated_at || task.created_at || null,
    createdAt: task.created_at || null,
    link: task.url || null,
    source: "lark-task",
    assignedToMe: true
  };
}

// Remove duplicate records by ID while retaining their first display order.
function uniqueById(records) {
  const seen = new Set();
  return records.filter((record) => record?.id && !seen.has(record.id) && seen.add(record.id));
}

// Read bounded calendar, document, and message summaries from the authorized Lark user account.
async function syncLark(config) {
  const today = shanghaiDate();
  const results = await Promise.allSettled([
    fetchLarkData(["calendar", "+agenda", "--as", "user", "--start", `${today}T00:00:00+08:00`, "--end", `${addDays(today, config.lark.calendarDays)}T23:59:59+08:00`]),
    fetchDocuments(config.lark.documentLimit),
    fetchLarkData(["im", "+messages-search", "--as", "user", "--start", `${addDays(today, -config.lark.messageDays)}T00:00:00+08:00`, "--end", `${today}T23:59:59+08:00`, "--page-size", String(Math.min(config.lark.messageLimit, 50)), "--page-all", "--page-limit", String(Math.ceil(config.lark.messageLimit / 50)), "--no-reactions"])
  ]);
  const [calendar, documents, messages] = results;
  const failures = results.filter((result) => result.status === "rejected").map((result) => String(result.reason?.message || result.reason));
  const normalizedNotes = documents.status === "fulfilled" ? documents.value.map(normalizeDocument) : null;
  const normalizedMessages = messages.status === "fulfilled" ? (messages.value?.messages || []).slice(0, config.lark.messageLimit).map(normalizeMessage) : null;
  return {
    schedule: calendar.status === "fulfilled" ? (calendar.value || []).map(normalizeCalendarEvent) : null,
    notes: normalizedNotes,
    messages: normalizedMessages,
    inferredTasks: normalizedNotes || normalizedMessages ? inferActionTasks(normalizedNotes || [], normalizedMessages || [], config.lark.actionability) : null,
    failures
  };
}

// Read document search pages until the requested number of metadata records is reached.
async function fetchDocuments(limit) {
  const documents = [];
  let pageToken = "";
  while (documents.length < limit) {
    const page = await fetchLarkData(["docs", "+search", "--as", "user", "--query", "", "--page-size", String(Math.min(20, limit - documents.length)), ...(pageToken ? ["--page-token", pageToken] : [])]);
    documents.push(...(page.results || []));
    if (!page.has_more || !page.page_token) break;
    pageToken = page.page_token;
  }
  return documents.slice(0, limit);
}

// Read both open and completed tasks assigned to the authorized Feishu user.
async function syncTodoTasks() {
  const data = await fetchLarkData(["task", "+get-my-tasks", "--as", "user", "--page-all", "--page-limit", "4"]);
  return (data.items || []).map(normalizeTodoTask);
}

// Translate a Project work item into the safe dashboard task shape.
function normalizeTask(item, workflow = {}) {
  const done = item.status_key === "done" || item.sub_stage === "done";
  return {
    id: `feishu-project-${item.id}`,
    title: item.name || "Untitled Project task",
    project: item.simple_name || item.project_key || "Feishu Project",
    status: done ? "done" : "todo",
    progress: workflow.progress ?? null,
    nextStep: workflow.nextStep ?? null,
    dueAt: workflow.dueAt ?? null,
    source: "feishu-project",
    updatedAt: item.updated_at_iso || null,
    createdAt: item.created_at_iso || null
  };
}

// Derive a task's current workflow progress and nearest planned end date.
function summarizeWorkflow(response) {
  const nodes = Array.isArray(response.nodes) ? response.nodes : [];
  if (!nodes.length) return {};
  const isComplete = (node) => Number(node.status) === 3 || Boolean(node.actual_finish_time || node.actual_finish_time_iso);
  const pending = nodes.filter((node) => !isComplete(node));
  const current = pending.find((node) => Number(node.status) === 2) || pending[0];
  const schedule = current ? [current.node_schedule, ...(current.schedules || [])].filter(Boolean)[0] : null;
  return {
    progress: Math.round((nodes.length - pending.length) / nodes.length * 100),
    nextStep: current?.name || null,
    dueAt: schedule?.estimate_end_iso || null
  };
}

// Extract planned workflow dates from a compact node-schedule response.
function normalizeSchedules(task, response) {
  const entries = [];
  const seen = new Set();
  for (const node of response.nodes || []) {
    const schedules = [node.node_schedule, ...(node.schedules || [])].filter(Boolean);
    schedules.forEach((schedule, index) => {
      const start = schedule.estimate_start_iso || null;
      const end = schedule.estimate_end_iso || null;
      if (!start && !end) return;
      const key = `${node.id || "node"}:${start || ""}:${end || ""}:${schedule.points ?? ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push({
        id: `feishu-project-${task.id}-${node.id || "node"}-${index}`,
        taskId: `feishu-project-${task.id}`,
        taskTitle: task.name || "Untitled Project task",
        project: task.simple_name || task.project_key || "Feishu Project",
        node: node.name || "Workflow node",
        start,
        end,
        points: schedule.points ?? null,
        source: "feishu-project"
      });
    });
  }
  return entries;
}

// Read recent personal Project tasks and a bounded set of active workflow schedules.
async function syncFeishuProject() {
  const config = await loadSyncConfig();
  const taskResponse = await fetchProjectData(config, [
    "work-items-cross",
    "--work-item-type-key", config.taskTypeKey,
    "--target-user-key", "@operator",
    "--search-field", "owner",
    "--page-size", String(config.taskPageSize),
    "--compact"
  ]);
  if (taskResponse.err_code !== 0 || !Array.isArray(taskResponse.data)) throw new Error(taskResponse.err_msg || "Feishu Project returned no task data.");

  const rawTasks = taskResponse.data;
  const scheduledTasks = rawTasks.filter((item) => item.status_key !== "done" && item.sub_stage !== "done").slice(0, config.scheduleItemLimit);
  const schedule = [];
  const scheduleFailures = [];
  const workflows = new Map();
  for (const task of scheduledTasks) {
    try {
      const response = await fetchProjectData(config, [
        "node-schedules",
        "--project-key", task.project_key,
        "--work-item-type-key", task.work_item_type_key || config.taskTypeKey,
        "--work-item-id", String(task.id),
        "--compact"
      ]);
      schedule.push(...normalizeSchedules(task, response));
      workflows.set(String(task.id), summarizeWorkflow(response));
    } catch (error) {
      scheduleFailures.push(String(error.message || error));
    }
  }
  return { tasks: rawTasks.map((task) => normalizeTask(task, workflows.get(String(task.id)))), schedule, scheduleFailures };
}

// Write the unified snapshot while preserving unrelated local source data.
async function syncContext() {
  const previous = await readJson(target, {});
  const current = {
    codex: previous.codex || [],
    feishu: previous.feishu || emptyFeishu,
    sources: { codex: "agent-export", ...(previous.sources || {}) },
    syncedAt: new Date().toISOString()
  };
  try {
    current.codex = await loadCodexSessionSummaries();
    current.sources.codex = "local-session-summary";
    delete current.sources.codexError;
  } catch (error) {
    current.sources.codex = "local-session-error";
    current.sources.codexError = String(error.message || error);
    console.warn(`Codex session sync skipped: ${current.sources.codexError}`);
  }
  try {
    current.feishu.todoTasks = await syncTodoTasks();
    current.sources.todo = "lark-task";
    delete current.sources.todoError;
  } catch (error) {
    current.sources.todo = "lark-task-error";
    current.sources.todoError = String(error.message || error);
    console.warn(`Feishu Task sync skipped: ${current.sources.todoError}`);
  }
  try {
    const project = await syncFeishuProject();
    current.feishu = { ...emptyFeishu, ...current.feishu, tasks: project.tasks, schedule: project.schedule };
    current.sources.feishu = project.scheduleFailures.length ? "feishu-project-partial" : "feishu-project";
    delete current.sources.feishuError;
    delete current.sources.feishuScheduleWarning;
    if (project.scheduleFailures.length) current.sources.feishuScheduleWarning = `${project.scheduleFailures.length} workflow schedules could not be read.`;
  } catch (error) {
    current.sources.feishu = "feishu-project-error";
    current.sources.feishuError = String(error.message || error);
    console.warn(`Feishu Project sync skipped: ${current.sources.feishuError}`);
  }
  try {
    const config = await loadSyncConfig();
    const lark = await syncLark(config);
    if (lark.schedule) current.feishu.schedule = uniqueById([...(current.feishu.schedule || []), ...lark.schedule]);
    if (lark.notes) current.feishu.notes = uniqueById(lark.notes);
    if (lark.messages) current.feishu.messages = uniqueById(lark.messages);
    if (lark.notes !== null || lark.messages !== null) {
      current.feishu.inferredTasks = uniqueById(inferActionTasks(current.feishu.notes || [], current.feishu.messages || [], config.lark.actionability));
      console.log(`Suggested ToDos: ${current.feishu.inferredTasks.length}`);
    }
    current.sources.lark = lark.failures.length ? "lark-cli-partial" : "lark-cli";
    delete current.sources.larkError;
    delete current.sources.larkWarning;
    if (lark.failures.length) current.sources.larkWarning = `${lark.failures.length} Lark sources could not be read.`;
  } catch (error) {
    current.sources.lark = "lark-cli-error";
    current.sources.larkError = String(error.message || error);
    console.warn(`Lark sync skipped: ${current.sources.larkError}`);
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  console.log(`Wrote ${target}`);
}

syncContext().catch((error) => { console.error(`Sync failed: ${error.message}`); process.exitCode = 1; });
