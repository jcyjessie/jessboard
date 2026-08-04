// Jessboard behavior renders Chinese work views, local tasks, source snapshots, and the news feed.
const storageKey = "jessboard-data-v2";
const legacyStorageKeys = ["jessboard-data-v1", "focusboard-data-v1"];
const resetMarkerKey = "jessboard-reset-v2";
const emptyData = { focusMinutes: 0, selectedTaskId: null, tasks: [], projects: [] };
let data = loadData();
let contextData = { codex: [], feishu: { tasks: [], todoTasks: [], inferredTasks: [], schedule: [], notes: [], messages: [] }, sources: {} };
let newsItems = [];
let providerStatuses = {};
let newsFilter = "all";
let newsLanguage = localStorage.getItem("jessboard-language") === "en" ? "en" : "zh";
let newsPage = 0;
const newsPageSize = 7;
const newsSnapshotKey = "jessboard-news-snapshot-v1";
let newsLoading = false;
let taskFilter = "all";
let priorityFilter = "all";
let devMetrics = null;
let devMetricsLoading = false;
let devRange = localStorage.getItem("jessboard-dev-range") || "7d";
let localCommitPage = 0;
const localCommitPageSize = 5;
let contextRefreshLoading = false;
let timerSeconds = 25 * 60;
let timerId = null;
let focusPage = 0;
const focusPageSize = 8;
const dismissedBriefMessagesKey = "jessboard-dismissed-brief-messages-v1";
let dismissedBriefMessages = loadDismissedBriefMessages();

const interfaceCopy = {
  zh: {
    navDashboard: "总览", navToday: "我的任务", navProjects: "项目排期", navFocus: "专注", navDev: "开发分析", navNews: "资讯", newTask: "新建任务", chineseFont: "中文字体", englishFont: "英文字体",
    todayWorkspace: "今日工作台", greeting: "你好，Jessie", dailyBrief: "每日工作简报", dailyBriefTitle: "先处理会推动今天的事", dailyBriefCopy: "任务、会议和飞书消息按下一步行动整理；消息需要你确认后才会成为个人任务。", manualRefresh: "手动刷新", newsScope: "AI 与开发 · 产品与公司 · 全球市场 · 金融与加密", newsSourcesCopy: "所有来源合并后按市场、主题、时效和重要度编辑；来源名称与可用原文或快讯入口始终保留。", newsEditorNote: "编辑规则：头条依据可靠度、时效、影响范围和信息密度排序；每篇新闻显示对应市场、主题和重要度。默认中文，可切换英文原文。", newsFilterAll: "全部", newsFilterAiBuilders: "AI 与开发", newsFilterProduct: "产品与公司", newsFilterWorld: "市场、政策与安全", newsFilterFinanceCrypto: "金融与加密", providerAihot: "中文 AI 精选", providerBuilders: "AI Builder 观点", providerWorld: "全球情报", providerFinance: "公开财经快讯", providerCrypto: "公开加密资讯", topicAi: "AI 与模型", topicMarket: "市场与政策", topicProduct: "产品与公司", topicBuilders: "开发者生态", topicSecurity: "安全", topicFinance: "传统金融", topicCrypto: "加密与链上", marketChina: "中国", marketEurope: "欧洲", marketUs: "美国", marketApac: "亚太", marketGlobal: "全球", marketCrypto: "加密市场",
    mustDo: "今日必做", priorityTitle: "优先推进", priorityHint: "截止、客户影响与依赖", meetingPrep: "会议准备", meetingTitle: "即将开始", next48Hours: "未来 48 小时", pendingMessages: "待确认消息", replyTitle: "可能需要你回复", noAutoTask: "不会自动建任务", risks: "风险与依赖", riskTitle: "避免工作停滞", riskHint: "需要确认或跟进",
    workflow: "工作流", projectProgress: "项目进度", openSchedule: "打开排期", dataConnections: "数据连接", workContext: "你的工作上下文", viewBrief: "查看资讯", darkMode: "切换深色模式", lightMode: "切换明亮模式",
    waitingSync: "等待同步", noDate: "暂无时间", noProject: "未归类", projectSource: "飞书与 Codex 上下文", active: "项进行中", completed: "项已完成", current: "当前：", noCurrentProject: "暂未发现与你直接相关的项目。", updatedAt: "更新于 ", priorityAction: "优先处理", priorityCount: "项优先推进", meetingCount: "个今日会议", replyCount: "条待确认消息", waitingCount: "项外部依赖", quietDay: "今天没有需要立即处理的事项", noPriority: "今天没有需要推进的工作。", noMeeting: "未来 48 小时没有需要准备的会议。", noReply: "没有需要人工确认的消息。", noRisk: "当前没有明显的截止或依赖风险。", closeout: "日终闭环", closeoutTitle: "完成与待跟进事项", closeoutCopy: "仅展示飞书已同步的完成事项和仍需跟进的风险。", nextRisk: "下一项风险：", projectDetails: "项目详情", projectItems: "进行项", projectNextStep: "下一步：", allPriorities: "所有优先级", today: "今天", feishuSynced: "飞书同步", feishuSyncedHint: "同步来源：飞书，状态请在飞书中更新。", prepare: "需准备", related: "关联：", viewMessage: "查看消息", addTask: "加入任务", dismiss: "忽略", messageFrom: "飞书消息", unknownSender: "未知发送人", startHere: "start here", checkDependency: "check dependency", taskList: "工作清单", myTasks: "我的任务", taskListCopy: "把今天要推进的事，放在一个可以完成的列表里。", clearCompleted: "清除已完成", deliveryCadence: "交付节奏", projectSchedule: "项目排期", projectScheduleCopy: "从计划到复盘，按状态查看每一项工作。", localSchedule: "本地排期", focusSession: "专注时段", focusOne: "一次只做一件事", currentFocus: "当前专注", selectTask: "选择一项任务开始。", startFocus: "开始专注", focusGoal: "专注目标", selectTaskHeading: "选择任务", all: "全部", open: "未完成", done: "已完成", todo: "计划中", progress: "进行中", review: "待复盘", high: "高优先级", medium: "中优先级", low: "低优先级", noTasks: "这里还没有相关任务。", noColumnTasks: "暂无任务"
  },
  en: {
    navDashboard: "Overview", navToday: "Tasks", navProjects: "Projects", navFocus: "Focus", navDev: "Dev", navNews: "Brief", newTask: "New task", chineseFont: "Chinese font", englishFont: "English font",
    todayWorkspace: "Today", greeting: "Hello, Jessie", dailyBrief: "Daily brief", dailyBriefTitle: "Focus on the work that moves today forward", dailyBriefCopy: "Tasks, meetings, and messages are arranged around the next action. Messages become tasks only after you confirm them.", manualRefresh: "Refresh", newsScope: "AI and builders · Products · Global markets · Finance and crypto", newsSourcesCopy: "Sources are merged and edited by market, topic, recency, and importance. Every item keeps its source and the available article or briefing entry point.", newsEditorNote: "Headlines are ranked by reliability, recency, impact, and information density. Each story shows its market, topic, and importance.", newsFilterAll: "All", newsFilterAiBuilders: "AI and builders", newsFilterProduct: "Products and companies", newsFilterWorld: "Markets, policy and security", newsFilterFinanceCrypto: "Finance and crypto", providerAihot: "Chinese AI selection", providerBuilders: "AI Builder views", providerWorld: "Global intelligence", providerFinance: "Public finance flashes", providerCrypto: "Public crypto news", topicAi: "AI and models", topicMarket: "Markets and policy", topicProduct: "Products and companies", topicBuilders: "Developer ecosystem", topicSecurity: "Security", topicFinance: "Traditional finance", topicCrypto: "Crypto and on-chain", marketChina: "China", marketEurope: "Europe", marketUs: "United States", marketApac: "Asia Pacific", marketGlobal: "Global", marketCrypto: "Crypto markets",
    mustDo: "Today", priorityTitle: "Priority work", priorityHint: "Due dates, customer impact, and dependencies", meetingPrep: "Meetings", meetingTitle: "Coming up", next48Hours: "Next 48 hours", pendingMessages: "Messages to review", replyTitle: "May need a reply", noAutoTask: "Never creates tasks automatically", risks: "Risks and dependencies", riskTitle: "Prevent work from stalling", riskHint: "Needs confirmation or follow-up",
    workflow: "Workflow", projectProgress: "Project progress", openSchedule: "Open schedule", dataConnections: "Connections", workContext: "Your work context", viewBrief: "View brief", darkMode: "Switch to dark mode", lightMode: "Switch to light mode",
    waitingSync: "Waiting for sync", noDate: "No date", noProject: "Uncategorized", projectSource: "Feishu and Codex context", active: "active", completed: "completed", current: "Current: ", noCurrentProject: "No current projects directly related to you were found.", updatedAt: "Updated ", priorityAction: "Priority", priorityCount: "priority items", meetingCount: "meetings today", replyCount: "messages to review", waitingCount: "external dependencies", quietDay: "Nothing needs immediate attention today", noPriority: "No work needs attention today.", noMeeting: "No meetings need preparation in the next 48 hours.", noReply: "No messages need a manual decision.", noRisk: "No clear deadline or dependency risk right now.", closeout: "Day-end summary", closeoutTitle: "Completed and follow-up items", closeoutCopy: "Shows only completed Feishu items and risks that still need follow-up.", nextRisk: "Next risk: ", projectDetails: "Project details", projectItems: "Active items", projectNextStep: "Next step: ", allPriorities: "All priorities", today: "Today", feishuSynced: "Feishu sync", feishuSyncedHint: "Synced from Feishu. Update its status in Feishu.", prepare: "Prepare", related: "Related: ", viewMessage: "View message", addTask: "Add task", dismiss: "Dismiss", messageFrom: "Feishu message", unknownSender: "Unknown sender", startHere: "start here", checkDependency: "check dependency", taskList: "Task list", myTasks: "My tasks", taskListCopy: "Keep today’s work in one list that you can complete.", clearCompleted: "Clear completed", deliveryCadence: "Delivery rhythm", projectSchedule: "Project schedule", projectScheduleCopy: "Review each work item from planning through follow-up.", localSchedule: "Local schedule", focusSession: "Focus session", focusOne: "Do one thing at a time", currentFocus: "Current focus", selectTask: "Choose a task to begin.", startFocus: "Start focus", focusGoal: "Focus goal", selectTaskHeading: "Choose a task", all: "All", open: "Open", done: "Done", todo: "Planned", progress: "In progress", review: "Review", high: "High priority", medium: "Medium priority", low: "Low priority", noTasks: "There are no related tasks here yet.", noColumnTasks: "No tasks"
  }
};

// Return interface copy in the currently selected language.
function t(key) { return interfaceCopy[newsLanguage][key] || key; }

// Remove the previous demo board once, then keep future local edits intact.
function loadData() {
  try {
    if (localStorage.getItem(resetMarkerKey) !== "done") {
      legacyStorageKeys.forEach((key) => localStorage.removeItem(key));
      localStorage.removeItem(storageKey);
      localStorage.setItem(resetMarkerKey, "done");
    }
    return JSON.parse(localStorage.getItem(storageKey)) || clone(emptyData);
  } catch (error) {
    console.warn("无法读取本机任务数据，已使用空白工作台。", error);
    return clone(emptyData);
  }
}

// Clone plain data without sharing mutable arrays.
function clone(value) { return JSON.parse(JSON.stringify(value)); }

// Save task changes locally after every action.
function saveData() { localStorage.setItem(storageKey, JSON.stringify(data)); }

// Load locally dismissed message prompts without changing the Feishu source.
function loadDismissedBriefMessages() {
  try { return new Set(JSON.parse(localStorage.getItem(dismissedBriefMessagesKey)) || []); }
  catch (error) { console.warn("无法读取已忽略的消息提示，已使用空白记录。", error); return new Set(); }
}

// Persist dismissed message prompts for this browser only.
function saveDismissedBriefMessages() { localStorage.setItem(dismissedBriefMessagesKey, JSON.stringify([...dismissedBriefMessages])); }

// Escape untrusted text before placing it into generated markup.
function escapeHtml(value = "") { const element = document.createElement("div"); element.textContent = value; return element.innerHTML; }

// Return a display color for a task priority.
function priorityColor(priority) { return { high: "#cc680a", medium: "#6e8175", low: "#7f9b9a" }[priority] || "#405740"; }

// Remove long links and excess detail from task titles while preserving the source record link.
function taskDisplayTitle(task) { const text = String(task.title || "Untitled task").replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim(); return text.length > 58 ? `${text.slice(0, 58)}…` : text; }

// Keep project progress focused on the work domains relevant to this workspace.
function isRelevantProjectTask(task) {
  const text = `${task.title || ""} ${task.project || ""} ${task.nextStep || ""}`;
  return !/ledger|对账|recon|parser|充提|currency|entryreclassifier|历史数据回溯|eth2|bitmex|bitget|bitmart|kraken|okx|binance|币安|apex|tiger|xstocks|gate|cecapital|pnl|pyth|zama|alpha|合约|资产|股票/i.test(text);
}

// Group relevant synchronized Project items by their concrete business theme.
function clusterProjectTasks(tasks) {
  const themes = [
    { name: "风险与可靠性", color: "#cc680a", pattern: /风控|sentry|告警|\bvar\b|rpc|influx|position-to-oi|价格偏离|debank/i },
    { name: "平台与工作流", color: "#6e8175", pattern: /工具|openapi|formula|table view|hermes|投组|编辑和删除|委托/i }
  ];
  const groups = new Map(themes.map((theme) => [theme.name, { ...theme, tasks: [] }]));
  for (const task of (tasks || []).filter(isRelevantProjectTask)) {
    const text = `${task.title || ""} ${task.project || ""} ${task.nextStep || ""}`;
    const theme = themes.find((item) => item.pattern.test(text)) || themes[1];
    groups.get(theme.name).tasks.push(task);
  }
  return [...groups.values()].filter((group) => group.tasks.length).map((group) => {
    const completed = group.tasks.filter((task) => task.status === "done" || Number(task.progress) >= 100).length;
    const progress = Math.round(group.tasks.reduce((sum, task) => sum + Number(task.progress || 0), 0) / group.tasks.length);
    const preview = [...group.tasks].sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))[0];
    return { ...group, completed, active: group.tasks.length - completed, progress, preview };
  }).sort((left, right) => right.active - left.active || right.progress - left.progress);
}

// Translate known workflow names into readable labels for the development analysis.
function workflowLabel(name) { return { "jessiecao-cam-test-runner": "CAM 测试与验收", "jessiecao-product-test-case-writer": "测试用例设计", "jessiecao-technical-solution-writer": "技术方案梳理", "jessiecao-requirement-consistency-reviewer": "需求一致性核对", "jessiecao-pm-intake": "需求资料收集" }[name] || name || "未识别流程"; }

// Derive a practical work summary and suggestion from privacy-safe session and commit aggregates.
function buildDevelopmentInsights(codex, localGit, github) {
  const sessions = Number(codex.sessionCount || 0);
  const totalTokens = Number(codex.tokenUsage?.total_tokens || 0);
  const largestSession = codex.highestTokenSessions?.[0];
  const concentration = totalTokens && largestSession ? Math.round(Number(largestSession.tokens || 0) / totalTokens * 100) : 0;
  const repositories = Object.entries((localGit.commits || []).reduce((result, commit) => { result[commit.repo] = (result[commit.repo] || 0) + 1; return result; }, {})).sort((left, right) => right[1] - left[1]).slice(0, 3).map(([name, count]) => `${name} ${count} 次`).join("、") || "暂无本机提交";
  const suggestions = [];
  if (concentration >= 40) suggestions.push(`最高消耗会话占本时段约 ${concentration}%，处理同类复杂事项前先写下当前结论和下一步，再开新会话继续。`);
  if (Number(codex.toolCalls || 0) > sessions * 20) suggestions.push("重复的数据检查和命令调用较多，适合沉淀为固定脚本，减少每次会话的手工核对。");
  if (!suggestions.length) suggestions.push("会话与提交分布较均衡；继续按需求、方案、测试和交付拆分会话，便于追踪投入与产出。");
  return {
    focus: `${sessions} 个会话主要集中在${workflowLabel(codex.skills?.[0]?.name)}；${codex.models?.[0]?.name ? `${codex.models[0].name} 承担最多 Token。` : "模型信息仍在汇总。"}`,
    delivery: `当前记录有 ${Number(localGit.commitCount || 0)} 次本机提交，覆盖 ${Number(localGit.repositoryCount || 0)} 个仓库；提交较多的是 ${repositories}。${github.state === "ready" ? "GitHub 公开活动" : "本机补充记录"}仅用于核对公开可见的提交。`,
    suggestions
  };
}

// Derive a consistent priority from the task deadline and recent activity.
function taskPriority(task) { const due = new Date(task.dueAt || task.due || 0).getTime(); const now = Date.now(); if (due && due < now) return "high"; if (due && due <= now + 48 * 60 * 60 * 1000) return "high"; if (due && due <= now + 7 * 24 * 60 * 60 * 1000) return "medium"; return task.priority || "low"; }

// Hide stale open Feishu assignments while preserving completed source history.
function isStaleTask(task) {
  if (task.source !== "lark-task" || task.status === "done") return false;
  const due = new Date(task.dueAt || 0).getTime();
  const updated = new Date(task.updatedAt || task.createdAt || 0).getTime();
  const overdueCutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const undatedCutoff = Date.now() - 21 * 24 * 60 * 60 * 1000;
  if (!due) return !updated || updated < undatedCutoff;
  return due < overdueCutoff && (!updated || updated < overdueCutoff);
}

// Add derived display fields to synchronized or locally created work items.
function prepareTask(task) { return { ...task, priority: taskPriority(task), displayTitle: taskDisplayTitle(task) }; }

// Return only the synchronized work relevant to the EOD group or assigned directly to Jessie.
function syncedWorkTasks() { return [...(contextData.feishu?.todoTasks || []), ...(contextData.feishu?.tasks || []), ...(contextData.feishu?.inferredTasks || [])].filter((task) => (task.source === "lark-task" || task.source === "lark-inferred" || /实时|eod|图表/i.test(`${task.title || ""} ${task.project || ""}`)) && !isStaleTask(task)).map(prepareTask); }

// Combine read-only synchronized work with optional browser-local personal tasks.
function visibleTasks() { return [...syncedWorkTasks(), ...data.tasks.map(prepareTask)]; }

// Select current work directly assigned to Jessie, plus active Codex sessions that support it.
function currentWorkGroups() {
  const cutoff = Date.now() - 45 * 24 * 60 * 60 * 1000;
  const directTasks = [...(contextData.feishu?.todoTasks || []), ...(contextData.feishu?.inferredTasks || [])]
    .filter((task) => task.assignedToMe || task.source === "lark-inferred")
    .filter((task) => !isStaleTask(task))
    .filter((task) => task.status !== "done")
    .filter((task) => new Date(task.updatedAt || task.createdAt || 0).getTime() >= cutoff)
    .map(prepareTask);
  const activeSessions = (contextData.codex || []).filter((session) => session.status === "active");
  const topicCandidates = ["backlog", "pnl", "eod", "图表", "实时", "open api", "openapi", "heatmap", "需求", "测试", "验收", "评审"];
  const workSignals = `${directTasks.map((task) => `${task.title} ${task.project}`).join(" ")} ${activeSessions.map((session) => session.title).join(" ")}`.toLowerCase();
  const currentTopics = topicCandidates.filter((topic) => workSignals.includes(topic));
  const relatedProjectTasks = (contextData.feishu?.tasks || [])
    .filter(isRelevantProjectTask)
    .filter((task) => new Date(task.updatedAt || task.createdAt || 0).getTime() >= cutoff)
    .filter((task) => currentTopics.some((topic) => `${task.title || ""} ${task.project || ""}`.toLowerCase().includes(topic)))
    .map(prepareTask);
  const tasks = [...directTasks, ...relatedProjectTasks];
  const themes = [
    { name: newsLanguage === "en" ? "Product and delivery" : "产品与交付", color: "#86c8eb", pattern: /需求|prd|评审|验收|测试|回顾|backlog|方案|文档/i },
    { name: newsLanguage === "en" ? "Data and dashboard" : "数据与看板", color: "#b8f85b", pattern: /实时|eod|pnl|图表|heatmap|估值|数据|dashboard/i },
    { name: newsLanguage === "en" ? "Team follow-up" : "协作与跟进", color: "#f2b86f", pattern: /.*/ }
  ];
  const groups = new Map(themes.map((theme) => [theme.name, { ...theme, tasks: [] }]));
  tasks.forEach((task) => groups.get((themes.find((theme) => theme.pattern.test(`${task.title} ${task.project}`)) || themes[2]).name).tasks.push(task));
  const directGroups = [...groups.values()].filter((group) => group.tasks.length).map((group) => {
    const completed = group.tasks.filter((task) => task.status === "done" || Number(task.progress) >= 100).length;
    const progress = Math.round(group.tasks.reduce((sum, task) => sum + taskProgress(task), 0) / group.tasks.length);
    const preview = [...group.tasks].sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))[0];
    return { ...group, completed, active: group.tasks.length - completed, progress, preview };
  });
  const sessions = activeSessions.slice(0, 2);
  if (sessions.length) directGroups.push({ name: newsLanguage === "en" ? "Active Codex work" : "正在进行的 Codex 工作", color: "#b8f85b", active: sessions.length, completed: 0, progress: 50, preview: { title: sessions[0].title, nextStep: sessions[0].cwd ? sessions[0].cwd.split("/").pop() : "Codex" } });
  return directGroups.slice(0, 3);
}

// Translate an internal task state into a readable Chinese label.
function statusLabel(status) { return t(status) || t("todo"); }

// Format an ISO date in the app's current display language.
function formatDate(value, withTime = false) { if (!value) return newsLanguage === "en" ? "No date" : "暂无时间"; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return new Intl.DateTimeFormat(newsLanguage === "en" ? "en-US" : "zh-CN", withTime ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric" }).format(date); }

// Return a concise meeting time, omitting the date for events happening today.
function formatMeetingTime(value) {
  if (!value) return t("noDate");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const today = new Date();
  const isToday = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  if (!isToday) return formatDate(value, true);
  const time = new Intl.DateTimeFormat(newsLanguage === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" }).format(date);
  return newsLanguage === "en" ? `${t("today")}, ${time}` : `${t("today")} ${time}`;
}

// Calculate a readable progress value when a source item has no explicit percentage.
function taskProgress(task) { return Number.isFinite(Number(task.progress)) ? Number(task.progress) : task.status === "done" ? 100 : task.status === "review" ? 75 : task.status === "progress" ? 50 : 0; }

// Build an individual task row for a task list.
function taskRow(task, includeDelete = true) {
  const done = task.status === "done";
  const synced = task.source === "lark-task" || task.source === "feishu-project";
  const title = task.displayTitle || taskDisplayTitle(task);
  const control = synced ? `<a class="task-toggle task-source-link" href="${escapeHtml(task.link || "#")}" ${task.link ? "target=\"_blank\" rel=\"noreferrer\"" : ""} aria-label="在飞书中打开：${escapeHtml(task.title)}" title="在飞书中打开"><i data-lucide="arrow-up-right"></i></a>` : `<button class="task-toggle" data-toggle-task="${escapeHtml(task.id)}" type="button" aria-label="${done ? "标记未完成" : "标记完成"}：${escapeHtml(task.title)}">${done ? "<i data-lucide=\"check\"></i>" : ""}</button>`;
  return `<article class="task-row ${done ? "done" : ""}" style="--task-color:${priorityColor(task.priority)}">
    ${control}
    <div><div class="task-title" title="${escapeHtml(task.title)}">${escapeHtml(title)}</div><div class="task-meta"><span class="status-chip ${task.priority === "high" ? "orange" : "pale"}">${t(task.priority)}</span> ${escapeHtml(task.project || t("noProject"))}</div></div>
    <span class="task-due">${escapeHtml(formatDate(task.dueAt || task.due))}</span>
    ${includeDelete ? `<button class="task-delete" data-delete-task="${escapeHtml(task.id)}" type="button" aria-label="删除任务：${escapeHtml(task.title)}" title="删除任务"><i data-lucide="trash-2"></i></button>` : "<span class=\"priority-dot\"></span>"}
  </article>`;
}

// Render the summary cards across the overview page.
function renderInsights() {
  const tasks = visibleTasks();
  const open = tasks.filter((task) => task.status !== "done");
  const now = Date.now();
  const overdue = open.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < now);
  const dueThisWeek = open.filter((task) => { const due = new Date(task.dueAt || 0).getTime(); return due >= now && due <= now + 7 * 24 * 60 * 60 * 1000; });
  const metrics = [
    ["#405740", open.length, "未完成任务", "待处理"],
    ["#cc680a", overdue.length, "已过截止时间", "需要处理"],
    ["#6e8175", dueThisWeek.length, "未来 7 天截止", "本周截止"],
    ["#7f9b9a", tasks.filter((task) => task.status === "done").length, "已完成任务", "已完成"]
  ];
  document.querySelector("#insight-grid").innerHTML = metrics.map(([color, value, detail, label]) => `<article class="metric-card" style="--metric-color:${color}"><p class="eyebrow">${label}</p><strong>${value}</strong><span>${detail}</span></article>`).join("");
}

// Render one daily priority or risk item with its reason and next action.
function dailyBriefTaskItem(task, annotation = null) {
  const isUrgent = task.score <= 15;
  const link = task.link ? `<a class="brief-open" href="${escapeHtml(task.link)}" target="_blank" rel="noreferrer" aria-label="在飞书中打开：${escapeHtml(task.title)}" title="在飞书中打开"><i data-lucide="arrow-up-right"></i></a>` : "";
  const annotationClass = annotation ? ` ann ann-s ann-${annotation.color} ann-no-mark` : "";
  const annotationNote = annotation ? ` data-note="${escapeHtml(annotation.note)}"` : "";
  const state = task.state?.key === "waiting" ? (newsLanguage === "en" ? "Waiting" : "等待他人") : task.state?.key === "decision" ? (newsLanguage === "en" ? "Follow up" : "待推进") : newsLanguage === "en" ? "In progress" : "进行中";
  return `<article class="brief-item ${annotation ? "has-annotation" : ""}"><div><span class="brief-state ${isUrgent ? "urgent" : ""}${annotationClass}"${annotationNote}>${escapeHtml(isUrgent ? t("priorityAction") : state)}</span><h4 title="${escapeHtml(task.title)}">${escapeHtml(taskDisplayTitle(task))}</h4><p>${escapeHtml(task.action)}</p></div><div class="brief-item-meta"><time>${escapeHtml(task.due ? formatDate(task.due, true) : t("noDate"))}</time><span>${escapeHtml(task.reason)}</span>${link}</div></article>`;
}

// Render an upcoming meeting with its preparation prompt and related work.
function dailyBriefMeetingItem(item) {
  const related = item.relatedTask ? ` · ${t("related")}${taskDisplayTitle(item.relatedTask)}` : "";
  const link = item.link ? `<a class="brief-open" href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer" aria-label="在飞书中打开日程：${escapeHtml(item.title)}" title="在飞书中打开"><i data-lucide="arrow-up-right"></i></a>` : "";
  return `<article class="brief-item"><div><span class="brief-state">${t("prepare")}</span><h4 title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h4><p>${escapeHtml(item.preparation)}</p><span class="meeting-context">${escapeHtml(related)}</span></div><div class="brief-item-meta"><time>${escapeHtml(formatMeetingTime(item.start))}</time>${link}</div></article>`;
}

// Render one message that requires a human decision before it becomes a task.
function dailyBriefReplyItem(message) {
  return `<article class="reply-item"><div class="reply-item-head"><div><span class="brief-state">${escapeHtml(message.reason)}</span><h4 title="${escapeHtml(message.chat)}">${escapeHtml(message.chat || t("messageFrom"))}</h4></div><span>${escapeHtml(message.sender || t("unknownSender"))}</span></div><p>${escapeHtml(message.preview)}</p><div class="reply-actions"><a class="reply-action" href="${escapeHtml(message.link || "#")}" ${message.link ? "target=\"_blank\" rel=\"noreferrer\"" : ""}>${t("viewMessage")}</a><button class="reply-action" data-add-message-task="${escapeHtml(message.id)}" type="button">${t("addTask")}</button><button class="reply-action dismiss" data-dismiss-message="${escapeHtml(message.id)}" type="button">${t("dismiss")}</button></div></article>`;
}

// Render the action-led daily brief from the current read-only context snapshot.
function renderDailyBrief() {
  if (!window.DailyBrief) return;
  const brief = window.DailyBrief.build(contextData, { ignoredMessageIds: [...dismissedBriefMessages] });
  const updated = document.querySelector("#daily-brief-updated");
  updated.textContent = brief.generatedAt ? `${t("updatedAt")}${formatDate(brief.generatedAt, true)}` : t("waitingSync");
  const isQuiet = !brief.priorities.length && !brief.meetings.length && !brief.reply.length && !brief.risks.length;
  document.querySelector(".daily-brief").classList.toggle("is-quiet", isQuiet);
  const summary = [[brief.summary.priorities, t("priorityCount")], [brief.summary.meetings, t("meetingCount")], [brief.summary.reply, t("replyCount")], [brief.summary.waiting, t("waitingCount")]];
  document.querySelector("#daily-brief-summary").innerHTML = isQuiet ? `<div class="brief-calm-summary"><i data-lucide="circle-check-big"></i><span>${t("quietDay")}</span></div>` : summary.map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("");
  const syncCue = !brief.generatedAt ? `<p class="brief-empty sync-guidance"><span class="ann ann-s ann-blue" data-note="${t("startHere")}">${t("waitingSync")}</span><br />${t("waitingSync")}</p>` : `<p class="brief-empty">${t("noPriority")}</p>`;
  document.querySelector("#daily-priority-list").innerHTML = brief.priorities.map((task, index) => dailyBriefTaskItem(task, index === 0 ? { color: "amber", note: t("startHere") } : null)).join("") || syncCue;
  document.querySelector("#daily-meeting-list").innerHTML = brief.meetings.map(dailyBriefMeetingItem).join("") || `<p class="brief-empty">${t("noMeeting")}</p>`;
  document.querySelector("#daily-reply-list").innerHTML = brief.reply.map(dailyBriefReplyItem).join("") || `<p class="brief-empty">${t("noReply")}</p>`;
  document.querySelector("#daily-risk-list").innerHTML = brief.risks.map((task, index) => dailyBriefTaskItem(task, index === 0 ? { color: "red", note: t("checkDependency") } : null)).join("") || `<p class="brief-empty">${t("noRisk")}</p>`;
  const closeout = document.querySelector("#daily-closeout");
  const hasCloseout = brief.closed.length > 0 || brief.risks.length > 0;
  closeout.hidden = !hasCloseout;
  if (!hasCloseout) {
    closeout.innerHTML = "";
    return;
  }
  const closed = brief.closed.map((task) => `<div><i data-lucide="check-circle-2"></i><span>${escapeHtml(taskDisplayTitle(task))}</span></div>`).join("");
  const followUp = brief.risks[0] ? `<div><i class="risk-icon" data-lucide="triangle-alert"></i><span>${t("nextRisk")}${escapeHtml(taskDisplayTitle(brief.risks[0]))}</span></div>` : "";
  closeout.innerHTML = `<div class="daily-closeout-heading"><div><p class="eyebrow">${t("closeout")}</p><h3>${t("closeoutTitle")}</h3><p>${t("closeoutCopy")}</p></div></div><div class="closeout-list">${closed}${followUp}</div>`;
}

// Render the short priority list on the overview page.
function renderPriorities() {
  const target = document.querySelector("#priority-list");
  if (!target) return;
  const order = { high: 0, medium: 1, low: 2 };
  const tasks = visibleTasks().filter((task) => task.status !== "done").sort((left, right) => order[left.priority] - order[right.priority] || new Date(left.dueAt || left.updatedAt || 0) - new Date(right.dueAt || right.updatedAt || 0)).slice(0, 4);
  target.innerHTML = tasks.map((task) => taskRow(task, false)).join("") || "<div class=\"empty-state\"><i data-lucide=\"sparkles\"></i><span>今天没有需要推进的 EOD 工作。</span></div>";
}

// Render all local tasks using the selected filter.
function renderAllTasks() {
  const tasks = visibleTasks();
  const filtered = tasks.filter((task) => (taskFilter === "all" || (taskFilter === "open" ? task.status !== "done" : task.status === "done")) && (priorityFilter === "all" || task.priority === priorityFilter));
  document.querySelector('[data-task-filter="all"]').textContent = `${t("all")} ${tasks.length}`;
  document.querySelector('[data-task-filter="open"]').textContent = `${t("open")} ${tasks.filter((task) => task.status !== "done").length}`;
  document.querySelector('[data-task-filter="done"]').textContent = `${t("done")} ${tasks.filter((task) => task.status === "done").length}`;
  document.querySelector('[data-priority-filter="all"]').textContent = t("allPriorities");
  ["high", "medium", "low"].forEach((priority) => { document.querySelector(`[data-priority-filter="${priority}"]`).textContent = t(priority); });
  document.querySelector("#task-list-count").textContent = newsLanguage === "en" ? `${filtered.length} items` : `${filtered.length} 项`;
  document.querySelector("#all-task-list").innerHTML = filtered.map((task) => taskRow(task, task.source !== "lark-task" && task.source !== "feishu-project")).join("") || `<div class="empty-state"><i data-lucide="inbox"></i><span>${t("noTasks")}</span></div>`;
}

// Render Project work as business themes rather than the broad source project name.
function renderProjects() {
  const groups = currentWorkGroups();
  document.querySelector("#project-cards").innerHTML = groups.map((group) => `<button class="project-card" data-project-group="${escapeHtml(group.name)}" style="--project-color:${group.color}" type="button" aria-label="${escapeHtml(t("projectDetails"))}：${escapeHtml(group.name)}"><div class="project-card-top"><span class="status-chip pale">${t("projectSource")}</span><span class="project-percent">${group.progress}%</span></div><h3>${escapeHtml(group.name)}</h3><p>${group.active} ${t("active")} · ${group.completed} ${t("completed")}</p><div class="progress-line"><span style="width:${group.progress}%"></span></div><div class="project-task-preview"><span title="${escapeHtml(group.preview?.title || "")}">${t("current")}${escapeHtml(taskDisplayTitle(group.preview || {}))}</span><span>${escapeHtml(group.preview?.nextStep || t("waitingSync"))}</span></div></button>`).join("") || `<div class="empty-state"><i data-lucide="folder-open"></i><span>${t("noCurrentProject")}</span></div>`;
}

// Open a detailed progress view for one current-work group.
function openProjectDialog(name) {
  const group = currentWorkGroups().find((item) => item.name === name);
  if (!group) return;
  const dialog = document.querySelector("#project-dialog");
  document.querySelector("#project-dialog-kicker").textContent = t("projectProgress");
  document.querySelector("#project-dialog-title").textContent = group.name;
  const tasks = group.tasks || [];
  document.querySelector("#project-dialog-content").innerHTML = `<div class="project-dialog-summary"><div><strong>${group.progress}%</strong><span>${t("projectProgress")}</span></div><div><strong>${group.active}</strong><span>${t("projectItems")}</span></div></div><div class="project-detail-list">${tasks.map((task) => `<article class="project-detail-item"><div class="project-detail-top"><div><h3>${escapeHtml(taskDisplayTitle(task))}</h3><p>${escapeHtml(task.project || t("noProject"))}</p></div><span class="status-chip ${task.priority === "high" ? "orange" : "pale"}">${t(task.priority)}</span></div><div class="project-detail-progress"><span><i style="width:${taskProgress(task)}%"></i></span><strong>${taskProgress(task)}%</strong></div><p class="project-detail-next">${t("projectNextStep")}${escapeHtml(task.nextStep || task.action || t("waitingSync"))}</p></article>`).join("") || `<div class="empty-state"><i data-lucide="folder-open"></i><span>${t("noTasks")}</span></div>`}</div>`;
  dialog.showModal();
  lucide.createIcons();
}

// Render the compact weekly focus chart.
function renderRhythm() {
  const values = [0, 0, 0, 0, 0, 0, 0];
  const days = ["一", "二", "三", "四", "五", "六", "日"];
  document.querySelector("#week-bars").innerHTML = values.map((value, index) => `<div class="day-bar ${index === 2 ? "today" : ""}"><span style="height:${Math.max(value, 7)}%"></span><small>${days[index]}</small></div>`).join("");
  document.querySelector("#focus-hours").textContent = `${Math.floor(data.focusMinutes / 60)} 小时 ${String(data.focusMinutes % 60).padStart(2, "0")} 分`;
  document.querySelector("#completed-count").textContent = data.tasks.filter((task) => task.status === "done").length;
}

// Render project tasks grouped into planning columns.
function renderKanban() {
  const columns = [["todo", t("todo")], ["progress", t("progress")], ["review", t("review")], ["done", t("done")]];
  document.querySelector("#kanban-board").innerHTML = columns.map(([status, label]) => {
    const order = { high: 0, medium: 1, low: 2 };
    const tasks = visibleTasks().filter((task) => task.status === status).sort((left, right) => order[left.priority] - order[right.priority] || new Date(left.dueAt || 0) - new Date(right.dueAt || 0));
    return `<section class="kanban-column"><div class="kanban-heading"><span>${label}</span><span class="kanban-count">${tasks.length}</span></div>${tasks.map((task) => `<article class="kanban-card" style="--task-color:${priorityColor(task.priority)}"><h3 title="${escapeHtml(task.title)}">${escapeHtml(task.displayTitle)}</h3><p>${escapeHtml(task.project || t("noProject"))} · ${escapeHtml(formatDate(task.dueAt || task.due))}</p><div class="kanban-footer"><span class="status-chip ${task.priority === "high" ? "orange" : "pale"}">${t(task.priority)}</span>${task.source === "lark-task" || task.source === "feishu-project" ? `<span class="status-chip pale" title="${escapeHtml(t("feishuSyncedHint"))}">${t("feishuSynced")}</span>` : `<select class="status-select" data-status-task="${escapeHtml(task.id)}" aria-label="${escapeHtml(task.title)}"><option value="todo" ${task.status === "todo" ? "selected" : ""}>${t("todo")}</option><option value="progress" ${task.status === "progress" ? "selected" : ""}>${t("progress")}</option><option value="review" ${task.status === "review" ? "selected" : ""}>${t("review")}</option><option value="done" ${task.status === "done" ? "selected" : ""}>${t("done")}</option></select>`}</div></article>`).join("") || `<p class="column-empty">${t("noColumnTasks")}</p>`}</section>`;
  }).join("");
}

// Render task choices for the focus session.
function renderFocusOptions() {
  const active = visibleTasks().filter((task) => task.status !== "done");
  const pages = Math.max(1, Math.ceil(active.length / focusPageSize));
  focusPage = Math.min(focusPage, pages - 1);
  const pageTasks = active.slice(focusPage * focusPageSize, (focusPage + 1) * focusPageSize);
  document.querySelector("#focus-task-options").innerHTML = pageTasks.map((task) => `<button class="focus-choice ${task.id === data.selectedTaskId ? "active" : ""}" data-focus-task="${escapeHtml(task.id)}" type="button" title="${escapeHtml(task.title)}"><span class="priority-dot" style="--task-color:${priorityColor(task.priority)}"></span><span><strong class="${task.id === data.selectedTaskId ? "ann ann-green" : ""}">${escapeHtml(task.displayTitle)}</strong><small>${escapeHtml(task.project || "未归类")}</small></span></button>`).join("") || "<div class=\"empty-state\"><i data-lucide=\"check-circle-2\"></i><span>先创建一项未完成任务。</span></div>";
  document.querySelector("#focus-pagination").innerHTML = pages > 1 ? `<button class="icon-button" data-focus-page="${focusPage - 1}" ${focusPage === 0 ? "disabled" : ""} type="button" aria-label="上一页" title="上一页"><i data-lucide="arrow-left"></i></button><span>${focusPage + 1} / ${pages}</span><button class="icon-button" data-focus-page="${focusPage + 1}" ${focusPage === pages - 1 ? "disabled" : ""} type="button" aria-label="下一页" title="下一页"><i data-lucide="arrow-right"></i></button>` : "";
  const selected = visibleTasks().find((task) => task.id === data.selectedTaskId);
  document.querySelector("#timer-task").textContent = selected ? selected.title : t("selectTask");
}

// Render source connection cards from the local context snapshot.
function renderSourceStatus() {
  const projectConnected = contextData.sources?.feishu === "feishu-project" || contextData.sources?.feishu === "feishu-project-partial";
  const larkConnected = contextData.sources?.lark === "lark-cli" || contextData.sources?.lark === "lark-cli-partial";
  const scheduleConnected = projectConnected || larkConnected;
  const noteCount = contextData.feishu?.notes?.length || 0;
  const messageCount = contextData.feishu?.messages?.length || 0;
  const sources = [
    ["codex", "Codex 会话", "message-square-code", contextData.codex?.length ? `${contextData.codex.length} 个会话` : "等待同步"],
    ["feishu", "飞书任务", "cloud", contextData.feishu?.todoTasks?.length ? `${contextData.feishu.todoTasks.length} 项分配任务` : contextData.sources?.todo === "lark-task-error" ? "等待任务授权" : "暂无任务"],
    ["project", "飞书 Project", "kanban-square", contextData.feishu?.tasks?.length ? `${contextData.feishu.tasks.length} 项工作项 · ${(contextData.feishu.schedule || []).filter((item) => item.source === "feishu-project").length} 条排期` : projectConnected ? "暂无工作项" : "等待授权"],
    ["schedule", "飞书日程", "calendar-clock", contextData.feishu?.schedule?.filter((item) => item.source === "lark-calendar").length ? `${contextData.feishu.schedule.filter((item) => item.source === "lark-calendar").length} 个日程` : scheduleConnected ? "暂无安排" : "等待授权"],
    ["notes", "文档与消息", "notebook-tabs", noteCount || messageCount ? `${noteCount} 份文档 · ${messageCount} 条消息 · ${(contextData.feishu?.inferredTasks || []).length} 项建议` : larkConnected ? "暂无新内容" : "尚未接入"]
  ];
  document.querySelector("#source-status-grid").innerHTML = sources.map(([key, label, icon, detail]) => `<div class="source-card ${detail === "等待授权" || detail === "尚未接入" ? "is-pending" : ""}"><i data-lucide="${icon}"></i><div><strong>${label}</strong><span>${detail}</span></div><span class="source-dot ${detail === "等待授权" || detail === "尚未接入" ? "pending" : "ready"}"></span></div>`).join("");
}

// Render the read-only daily plan calculated from synchronized work context.
function renderWorkPlan() {
  const plan = window.WorkPlanner?.build(contextData);
  if (!plan) return;
  document.querySelector("#work-plan-updated").textContent = plan.updatedAt ? `更新于 ${formatDate(plan.updatedAt, true)}` : "等待同步";
  const overdue = visibleTasks().filter((task) => task.status !== "done" && task.dueAt && new Date(task.dueAt).getTime() < Date.now()).length;
  const summary = [[overdue, "项已逾期"], [plan.summary.highPriority, "项需要优先处理"], [plan.summary.todayMeetings, "个今日日程"], [plan.summary.activeCodex, "个活跃 Codex 会话"]];
  document.querySelector("#work-plan-summary").innerHTML = summary.map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("");
  document.querySelector("#work-plan-list").innerHTML = plan.tasks.map((task) => { const source = task.source === "feishu-project" ? `飞书 Project · ${task.project}` : "飞书 Task"; return `<article class="planned-task ${task.priority}"><div><span class="status-chip ${task.priority === "high" ? "orange" : "pale"}">${task.priority === "high" ? "优先" : "计划"}</span><h3 title="${escapeHtml(task.title)}">${escapeHtml(taskDisplayTitle(task))}</h3><p>${escapeHtml(source)}${task.nextStep ? ` · 下一步：${escapeHtml(task.nextStep)}` : ""}</p></div><div class="planned-task-meta">${task.progress == null ? "待处理" : `已完成 ${task.progress}%`}<small>${escapeHtml(task.reason)}</small>${task.dueAt ? `<time>${escapeHtml(formatDate(task.dueAt, true))}</time>` : ""}</div></article>`; }).join("") || "<div class=\"empty-state\"><i data-lucide=\"inbox\"></i><span>暂无未完成的相关任务。</span></div>";
  document.querySelector("#today-agenda").innerHTML = plan.agenda.map((item) => `<article class="agenda-item ${item.state === "in-progress" ? "in-progress" : item.state === "completed" ? "completed" : ""}"><time>${escapeHtml(formatDate(item.start, true))}</time><div><strong>${escapeHtml(item.title)}</strong><span>${item.state === "in-progress" ? "进行中" : item.state === "completed" ? "已结束" : item.availability === "busy" ? "忙碌" : "空闲"}</span></div>${item.link ? `<a class="agenda-link" href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer" aria-label="打开日程：${escapeHtml(item.title)}" title="打开日程"><i data-lucide="arrow-up-right"></i></a>` : ""}</article>`).join("") || "<div class=\"empty-state\"><i data-lucide=\"calendar-check\"></i><span>暂无接下来的日程。</span></div>";
}

// Render the provider states in the news sidebar.
function renderProviders() {
  const providers = [["aihot", "AI HOT", t("providerAihot")], ["builders", "Follow Builders", t("providerBuilders")], ["worldmonitor", "World Monitor", t("providerWorld")], ["finance", "Finance Briefs", t("providerFinance")], ["crypto", "Crypto Wire", t("providerCrypto")]];
  document.querySelector("#provider-list").innerHTML = providers.map(([key, name, label]) => {
    const status = providerStatuses[key] || { state: "idle", detail: "手动刷新后加载" };
    const icon = key === "worldmonitor" ? "globe-2" : key === "builders" ? "users" : key === "finance" ? "landmark" : key === "crypto" ? "blocks" : "sparkles";
    return `<div class="provider-row"><span class="provider-icon ${key}"><i data-lucide="${icon}"></i></span><div><strong>${name}</strong><small>${label}</small></div><span class="provider-state ${status.state}">${escapeHtml(status.detail)}</span></div>`;
  }).join("");
}

// Classify every story by market, topic, and editorial importance instead of its feed source.
function editorialMeta(item) {
  const text = `${item.title || ""} ${item.summary || ""}`.toLowerCase();
  const marketKey = item.source === "crypto" ? "Crypto" : item.source === "finance" ? "China" : /中国|北京|上海|小红书|字节|阿里|腾讯|qwen|kimi/.test(text) ? "China" : /英国|英格兰|欧洲|德国|法国|eu\b|uk\b/.test(text) ? "Europe" : /美国|openai|google|anthropic|microsoft|amazon|meta\b/.test(text) ? "Us" : /印度|日本|韩国|澳大利亚|新西兰|亚太/.test(text) ? "Apac" : "Global";
  const topicKey = item.source === "finance" ? "Finance" : item.source === "crypto" ? "Crypto" : /hacking|hack|安全|漏洞|攻击|guardrail|防护/.test(text) ? "Security" : /政策|监管|business rates|政府|议会|法案|law|regulation/.test(text) ? "Market" : /投资|融资|估值|收购|营收|公司|business|funding|valuation|investment/.test(text) ? "Product" : /builder|开发者|github|开源|open source|zig|bun|代码|runtime/.test(text) ? "Builders" : /人工智能|模型|machine learning|llm|chatgpt|openai|anthropic|gemini|qwen|kimi|\bai\b/.test(text) ? "Ai" : "Market";
  const score = (item.source === "aihot" ? 3 : item.source === "worldmonitor" ? 2.7 : item.source === "crypto" ? 2.6 : item.source === "finance" ? 2.5 : 1.8) + (/发布|开源|政策|投资|安全|launch|open|policy|attack|监管|通胀|美联储|比特币|bitcoin|ethereum/.test(text) ? 1 : 0) + (text.length > 120 ? .35 : 0);
  const importance = score >= 3.7 ? "重要" : score >= 2.5 ? "关注" : "观察";
  const category = item.source === "finance" || item.source === "crypto" ? "financeCrypto" : item.source === "aihot" || item.source === "builders" || topicKey === "Ai" || topicKey === "Builders" ? "aiBuilders" : topicKey === "Product" ? "product" : "world";
  return { market: t(`market${marketKey}`), topic: t(`topic${topicKey}`), importance: newsLanguage === "en" ? (score >= 3.7 ? "Major" : score >= 2.5 ? "Watch" : "Monitor") : importance, category, score };
}

// Rank stories by editorial importance, source reliability, and freshness.
function newsPriority(item) { const meta = editorialMeta(item); const timestamp = new Date(item.publishedAt || 0).getTime(); const ageHours = Number.isFinite(timestamp) ? Math.max(0, (Date.now() - timestamp) / 36e5) : 72; return meta.score + Math.max(0, 1.8 - ageHours / 48); }

// Return filtered stories in stable editorial order.
function sortedNewsItems() { return newsItems.filter((item) => newsFilter === "all" || editorialMeta(item).category === newsFilter).map((item, index) => ({ ...item, _order: index })).sort((a, b) => newsPriority(b) - newsPriority(a) || new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0) || a._order - b._order); }

// Remove URLs from visible copy while keeping the original article link in the footer.
function cleanNewsCopy(value = "") { return String(value).replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim(); }

// Keep the visible newspaper copy concise enough to read without clipping the key point.
function editorialSummary(value, variant) { const limit = variant === "lead" ? 240 : variant === "secondary" ? 170 : 115; const clean = cleanNewsCopy(value); return clean.length > limit ? `${clean.slice(0, limit).replace(/[，。；、,. ]+$/, "")}…` : clean; }

// Estimate card height so the two supporting columns stay balanced without forced empty space.
function storyWeight(item) { const title = cleanNewsCopy(item.title || "").length; const summary = cleanNewsCopy(item.summary || "").length; return 1 + title / 38 + summary / 95; }

// Render a single editorial story with market, topic, importance, and a variable text shape.
function newspaperStory(item, variant = "brief") {
  const title = cleanNewsCopy(newsLanguage === "en" ? (item.originalTitle || item.title) : item.title);
  const summary = editorialSummary(newsLanguage === "en" ? (item.originalSummary || item.summary) : item.summary, variant);
  const fallbackTitle = newsLanguage === "en" ? "Untitled" : "无标题";
  const fallbackSummary = newsLanguage === "en" ? "No summary" : "暂无摘要";
  const meta = editorialMeta(item);
  const shape = storyWeight(item) > 4.2 ? "story-tall" : storyWeight(item) < 2.3 ? "story-compact" : "story-standard";
  const tag = variant === "lead" ? "头条" : variant === "secondary" ? "重点" : "简报";
  const targetUrl = item.url || item.sourceUrl;
  const linkLabel = item.url ? (newsLanguage === "en" ? "Open article" : "打开原文") : (newsLanguage === "en" ? "Open source" : "打开快讯来源");
  return `<article class="news-story ${variant} ${shape}"><div class="news-story-kicker"><span class="source-label ${escapeHtml(item.source)}">${escapeHtml(item.sourceLabel || item.source)}</span><span>${tag}</span></div><div class="news-story-context"><span>${escapeHtml(meta.topic)}</span><span>${escapeHtml(meta.market)}</span><strong>${escapeHtml(meta.importance)}</strong></div><h3>${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(title || fallbackTitle)}</a>` : escapeHtml(title || fallbackTitle)}</h3><p>${escapeHtml(summary || fallbackSummary)}</p><footer><span>${escapeHtml(item.author || item.attribution || (newsLanguage === "en" ? "Public source" : "公开来源"))}</span><time>${escapeHtml(formatDate(item.publishedAt, true))}</time>${targetUrl ? `<a class="news-link" href="${escapeHtml(targetUrl)}" target="_blank" rel="noreferrer" aria-label="${linkLabel}" title="${linkLabel}"><i data-lucide="external-link"></i></a>` : ""}</footer></article>`;
}

// Distribute every story by estimated length so the lead column does not leave a blank tail.
function renderNewspaperColumns(pageItems) {
  const columns = [[], [], []];
  const heights = [0, 0, 0];
  pageItems.forEach((item, index) => {
    // Seed every column and place one supporting story under the lead before balancing by content length.
    const target = index < 4 ? [0, 1, 2, 0][index] : heights.indexOf(Math.min(...heights));
    columns[target].push({ item, variant: index === 0 ? "lead" : "secondary" });
    heights[target] += storyWeight(item);
  });
  return `<div class="newspaper-grid">${columns.map((column, index) => `<div class="${index === 0 ? "newspaper-lead-column" : "newspaper-column"}">${column.map(({ item, variant }) => newspaperStory(item, variant)).join("")}</div>`).join("")}</div>`;
}

// Render the current newspaper page with independent columns and no source-based layout.
function renderNews() {
  const filtered = sortedNewsItems();
  const pageCount = Math.max(1, Math.ceil(filtered.length / newsPageSize));
  newsPage = Math.min(newsPage, pageCount - 1);
  const pageItems = filtered.slice(newsPage * newsPageSize, (newsPage + 1) * newsPageSize);
  document.querySelector("#news-nav-count").textContent = newsItems.length;
  document.querySelectorAll("[data-news-language]").forEach((tab) => tab.classList.toggle("active", tab.dataset.newsLanguage === newsLanguage));
  document.querySelector("#news-page-count").textContent = newsItems.length ? `第 ${newsPage + 1} / ${pageCount} 版` : "第 1 / 1 版";
  document.querySelector("#news-prev").disabled = newsPage === 0;
  document.querySelector("#news-next").disabled = newsPage >= pageCount - 1;
  const paper = pageItems.length ? renderNewspaperColumns(pageItems) : `<div class="empty-state news-empty"><i data-lucide="newspaper"></i><strong>${newsLanguage === "en" ? "No edition yet" : "还没有本期报纸"}</strong><span>${newsLanguage === "en" ? "Click refresh to fetch the latest sources." : "点击右上角刷新，获取最新来源。"}</span></div>`;
  document.querySelector("#news-list").innerHTML = paper;
  renderProviders();
}

// Switch the displayed language without fetching the feeds again.
function renderInterfaceLanguage() {
  const copy = interfaceCopy[newsLanguage];
  document.body.dataset.language = newsLanguage;
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = copy[element.dataset.i18n] || element.textContent; });
  document.querySelectorAll("[data-news-language]").forEach((tab) => { const active = tab.dataset.newsLanguage === newsLanguage; tab.classList.toggle("active", active); tab.setAttribute("aria-pressed", String(active)); });
  document.querySelector("#news-masthead-title").textContent = newsLanguage === "en" ? "JessDaily" : "Jess日报";
  document.querySelectorAll("[data-news-filter]").forEach((tab) => { const key = `newsFilter${tab.dataset.newsFilter[0].toUpperCase()}${tab.dataset.newsFilter.slice(1)}`; tab.textContent = t(key); });
  updateThemeControl(copy);
}

// Update the theme button to describe the change it will make.
function updateThemeControl(copy = null) {
  const button = document.querySelector("#theme-toggle");
  if (!button) return;
  const labels = copy || (newsLanguage === "en" ? { darkMode: "Switch to dark mode", lightMode: "Switch to light mode" } : { darkMode: "切换深色模式", lightMode: "切换明亮模式" });
  const isDark = document.body.classList.contains("dark");
  const label = isDark ? labels.lightMode : labels.darkMode;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = `<i data-lucide="${isDark ? "sun" : "moon"}"></i>`;
}

// Switch the visible application language and refresh language-sensitive content.
function setNewsLanguage(language) {
  newsLanguage = language === "en" ? "en" : "zh";
  localStorage.setItem("jessboard-language", newsLanguage);
  document.documentElement.lang = newsLanguage === "en" ? "en" : "zh-CN";
  renderInterfaceLanguage();
  renderToday();
  renderApp();
  renderNews();
  lucide.createIcons();
}

// Apply and persist the selected visual theme.
function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  localStorage.setItem("jessboard-theme", theme);
  updateThemeControl();
  lucide.createIcons();
}

// Convert Open-Meteo weather codes into short Chinese labels for the masthead.
function weatherLabel(code) { if (code === 0) return "晴"; if ([1, 2, 3].includes(code)) return "多云"; if ([45, 48].includes(code)) return "雾"; if ([51, 53, 55, 56, 57].includes(code)) return "毛毛雨"; if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "有雨"; if ([71, 73, 75, 77, 85, 86].includes(code)) return "有雪"; if ([95, 96, 99].includes(code)) return "雷雨"; return "天气"; }

// Load Shanghai weather and the current lunar date for the newspaper masthead.
async function loadShanghaiWeather() {
  const lunar = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { month: "long", day: "numeric" }).format(new Date());
  document.querySelector("#news-lunar").textContent = `农历${lunar}`;
  try {
    const response = await fetch("/api/weather/shanghai");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const weather = await response.json();
    document.querySelector("#news-weather").textContent = `上海 ${weather.temperature ?? "--"}°C · ${weatherLabel(weather.weatherCode)} · 湿度 ${weather.humidity ?? "--"}%`;
  } catch (error) {
    document.querySelector("#news-weather").textContent = "上海天气暂不可用";
    console.info("上海天气暂不可用。", error.message);
  }
}

// Load local context snapshots produced by the sync service.
async function loadContext() {
  try { const response = await fetch("/api/context"); if (!response.ok) throw new Error(`HTTP ${response.status}`); contextData = await response.json(); }
  catch (error) { console.info("本机同步服务尚未启动，保留空白上下文。", error.message); }
    renderApp();
}

// Run a read-only local context refresh and update the daily plan when it finishes.
async function refreshContext() {
  if (contextRefreshLoading) return;
  contextRefreshLoading = true;
  const button = document.querySelector("#refresh-context");
  button.disabled = true;
  button.innerHTML = "<i data-lucide=\"loader-circle\" class=\"spin\"></i>刷新中";
  lucide.createIcons();
  try {
    const response = await fetch("/api/context/refresh", { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    contextData = payload;
    renderApp();
    if (payload.refresh?.partial) document.querySelector("#daily-brief-updated").textContent = newsLanguage === "en" ? "Partial refresh: showing the last successful snapshot" : "部分同步完成：正在显示上次成功的快照";
  } catch (error) {
    document.querySelector("#daily-brief-updated").textContent = `更新失败：${error.message}`;
  } finally {
    contextRefreshLoading = false;
    button.disabled = false;
    button.innerHTML = "<i data-lucide=\"refresh-cw\"></i>手动刷新";
    lucide.createIcons();
  }
}

// Format large development counters without overwhelming the dashboard.
function compactNumber(value) { return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0); }

// Render one ranked development list while keeping empty and unavailable states explicit.
function renderDevList(target, entries, emptyLabel) {
  const element = document.querySelector(target);
  element.innerHTML = entries?.length ? entries.map((entry) => `<div class="dev-list-row"><span title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</span><strong>${compactNumber(entry.count)}</strong></div>`).join("") : `<span class="dev-empty">${escapeHtml(emptyLabel)}</span>`;
}

// Render a token breakdown with comparable shares and session counts.
function renderTokenShareList(target, entries, emptyLabel) {
  const element = document.querySelector(target);
  const total = (entries || []).reduce((sum, entry) => sum + Number(entry.tokens || 0), 0);
  element.innerHTML = entries?.length ? entries.map((entry) => {
    const share = total ? Math.round(Number(entry.tokens || 0) / total * 100) : 0;
    return `<div class="dev-list-row"><span title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</span><strong>${compactNumber(entry.tokens)} · ${share}% · ${entry.count} 会话</strong></div>`;
  }).join("") : `<span class="dev-empty">${escapeHtml(emptyLabel)}</span>`;
}

// Render recent commit rows with their source, hash, and author timestamp.
function renderDevCommits(target, commits, emptyLabel) {
  const element = document.querySelector(target);
  element.innerHTML = commits?.length ? commits.map((commit) => { const meta = [commit.repo || "本地仓库", commit.sha ? commit.sha.slice(0, 7) : "", commit.date ? formatDate(commit.date, true) : ""].filter(Boolean).join(" · "); return `<article class="dev-commit"><div><strong title="${escapeHtml(commit.message || "未命名提交")}">${escapeHtml(commit.message || "未命名提交")}</strong><span>${escapeHtml(meta)}</span></div><em>${commit.additions != null ? `+${compactNumber(commit.additions)} / -${compactNumber(commit.deletions)}` : "已记录"}</em></article>`; }).join("") : `<span class="dev-empty">${escapeHtml(emptyLabel)}</span>`;
}

// Render a compact page of local commits so the workspaces panel stays scannable.
function renderLocalCommits(local) {
  const commits = local.commits || [];
  const pages = Math.max(1, Math.ceil(commits.length / localCommitPageSize));
  localCommitPage = Math.min(localCommitPage, pages - 1);
  renderDevCommits("#local-commits", commits.slice(localCommitPage * localCommitPageSize, (localCommitPage + 1) * localCommitPageSize), "当前仓库没有匹配的本地提交");
  document.querySelector("#local-pagination").innerHTML = pages > 1 ? `<button class="icon-button" data-local-page="${localCommitPage - 1}" ${localCommitPage === 0 ? "disabled" : ""} type="button" aria-label="上一页" title="上一页"><i data-lucide="arrow-left"></i></button><span>${localCommitPage + 1} / ${pages}</span><button class="icon-button" data-local-page="${localCommitPage + 1}" ${localCommitPage === pages - 1 ? "disabled" : ""} type="button" aria-label="下一页" title="下一页"><i data-lucide="arrow-right"></i></button>` : "";
}

// Render the Codex, GitHub, and local workspace development dashboard.
function renderDevMetrics() {
  if (!devMetrics) return;
  const codex = devMetrics.codex || {};
  const tokens = codex.tokenUsage || {};
  const github = devMetrics.github || {};
  const local = devMetrics.localGit || {};
  const overview = devMetrics.overview || {};
  const githubAvailable = ["ready", "fallback"].includes(github.state);
  const metricCards = [
    ["Codex 总 Token", compactNumber(overview.allTokens), "本机累计"],
    ["近 7 日 Token", compactNumber(overview.weekTokens), "固定统计"],
    ["Codex 会话", compactNumber(overview.allSessions), `${compactNumber(overview.activeSessions)} 个活跃`],
    ["GitHub 提交", githubAvailable ? compactNumber(github.commitCount) : "--", github.state === "fallback" ? "本机历史补充" : github.state === "ready" ? `@${github.username}` : "公共活动不可用"]
  ];
  document.querySelector("#dev-metric-grid").innerHTML = metricCards.map(([label, value, detail]) => `<article class="dev-metric"><p class="eyebrow">${label}</p><strong>${value}</strong><span>${detail}</span></article>`).join("");
  document.querySelector("#codex-token-summary").innerHTML = [["输入", tokens.input_tokens], ["输出", tokens.output_tokens], ["推理", tokens.reasoning_output_tokens]].map(([label, value]) => `<div><strong>${compactNumber(value)}</strong><span>${label} Token</span></div>`).join("");
  const tokenBars = [["输入 Token", tokens.input_tokens], ["缓存输入", tokens.cached_input_tokens], ["输出 Token", tokens.output_tokens], ["推理输出", tokens.reasoning_output_tokens]];
  const maxToken = Math.max(...tokenBars.map(([, value]) => Number(value) || 0), 1);
  document.querySelector("#codex-token-bars").innerHTML = tokenBars.map(([label, value]) => `<div class="dev-bar-row"><span>${label}</span><div class="dev-bar-track"><span style="width:${Math.max(2, Math.round((Number(value) || 0) / maxToken * 100))}%"></span></div><strong>${compactNumber(value)}</strong></div>`).join("");
  const models = (codex.models || []).map((model) => ({ ...model, name: model.name === "Unknown" ? "Legacy session (model not recorded)" : model.name }));
  renderTokenShareList("#codex-models", models, "尚未识别到模型记录");
  renderTokenShareList("#codex-scenarios", codex.scenarios, "尚未识别到使用场景");
  document.querySelector("#codex-top-sessions").innerHTML = codex.highestTokenSessions?.length ? codex.highestTokenSessions.map((session) => `<div class="dev-list-row"><a href="codex://thread/${escapeHtml(session.id)}" title="${escapeHtml(session.id)}">${escapeHtml(session.title)}<small>${escapeHtml(session.id)}</small></a><strong>${compactNumber(session.tokens)}</strong></div>`).join("") : "<span class=\"dev-empty\">No token records</span>";
  const insights = buildDevelopmentInsights(codex, local, github);
  document.querySelector("#dev-analysis").innerHTML = `<p class="eyebrow">Development insight</p><h2>本周工作画像</h2><div class="dev-analysis-grid"><article><h3>工作重心</h3><p>${escapeHtml(insights.focus)}</p></article><article><h3>交付节奏</h3><p>${escapeHtml(insights.delivery)}</p></article><article><h3>建议</h3>${insights.suggestions.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</article></div>`;
  renderDevList("#dev-skills", codex.skills, "尚未识别到 skill 调用");
  renderDevList("#dev-tools", codex.tools, "尚未识别到工具调用");
  document.querySelector("#github-state").textContent = github.state === "fallback" ? "本机补充" : github.state === "ready" ? `@${github.username}` : "不可用";
  document.querySelector("#github-state").className = `status-chip ${githubAvailable ? "blue" : "orange"}`;
  document.querySelector("#github-summary").innerHTML = [["提交", github.commitCount], ["新增行", github.additions], ["删除行", github.deletions]].map(([label, value]) => `<div><strong>${githubAvailable ? compactNumber(value) : "--"}</strong><span>${label}</span></div>`).join("");
  renderDevCommits("#github-commits", github.commits, githubAvailable ? "最近没有提交" : github.detail || "GitHub 公共活动暂不可用");
  document.querySelector("#local-repository-count").textContent = `${local.repositoryCount || 0} 个仓库`;
  document.querySelector("#local-summary").innerHTML = [["新增行", local.history?.additions], ["删除行", local.history?.deletions], ["本地提交", local.commitCount]].map(([label, value]) => `<div><strong>${compactNumber(value)}</strong><span>${label}</span></div>`).join("");
  renderLocalCommits(local);
  const quotaNote = codex.quota?.detail || "仅展示本机记录";
  document.querySelector("#dev-notice").innerHTML = `<i data-lucide="shield-check"></i><span>${escapeHtml(quotaNote)}；显示会话标题预览，不显示凭证或代码内容。</span>`;
}

// Fetch fresh development metrics from the local service on demand.
async function loadDevMetrics() {
  if (devMetricsLoading) return;
  devMetricsLoading = true;
  const button = document.querySelector("#refresh-dev-metrics");
  button.disabled = true;
  button.innerHTML = "<i data-lucide=\"loader-circle\" class=\"spin\"></i>刷新中";
  lucide.createIcons();
  try {
    const response = await fetch(`/api/dev-metrics?range=${encodeURIComponent(devRange)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    devMetrics = await response.json();
    document.querySelector("#dev-updated").textContent = `更新于 ${formatDate(devMetrics.fetchedAt, true)}`;
    renderDevMetrics();
  } catch (error) {
    document.querySelector("#dev-notice").innerHTML = `<i data-lucide="triangle-alert"></i><span>开发统计暂不可用：${escapeHtml(error.message)}。请确认本机服务已启动。</span>`;
  } finally {
    devMetricsLoading = false;
    button.disabled = false;
    button.innerHTML = "<i data-lucide=\"refresh-cw\"></i>手动刷新";
    lucide.createIcons();
  }
}

// Restore the last successful edition before the next network refresh completes.
function restoreNewsSnapshot() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(newsSnapshotKey) || "null");
    if (!snapshot || !Array.isArray(snapshot.items)) return false;
    newsItems = snapshot.items;
    providerStatuses = snapshot.providers || {};
    document.querySelector("#news-updated").textContent = snapshot.fetchedAt ? `上次更新于 ${formatDate(snapshot.fetchedAt, true)}` : "显示上次成功的资讯";
    return newsItems.length > 0;
  } catch {
    localStorage.removeItem(newsSnapshotKey);
    return false;
  }
}

// Keep only successful, public-news results so a later failed refresh cannot erase the edition.
function saveNewsSnapshot(payload) {
  try {
    localStorage.setItem(newsSnapshotKey, JSON.stringify({ items: payload.items || [], providers: payload.providers || {}, fetchedAt: payload.fetchedAt || new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

// Fetch all configured news providers through the local service.
async function refreshNews() {
  if (newsLoading) return;
  newsLoading = true;
  const button = document.querySelector("#refresh-news");
  button.disabled = true;
  button.innerHTML = "<i data-lucide=\"loader-circle\" class=\"spin\"></i>刷新中";
  document.querySelector("#news-updated").textContent = newsItems.length ? "正在更新本期资讯..." : "正在加载本期资讯...";
  lucide.createIcons();
  try {
    const response = await fetch("/api/news");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    newsItems = payload.items || [];
    newsPage = 0;
    providerStatuses = payload.providers || {};
    saveNewsSnapshot(payload);
    document.querySelector("#news-updated").textContent = payload.fetchedAt ? `更新于 ${formatDate(payload.fetchedAt, true)}` : "已刷新";
  } catch (error) {
    if (newsItems.length) document.querySelector("#news-updated").textContent = "刷新失败，正在显示上次成功的资讯";
    else {
      providerStatuses = { aihot: { state: "error", detail: "服务未启动" }, builders: { state: "error", detail: "服务未启动" }, worldmonitor: { state: "error", detail: "服务未启动" }, finance: { state: "error", detail: "服务未启动" }, crypto: { state: "error", detail: "服务未启动" } };
      document.querySelector("#news-updated").textContent = "请先启动本机服务";
    }
  } finally {
    newsLoading = false;
    button.disabled = false;
    button.innerHTML = "<i data-lucide=\"refresh-cw\"></i>手动刷新";
    renderNews();
    lucide.createIcons();
  }
}

// Rebuild every dynamic section after local changes.
function renderApp() { renderDailyBrief(); renderPriorities(); renderAllTasks(); renderProjects(); renderKanban(); renderFocusOptions(); renderSourceStatus(); lucide.createIcons(); }

// Switch between views without leaving the single-page workbench.
function setView(view) {
  document.querySelectorAll("[data-view-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === view));
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  document.querySelector("#open-task-dialog").classList.toggle("is-hidden", !["dashboard", "today", "projects"].includes(view));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Add a new local task from the dialog form.
function addTask(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const dueDate = form.get("due");
  const project = form.get("project") || "未归类";
  const task = { id: `task-${Date.now()}`, title: form.get("title").trim(), project, priority: form.get("priority"), status: form.get("status"), due: dueDate ? formatDate(`${dueDate}T00:00:00`) : "暂无日期" };
  data.tasks.unshift(task);
  data.selectedTaskId ||= task.id;
  saveData(); renderApp(); event.currentTarget.reset(); document.querySelector("#task-dialog").close(); setView("today");
}

// Switch a task between complete and planned.
function toggleTask(id) { const task = data.tasks.find((item) => item.id === id); if (!task) return; task.status = task.status === "done" ? "todo" : "done"; saveData(); renderApp(); }

// Delete a task after the user selects its delete control.
function deleteTask(id) { data.tasks = data.tasks.filter((task) => task.id !== id); if (data.selectedTaskId === id) data.selectedTaskId = data.tasks[0]?.id || null; saveData(); renderApp(); }

// Add a confirmed message to the browser-local task list without changing Feishu.
function addBriefMessageTask(id) {
  const message = (contextData.feishu?.messages || []).find((item) => item.id === id);
  if (!message || data.tasks.some((task) => task.originMessageId === id)) return;
  const title = `回复：${taskDisplayTitle({ title: message.chat || message.preview })}`;
  const task = { id: `message-task-${Date.now()}`, title, project: "飞书消息", priority: "medium", status: "todo", due: "暂无日期", source: "message-confirmed", link: message.link, originMessageId: id };
  data.tasks.unshift(task);
  data.selectedTaskId ||= task.id;
  dismissedBriefMessages.add(id);
  saveDismissedBriefMessages();
  saveData();
  renderApp();
}

// Hide one message prompt locally after the user decides it is not actionable.
function dismissBriefMessage(id) { dismissedBriefMessages.add(id); saveDismissedBriefMessages(); renderDailyBrief(); lucide.createIcons(); }

// Move a task to a new board state.
function changeTaskStatus(id, status) { const task = data.tasks.find((item) => item.id === id); if (!task) return; task.status = status; saveData(); renderApp(); }

// Display the focus timer in minutes and seconds.
function renderTimer() { document.querySelector("#timer-display").textContent = `${String(Math.floor(timerSeconds / 60)).padStart(2, "0")}:${String(timerSeconds % 60).padStart(2, "0")}`; }

// Start or pause a single focus countdown.
function toggleTimer() {
  const button = document.querySelector("#timer-start");
  if (timerId) { clearInterval(timerId); timerId = null; button.innerHTML = "<i data-lucide=\"play\"></i>继续专注"; lucide.createIcons(); return; }
  button.innerHTML = "<i data-lucide=\"pause\"></i>暂停专注"; lucide.createIcons();
  timerId = window.setInterval(() => { timerSeconds -= 1; renderTimer(); if (timerSeconds <= 0) { clearInterval(timerId); timerId = null; timerSeconds = 25 * 60; data.focusMinutes += 25; saveData(); renderApp(); renderTimer(); button.innerHTML = "<i data-lucide=\"play\"></i>开始专注"; lucide.createIcons(); } }, 1000);
}

// Populate the project choice field from the active local project list.
function populateProjectMenu() { document.querySelector("#task-project").innerHTML = data.projects.length ? data.projects.map((project) => `<option value="${escapeHtml(project.name)}">${escapeHtml(project.name)}</option>`).join("") : "<option value=\"未归类\">未归类</option>"; }

// Keep the sidebar control label and icon aligned with its current layout state.
function updateSidebarToggle() {
  const button = document.querySelector("#sidebar-toggle");
  const collapsed = document.body.classList.contains("sidebar-collapsed");
  const label = collapsed ? "展开侧边栏" : "收起侧边栏";
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.innerHTML = `<i data-lucide="${collapsed ? "panel-left-open" : "panel-left-close"}"></i>`;
  lucide.createIcons();
}

// Toggle the compact sidebar and retain the preference for the next visit.
function toggleSidebar() {
  document.body.classList.toggle("sidebar-collapsed");
  localStorage.setItem("jessboard-sidebar", document.body.classList.contains("sidebar-collapsed") ? "collapsed" : "expanded");
  updateSidebarToggle();
}

// Wire shared controls, filters, navigation, and dialogs.
function bindEvents() {
  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-toggle-task]"); const deletion = event.target.closest("[data-delete-task]"); const messageTask = event.target.closest("[data-add-message-task]"); const messageDismiss = event.target.closest("[data-dismiss-message]"); const choice = event.target.closest("[data-focus-task]"); const navigation = event.target.closest("[data-view], [data-go-to]"); const taskTab = event.target.closest("[data-task-filter]"); const priorityTab = event.target.closest("[data-priority-filter]"); const projectCard = event.target.closest("[data-project-group]"); const newsTab = event.target.closest("[data-news-filter]"); const languageTab = event.target.closest("[data-news-language]"); const sidebarToggle = event.target.closest("#sidebar-toggle"); const focusPager = event.target.closest("[data-focus-page]"); const localPager = event.target.closest("[data-local-page]");
    if (toggle) toggleTask(toggle.dataset.toggleTask);
    if (deletion) deleteTask(deletion.dataset.deleteTask);
    if (messageTask) addBriefMessageTask(messageTask.dataset.addMessageTask);
    if (messageDismiss) dismissBriefMessage(messageDismiss.dataset.dismissMessage);
    if (choice) { data.selectedTaskId = choice.dataset.focusTask; saveData(); renderFocusOptions(); lucide.createIcons(); }
    if (navigation) setView(navigation.dataset.view || navigation.dataset.goTo);
    if (taskTab) { taskFilter = taskTab.dataset.taskFilter; document.querySelectorAll("[data-task-filter]").forEach((tab) => tab.classList.toggle("active", tab === taskTab)); renderAllTasks(); lucide.createIcons(); }
    if (priorityTab) { priorityFilter = priorityTab.dataset.priorityFilter; document.querySelectorAll("[data-priority-filter]").forEach((tab) => tab.classList.toggle("active", tab === priorityTab)); renderAllTasks(); lucide.createIcons(); }
    if (projectCard) openProjectDialog(projectCard.dataset.projectGroup);
    if (newsTab) { newsFilter = newsTab.dataset.newsFilter; newsPage = 0; document.querySelectorAll("[data-news-filter]").forEach((tab) => tab.classList.toggle("active", tab === newsTab)); renderNews(); lucide.createIcons(); }
    if (languageTab) setNewsLanguage(languageTab.dataset.newsLanguage);
    if (sidebarToggle) toggleSidebar();
    if (focusPager) { focusPage = Number(focusPager.dataset.focusPage); renderFocusOptions(); lucide.createIcons(); }
    if (localPager) { localCommitPage = Number(localPager.dataset.localPage); renderDevMetrics(); lucide.createIcons(); }
  });
  document.addEventListener("change", (event) => { if (event.target.matches("[data-status-task]")) changeTaskStatus(event.target.dataset.statusTask, event.target.value); });
  document.querySelector("#open-task-dialog").addEventListener("click", () => document.querySelector("#task-dialog").showModal());
  document.querySelector("#close-task-dialog").addEventListener("click", () => document.querySelector("#task-dialog").close());
  document.querySelector("#cancel-task-dialog").addEventListener("click", () => document.querySelector("#task-dialog").close());
  document.querySelector("#task-form").addEventListener("submit", addTask);
  document.querySelector("#clear-completed").addEventListener("click", () => { data.tasks = data.tasks.filter((task) => task.status !== "done"); saveData(); renderApp(); });
  document.querySelector("#timer-start").addEventListener("click", toggleTimer);
  document.querySelector("#timer-reset").addEventListener("click", () => { timerSeconds = 25 * 60; renderTimer(); });
  document.querySelector("#theme-toggle").addEventListener("click", () => applyTheme(document.body.classList.contains("dark") ? "light" : "dark"));
  document.querySelector("#close-project-dialog").addEventListener("click", () => document.querySelector("#project-dialog").close());
  document.querySelector("#refresh-news").addEventListener("click", refreshNews);
  document.querySelector("#refresh-dev-metrics").addEventListener("click", loadDevMetrics);
  document.querySelector("#dev-range").addEventListener("change", (event) => { devRange = event.target.value; localStorage.setItem("jessboard-dev-range", devRange); loadDevMetrics(); });
  document.querySelector("#refresh-context").addEventListener("click", refreshContext);
  document.querySelector("#news-prev").addEventListener("click", () => { if (newsPage > 0) { newsPage -= 1; renderNews(); lucide.createIcons(); } });
  document.querySelector("#news-next").addEventListener("click", () => { const pageCount = Math.max(1, Math.ceil(sortedNewsItems().length / newsPageSize)); if (newsPage < pageCount - 1) { newsPage += 1; renderNews(); lucide.createIcons(); } });
}

// Choose one stable quote for the current calendar day.
function renderDailyQuote(now) { const quotes = [{ zh: "未来取决于你今天的行动。", en: "The future depends on what you do today.", author: "Mahatma Gandhi" }, { zh: "好的开始是成功的一半。", en: "Well begun is half done.", author: "Aristotle" }, { zh: "行动是一切成功的根本钥匙。", en: "Action is the foundational key to all success.", author: "Pablo Picasso" }, { zh: "除非你动手，否则什么也不会发生。", en: "Nothing will work unless you do.", author: "Maya Angelou" }, { zh: "领先的秘诀，是开始行动。", en: "The secret of getting ahead is getting started.", author: "Mark Twain" }, { zh: "做伟大工作的唯一方法，是热爱所做的事。", en: "The only way to do great work is to love what you do.", author: "Steve Jobs" }, { zh: "简洁是终极的复杂。", en: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" }]; const quote = quotes[Math.floor(now.getTime() / 86400000) % quotes.length]; document.querySelector("#page-title").textContent = quote[newsLanguage]; document.querySelector("#quote-author").textContent = `- ${quote.author}`; }

// Set the current date labels in the Chinese locale.
function renderToday() { const now = new Date(); const locale = newsLanguage === "en" ? "en-US" : "zh-CN"; const todayDate = document.querySelector("#today-date"); document.querySelector("#page-kicker").textContent = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }).format(now); if (todayDate) todayDate.textContent = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(now); document.querySelector("#news-edition-date").textContent = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(now); renderDailyQuote(now); }

applyTheme(localStorage.getItem("jessboard-theme") === "light" ? "light" : "dark");
if (localStorage.getItem("jessboard-sidebar") === "collapsed") document.body.classList.add("sidebar-collapsed");
updateSidebarToggle();
document.querySelector("#dev-range").value = devRange;
populateProjectMenu();
bindEvents();
renderToday();
setNewsLanguage(newsLanguage);
renderApp();
restoreNewsSnapshot();
renderNews();
renderTimer();
loadContext();
loadShanghaiWeather();
refreshNews();
