// Jessboard syncs safe Feishu Project task and workflow data into the local context snapshot.
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { loadCodexSessionSummaries } from "./metrics.mjs";
import { loadMyWorkActions } from "./meegle-client.mjs";

const runFile = promisify(execFile);
const root = process.cwd();
const target = path.join(root, "data", "context.json");
const configPath = path.join(root, "sync.config.json");
const emptyFeishu = { tasks: [], todoTasks: [], inferredTasks: [], schedule: [], notes: [], messages: [], myWorkActions: [] };
const defaultActionability = {
  personalKeywords: ["曹逸婕", "Jessie", "@Jessie"],
  businessKeywords: ["实时&EOD", "实时和EOD", "实时", "EOD", "end of day", "real-time", "realtime", "行情", "市场数据", "图表", "K线", "K线图", "kline", "candlestick", "OHLC", "ticker", "报价", "NAV", "PnL", "shadow NAV", "基金净值", "Open API", "fund", "基金", "portfolio", "投资组合", "资产组合", "ta", "技术分析", "capital movement", "capital movements", "资金流动", "资金变动", "资金划转", "report", "报告", "multiple portfolio report", "多组合报告", "多投资组合报告", "live risk", "实时风险", "risk table", "风险表", "风险表格", "risk indicator", "风险指标", "monitor", "monitoring", "监控", "监测", "table view", "表格视图", "表视图", "graph view", "图表视图", "图形视图", "time series data", "时间序列数据", "时序数据", "mobile version", "移动端", "移动版", "home page", "homepage", "首页", "widget", "小组件", "组件", "auto ta", "自动技术分析"],
  actionKeywords: ["待办", "todo", "action item", "跟进", "处理", "确认", "补充", "完成", "评审", "查看", "回复", "安排", "测试", "发布", "更新", "负责", "review", "follow up", "confirm", "deliver", "prepare"]
};

// Emit machine-readable refresh progress for the local dashboard service.
function reportSyncProgress(phase, details = {}) {
  console.log(`JESSBOARD_SYNC_PROGRESS ${JSON.stringify({ phase, ...details })}`);
}

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
    targetUserName: typeof project.targetUserName === "string" && project.targetUserName.trim() ? project.targetUserName.trim() : null,
    targetUserEmail: typeof project.targetUserEmail === "string" && project.targetUserEmail.trim() ? project.targetUserEmail.trim() : null,
    teamMembers: Array.isArray(project.teamMembers) ? project.teamMembers.filter((member) => member?.name && member?.email) : [],
    businessLines: (Array.isArray(project.businessLines) ? project.businessLines : [{ name: project.teamName }])
      .map((line) => ({ name: typeof line?.name === "string" ? line.name.trim() : "", members: Array.isArray(line?.members) ? line.members.filter((member) => member?.name && member?.email) : [] }))
      .filter((line) => line.name),
    taskPageSize: boundedNumber(project.taskPageSize, 50, 1, 50),
    workflowConcurrency: boundedNumber(project.workflowConcurrency, 3, 1, 6),
    meegle: {
      enabled: project.meegle?.enabled !== false,
      maxPages: boundedNumber(project.meegle?.myWorkMaxPages, 1, 1, 4),
      timeoutMs: boundedNumber(project.meegle?.timeoutMs, 12000, 2000, 30000)
    },
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

// Keep message task content readable without retaining Markdown table syntax in the snapshot.
function summarizeMessageTask(value, limit = 180) {
  const raw = String(value || "");
  const cells = raw.split("|").map((cell) => cell.trim()).filter(Boolean);
  const headerIndex = cells.findIndex((cell) => /^(?:模式|方案|事项|用户核心诉求|典型场景)$/u.test(cell));
  if (headerIndex >= 0 && cells.length >= headerIndex + 6) {
    const prefix = cells.slice(0, headerIndex).join(" ").replace(/\s+/g, " ").trim();
    const rows = cells.slice(headerIndex + 3).filter((cell) => !/^:?-{2,}:?$/u.test(cell));
    const outcomes = [];
    for (let index = 0; index + 2 < rows.length && outcomes.length < 3; index += 3) outcomes.push(`${rows[index]}：${rows[index + 2]}`);
    const structured = [prefix, ...outcomes].filter(Boolean).join("；").replace(/：；/g, "：").replace(/\s+/g, " ").trim();
    if (structured) return structured.slice(0, limit);
  }
  return summarizeText(raw, limit + 80)
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\|\s*:?-{2,}:?\s*(?=\||$)/g, "")
    .replace(/\s*\|\s*/g, "；")
    .replace(/[>*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
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
    title: record.origin === "飞书消息" ? summarizeText(record.chat, 80) || "飞书消息" : summarizeText(record.title, 120),
    summary: record.origin === "飞书消息" ? summarizeMessageTask(record.preview, 180) : "",
    sourceTitle: record.origin === "飞书消息" ? summarizeText(record.chat, 120) || "飞书消息" : null,
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

// Return whether a Project work item is already in a completed state.
function isCompletedProjectItem(item) {
  const status = String(item.status_key || item.sub_stage || item.status || item.task_status || item.work_item_status?.state_key || "").toLowerCase();
  return /done|complete|closed|finished|cancelled|canceled|完成|已交付|关闭|结束|终止|取消/.test(status);
}

// Translate a Project work item into the safe dashboard task shape.
function normalizeTask(item, workflow = {}, relevance = {}) {
  // Workflow completion is authoritative when the item-level state is stale or incomplete.
  const done = isCompletedProjectItem(item) || Number(workflow.progress) >= 100;
  const personalAction = relevance.myWorkAction || null;
  return {
    id: `feishu-project-${item.id}`,
    workItemId: String(item.id),
    projectKey: item.project_key || null,
    title: item.name || "Untitled Project task",
    project: item.simple_name || item.project_key || "Feishu Project",
    status: done ? "done" : "todo",
    progress: workflow.progress ?? null,
    nextStep: personalAction?.nodeName || workflow.nextStep || item.node_name || null,
    dueAt: personalAction?.dueAt || workflow.dueAt || item.schedule_end || null,
    workflowSourceUpdatedAt: item.updated_at_iso || null,
    link: item.link || item.url || null,
    source: "feishu-project",
    assignedToMe: relevance.assignedToMe === true,
    watchedByMe: relevance.watchedByMe === true,
    myWorkActions: personalAction?.actions || [],
    myWorkNode: personalAction?.nodeName || null,
    myWorkState: personalAction?.nodeState || null,
    inBusinessScope: relevance.inBusinessScope === true || relevance.inRealtimeEodTeam === true,
    businessLines: Array.isArray(relevance.businessLines) ? relevance.businessLines : [],
    inRealtimeEodTeam: relevance.inRealtimeEodTeam === true,
    updatedAt: item.updated_at_iso || null,
    createdAt: item.created_at_iso || null,
    observedAt: relevance.inBusinessScope === true || relevance.inRealtimeEodTeam === true || relevance.watchedByMe === true ? new Date().toISOString() : null
  };
}

// Attach My Work action evidence and add personal Project items not covered by the business-line scope.
function attachMyWorkActions(tasks, actions) {
  const actionsByItemId = new Map((actions || []).map((action) => [String(action.workItemId), action]));
  const attachedIds = new Set();
  const scopedTasks = (tasks || []).map((task) => {
    const itemId = String(task.workItemId || task.id || "").replace(/^feishu-project-/, "");
    const action = actionsByItemId.get(itemId);
    if (!action) return task;
    attachedIds.add(itemId);
    return {
      ...task,
      nextStep: action.nodeName || task.nextStep,
      dueAt: action.dueAt || task.dueAt,
      myWorkActions: action.actions || [],
      myWorkNode: action.nodeName || null,
      myWorkState: action.nodeState || null,
      assignedToMe: true,
      fromMyWork: true
    };
  });
  const personalOnlyTasks = (actions || []).filter((action) => !attachedIds.has(String(action.workItemId))).map((action) => ({
    id: `feishu-project-${action.workItemId}`,
    workItemId: String(action.workItemId),
    projectKey: action.projectKey || null,
    title: action.title || "Untitled Project item",
    project: action.project || "Feishu Project",
    status: /done|complete|finished|closed|完成|结束/u.test(String(action.nodeState || "")) || Boolean(action.finishAt) ? "done" : "todo",
    progress: null,
    nextStep: action.nodeName || null,
    dueAt: action.dueAt || null,
    source: "feishu-project",
    assignedToMe: true,
    watchedByMe: false,
    fromMyWork: true,
    myWorkActions: action.actions || [],
    myWorkNode: action.nodeName || null,
    myWorkState: action.nodeState || null,
    inBusinessScope: false,
    businessLines: [],
    inRealtimeEodTeam: false,
    updatedAt: action.updatedAt || null,
    createdAt: action.updatedAt || null,
    observedAt: new Date().toISOString()
  }));
  return [...scopedTasks, ...personalOnlyTasks];
}

// Map an item list with a conservative fixed concurrency limit.
async function mapWithConcurrency(items, concurrency, mapItem) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapItem(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
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

// Read one configured business line from Feishu Project's business-line field.
async function fetchBusinessLineTasks(config, businessLine) {
  const members = businessLine.members.length ? businessLine.members : config.teamMembers;
  if (!businessLine.name || !members.length) throw new Error("sync.config.json must set a business-line name and its member scope.");
  const python = path.join(config.sourceDirectory, ".venv", "bin", "python");
  const script = path.join(config.sourceDirectory, "skills", "feishu-project", "scripts", "feishu_project.py");
  try { await fs.access(python); await fs.access(script); }
  catch { throw new Error("The configured Feishu Project team source is missing its local Python helper."); }
  const { stdout } = await runFile(python, [script, "iteration-status-source", "--members-json", JSON.stringify(members), "--team-name", businessLine.name, "--skip-previous-iteration", "--page-size", String(config.taskPageSize), "--max-pages", "1"], { cwd: config.sourceDirectory, maxBuffer: 4 * 1024 * 1024 });
  let source;
  try { source = JSON.parse(stdout); }
  catch { throw new Error("The Feishu Project team source returned unreadable data."); }
  const tasks = new Map();
  for (const member of source.members || []) {
    for (const item of [...(member.today || []), ...(member.current_blockers || []), ...(member.other_current_iteration || [])]) {
      if (!item?.id || tasks.has(String(item.id))) continue;
      tasks.set(String(item.id), item);
    }
  }
  return [...tasks.values()].map((task) => ({ ...task, businessLineScope: businessLine.name }));
}

// Read configured business-line work plus the user's Project watchlist without duplicate items.
async function syncFeishuProject(previousTasks = [], previousSchedule = []) {
  const config = await loadSyncConfig();
  reportSyncProgress("project-scope");
  const [businessLineTasks, watchedResponse] = await Promise.all([
    Promise.all(config.businessLines.map((businessLine) => fetchBusinessLineTasks(config, businessLine))),
    fetchProjectData(config, [
    "work-items-cross",
    "--work-item-type-key", config.taskTypeKey,
    ...(config.targetUserEmail ? ["--target-email", config.targetUserEmail] : config.targetUserName ? ["--target-user-name", config.targetUserName] : ["--target-user-key", "@operator"]),
    "--search-field", "watchers",
    "--page-size", String(config.taskPageSize),
    "--compact"
    ])
  ]);
  if (watchedResponse.err_code !== 0 || !Array.isArray(watchedResponse.data)) throw new Error(watchedResponse.err_msg || "Feishu Project returned no watchlist data.");

  const merged = new Map();
  businessLineTasks.flat().forEach((task) => {
    const key = String(task.id);
    const existing = merged.get(key);
    merged.set(key, {
      ...existing,
      ...task,
      relevance: {
        ...(existing?.relevance || {}),
        inBusinessScope: true,
        businessLines: [...new Set([...(existing?.relevance?.businessLines || []), task.businessLineScope].filter(Boolean))]
      }
    });
  });
  watchedResponse.data.forEach((task) => {
    const key = String(task.id);
    const existing = merged.get(key);
    merged.set(key, { ...existing, ...task, relevance: { ...(existing?.relevance || {}), watchedByMe: true } });
  });

  const rawTasks = [...merged.values()];
  const previousById = new Map(previousTasks.map((task) => [task.id, task]));
  const cachedWorkflows = new Map();
  const workflowTasks = rawTasks.filter((item) => {
    if (isCompletedProjectItem(item)) return false;
    const cached = previousById.get(`feishu-project-${item.id}`);
    const sourceUpdatedAt = item.updated_at_iso || null;
    const cacheMatchesSource = cached?.workflowSourceUpdatedAt === sourceUpdatedAt
      || (cached?.workflowSourceUpdatedAt == null && cached?.updatedAt === sourceUpdatedAt && cached?.progress != null);
    if (!cacheMatchesSource) return true;
    cachedWorkflows.set(String(item.id), { progress: cached.progress, nextStep: cached.nextStep, dueAt: cached.dueAt });
    return false;
  });
  const activeTaskIds = new Set(rawTasks.filter((item) => {
    const workflow = cachedWorkflows.get(String(item.id));
    return !isCompletedProjectItem(item) && Number(workflow?.progress) < 100;
  }).map((item) => `feishu-project-${item.id}`));
  const schedule = previousSchedule.filter((item) => item.source === "feishu-project" && activeTaskIds.has(item.taskId));
  const scheduleFailures = [];
  const workflows = new Map(cachedWorkflows);
  let completedSchedules = 0;
  reportSyncProgress("project-workflows", { completed: completedSchedules, total: workflowTasks.length });
  const workflowResults = await mapWithConcurrency(workflowTasks, config.workflowConcurrency, async (task) => {
    try {
      const response = await fetchProjectData(config, [
        "node-schedules",
        "--project-key", task.project_key,
        "--work-item-type-key", task.work_item_type_key || config.taskTypeKey,
        "--work-item-id", String(task.id),
        "--compact"
      ]);
      return { task, response };
    } catch (error) {
      return { task, error };
    } finally {
      completedSchedules += 1;
      reportSyncProgress("project-workflows", { completed: completedSchedules, total: workflowTasks.length });
    }
  });
  workflowResults.forEach(({ task, response, error }) => {
    if (error) {
      scheduleFailures.push(String(error.message || error));
      return;
    }
    const workflow = summarizeWorkflow(response);
    workflows.set(String(task.id), workflow);
    if (Number(workflow.progress) < 100) schedule.push(...normalizeSchedules(task, response));
  });
  return { tasks: rawTasks.map((task) => normalizeTask(task, workflows.get(String(task.id)), task.relevance)), schedule, scheduleFailures };
}

// Write the unified snapshot while preserving unrelated local source data.
async function syncContext() {
  reportSyncProgress("reading-local-context");
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
    reportSyncProgress("feishu-tasks");
    current.feishu.todoTasks = await syncTodoTasks();
    current.sources.todo = "lark-task";
    delete current.sources.todoError;
  } catch (error) {
    current.sources.todo = "lark-task-error";
    current.sources.todoError = String(error.message || error);
    console.warn(`Feishu Task sync skipped: ${current.sources.todoError}`);
  }
  try {
    reportSyncProgress("project-scope");
    const project = await syncFeishuProject(current.feishu.tasks || [], current.feishu.schedule || []);
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
    reportSyncProgress("meegle-actions");
    const myWork = config.meegle.enabled
      ? await loadMyWorkActions({ maxPages: config.meegle.maxPages, timeoutMs: config.meegle.timeoutMs })
      : { state: "disabled", actions: [], detail: "Meegle enrichment is disabled." };
    current.feishu.myWorkActions = myWork.actions || [];
    current.feishu.tasks = attachMyWorkActions(current.feishu.tasks || [], myWork.actions);
    current.sources.meegle = myWork.state;
    current.sources.meegleDetail = myWork.detail;
    delete current.sources.meegleError;
  } catch (error) {
    current.sources.meegle = "error";
    current.sources.meegleError = String(error.message || error);
    console.warn(`Meegle action sync skipped: ${current.sources.meegleError}`);
  }
  try {
    reportSyncProgress("lark-context");
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
  reportSyncProgress("brief");
  await fs.writeFile(target, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  console.log(`Wrote ${target}`);
}

syncContext().catch((error) => { console.error(`Sync failed: ${error.message}`); process.exitCode = 1; });
