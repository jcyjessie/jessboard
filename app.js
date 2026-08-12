// Jessboard behavior renders Chinese work views, local tasks, source snapshots, and the news feed.
const storageKey = "jessboard-data-v2";
const legacyStorageKeys = ["jessboard-data-v1", "focusboard-data-v1"];
const resetMarkerKey = "jessboard-reset-v2";
const emptyData = { focusMinutes: 0, selectedTaskId: null, tasks: [], projects: [], taskOverrides: {} };
let data = loadData();
let contextData = { codex: [], feishu: { tasks: [], todoTasks: [], inferredTasks: [], schedule: [], notes: [], messages: [] }, sources: {} };
let newsItems = [];
let providerStatuses = {};
let newsFilter = "all";
let newsLanguage = localStorage.getItem("jessboard-language") === "en" ? "en" : "zh";
let newsPage = 0;
const newsPageSize = 9;
const newsSnapshotKey = "jessboard-news-snapshot-v1";
let newsLoading = false;
let taskFilter = "all";
let priorityFilter = "all";
let taskSearch = "";
let taskLayout = localStorage.getItem("jessboard-task-layout") || "table";
let taskRange = localStorage.getItem("jessboard-task-range") || "all";
let taskPage = 0;
const taskPageSize = 40;
const taskRangeLabels = { all: "全部任务", overdue: "已逾期", today: "今天到期", week: "未来 7 天", later: "以后处理" };
let taskScopeIds = null;
let taskScopeLabel = "";
let workspaceProject = null;
let devMetrics = null;
let devMetricsLoading = false;
let devRange = localStorage.getItem("jessboard-dev-range") || "7d";
let devCommitRepository = "all";
let contextRefreshLoading = false;
let contextRefreshTimers = [];
let contextRefreshPoller = null;
let focusDuration = Number(localStorage.getItem("jessboard-focus-duration")) || 25;
let timerSeconds = focusDuration * 60;
let timerId = null;
let focusPage = 0;
const focusPageSize = 5;
const dismissedBriefMessagesKey = "jessboard-dismissed-brief-messages-v1";
let dismissedBriefMessages = loadDismissedBriefMessages();
const businessGoalStateKey = "jessboard-business-goals-v1";
let businessGoalState = loadBusinessGoalState();
let businessGoalCache = { key: "", groups: [] };
const projectDetailCache = new Map();

const interfaceCopy = {
  zh: {
    navDashboard: "总览", navInbox: "工作收件箱", navToday: "我的任务", navReview: "每周复盘", navProjects: "项目工作台", navFocus: "专注", navDev: "开发分析", navNews: "资讯", workspaceLabel: "个人工作台", localData: "本机数据", profileWorkspace: "Jessie 的工作台", newTask: "新建任务", chineseFont: "中文字体", englishFont: "英文字体",
    todayWorkspace: "今日工作台", greeting: "你好，Jessie", dailyBrief: "每日工作简报", dailyBriefTitle: "先处理会推动今天的事", dailyBriefCopy: "任务、会议和飞书消息按下一步行动整理；消息需要你确认后才会成为个人任务。", manualRefresh: "手动刷新", newsScope: "AI 与开发 · 产品与公司 · 全球市场 · 金融与加密", newsSourcesCopy: "所有来源合并后按市场、主题、时效和重要度编辑；来源名称与可用原文或快讯入口始终保留。", newsEditorNote: "编辑规则：头条依据可靠度、时效、影响范围和信息密度排序；每篇新闻显示对应市场、主题和重要度。默认中文，可切换英文原文。", newsFilterAll: "全部", newsFilterAiBuilders: "AI 与开发", newsFilterProduct: "产品与公司", newsFilterWorld: "市场、政策与安全", newsFilterFinanceCrypto: "金融与加密", providerAihot: "中文 AI 精选", providerBuilders: "AI Builder 观点", providerWorld: "全球情报", providerFinance: "公开财经快讯", providerCrypto: "公开加密资讯", topicAi: "AI 与模型", topicMarket: "市场与政策", topicProduct: "产品与公司", topicBuilders: "开发者生态", topicSecurity: "安全", topicFinance: "传统金融", topicCrypto: "加密与链上", marketChina: "中国", marketEurope: "欧洲", marketUs: "美国", marketApac: "亚太", marketGlobal: "全球", marketCrypto: "加密市场",
    mustDo: "今日必做", priorityTitle: "优先推进", priorityHint: "截止、客户影响与依赖", meetingPrep: "会议准备", meetingTitle: "即将开始", next48Hours: "未来 48 小时", pendingMessages: "待确认消息", replyTitle: "可能需要你回复", noAutoTask: "不会自动建任务", risks: "风险与依赖", riskTitle: "避免工作停滞", riskHint: "需要确认或跟进",
    workflow: "业务目标", projectProgress: "目标推进", openSchedule: "查看目标", dataConnections: "数据连接", workContext: "你的工作上下文", viewBrief: "查看资讯", darkMode: "切换深色模式", lightMode: "切换明亮模式",
    waitingSync: "等待同步", noNextStep: "飞书未设置下一步", noDate: "暂无时间", noProject: "未归类", projectSource: "业务目标聚合", goalScope: "项飞书需求 · 直接事项", active: "项进行中", completed: "项已完成", current: "当前：", noCurrentProject: "暂未发现与你直接相关的业务目标。", updatedAt: "更新于 ", priorityAction: "优先处理", priorityCount: "项优先推进", meetingCount: "个今日会议", replyCount: "条待确认消息", waitingCount: "项外部依赖", quietDay: "今天没有需要立即处理的事项", noPriority: "今天没有需要推进的工作。", noMeeting: "未来 48 小时没有需要准备的会议。", noReply: "没有需要人工确认的消息。", noRisk: "当前没有明显的截止或依赖风险。", closeout: "日终闭环", closeoutTitle: "完成与待跟进事项", closeoutCopy: "仅展示飞书已同步的完成事项和仍需跟进的风险。", nextRisk: "下一项风险：", projectDetails: "业务目标详情", projectItems: "进行项", projectNextStep: "下一步：", allPriorities: "所有优先级", today: "今天", feishuSynced: "飞书同步", feishuSyncedHint: "同步来源：飞书，状态请在飞书中更新。", prepare: "需准备", related: "关联：", viewMessage: "查看消息", addTask: "加入任务", dismiss: "忽略", messageFrom: "飞书消息", unknownSender: "未知发送人", startHere: "start here", checkDependency: "check dependency", taskList: "工作清单", myTasks: "我的任务", taskListCopy: "把今天要推进的事，放在一个可以完成的列表里。", clearCompleted: "清除已完成", deliveryCadence: "交付节奏", projectSchedule: "项目排期", projectScheduleCopy: "从计划到复盘，按状态查看每一项工作。", localSchedule: "本地排期", focusSession: "专注时段", focusOne: "一次只做一件事", currentFocus: "当前专注", selectTask: "选择一项任务开始。", startFocus: "开始专注", focusGoal: "专注目标", selectTaskHeading: "选择任务", all: "全部", open: "未完成", done: "已完成", todo: "计划中", progress: "进行中", review: "待复盘", high: "高优先级", medium: "中优先级", low: "低优先级", noTasks: "这里还没有相关任务。", noColumnTasks: "暂无任务", tableTask: "任务", tableStatus: "状态", tablePriority: "优先级", tableProject: "项目", tableSource: "来源", tableDeadline: "截止时间", tableAction: "操作", sourceLocal: "本地任务", sourceLarkTask: "飞书任务", sourceProject: "飞书 Project", sourceInferred: "飞书建议"
  },
  en: {
    navDashboard: "Overview", navInbox: "Work inbox", navToday: "Tasks", navReview: "Weekly review", navProjects: "Business goals", navFocus: "Focus", navDev: "Dev", navNews: "Brief", workspaceLabel: "Personal workspace", localData: "Local data", profileWorkspace: "Jessie's workspace", newTask: "New task", chineseFont: "Chinese font", englishFont: "English font",
    todayWorkspace: "Today", greeting: "Hello, Jessie", dailyBrief: "Daily brief", dailyBriefTitle: "Focus on the work that moves today forward", dailyBriefCopy: "Tasks, meetings, and messages are arranged around the next action. Messages become tasks only after you confirm them.", manualRefresh: "Refresh", newsScope: "AI and builders · Products · Global markets · Finance and crypto", newsSourcesCopy: "Sources are merged and edited by market, topic, recency, and importance. Every item keeps its source and the available article or briefing entry point.", newsEditorNote: "Headlines are ranked by reliability, recency, impact, and information density. Each story shows its market, topic, and importance.", newsFilterAll: "All", newsFilterAiBuilders: "AI and builders", newsFilterProduct: "Products and companies", newsFilterWorld: "Markets, policy and security", newsFilterFinanceCrypto: "Finance and crypto", providerAihot: "Chinese AI selection", providerBuilders: "AI Builder views", providerWorld: "Global intelligence", providerFinance: "Public finance flashes", providerCrypto: "Public crypto news", topicAi: "AI and models", topicMarket: "Markets and policy", topicProduct: "Products and companies", topicBuilders: "Developer ecosystem", topicSecurity: "Security", topicFinance: "Traditional finance", topicCrypto: "Crypto and on-chain", marketChina: "China", marketEurope: "Europe", marketUs: "United States", marketApac: "Asia Pacific", marketGlobal: "Global", marketCrypto: "Crypto markets",
    mustDo: "Today", priorityTitle: "Priority work", priorityHint: "Due dates, customer impact, and dependencies", meetingPrep: "Meetings", meetingTitle: "Coming up", next48Hours: "Next 48 hours", pendingMessages: "Messages to review", replyTitle: "May need a reply", noAutoTask: "Never creates tasks automatically", risks: "Risks and dependencies", riskTitle: "Prevent work from stalling", riskHint: "Needs confirmation or follow-up",
    workflow: "Business goals", projectProgress: "Goal progress", openSchedule: "View goals", dataConnections: "Connections", workContext: "Your work context", viewBrief: "View brief", darkMode: "Switch to dark mode", lightMode: "Switch to light mode",
    waitingSync: "Waiting for sync", noNextStep: "No next step is set in Feishu", noDate: "No date", noProject: "Uncategorized", projectSource: "Business-goal aggregate", goalScope: "Feishu requests · direct items", active: "active", completed: "completed", current: "Current: ", noCurrentProject: "No current business goals directly related to you were found.", updatedAt: "Updated ", priorityAction: "Priority", priorityCount: "priority items", meetingCount: "meetings today", replyCount: "messages to review", waitingCount: "external dependencies", quietDay: "Nothing needs immediate attention today", noPriority: "No work needs attention today.", noMeeting: "No meetings need preparation in the next 48 hours.", noReply: "No messages need a manual decision.", noRisk: "No clear deadline or dependency risk right now.", closeout: "Day-end summary", closeoutTitle: "Completed and follow-up items", closeoutCopy: "Shows only completed Feishu items and risks that still need follow-up.", nextRisk: "Next risk: ", projectDetails: "Business goal details", projectItems: "Active items", projectNextStep: "Next step: ", allPriorities: "All priorities", today: "Today", feishuSynced: "Feishu sync", feishuSyncedHint: "Synced from Feishu. Update its status in Feishu.", prepare: "Prepare", related: "Related: ", viewMessage: "View message", addTask: "Add task", dismiss: "Dismiss", messageFrom: "Feishu message", unknownSender: "Unknown sender", startHere: "start here", checkDependency: "check dependency", taskList: "Task list", myTasks: "My tasks", taskListCopy: "Keep today’s work in one list that you can complete.", clearCompleted: "Clear completed", deliveryCadence: "Delivery rhythm", projectSchedule: "Project schedule", projectScheduleCopy: "Review each work item from planning through follow-up.", localSchedule: "Local schedule", focusSession: "Focus session", focusOne: "Do one thing at a time", currentFocus: "Current focus", selectTask: "Choose a task to begin.", startFocus: "Start focus", focusGoal: "Focus goal", selectTaskHeading: "Choose a task", all: "All", open: "Open", done: "Done", todo: "Planned", progress: "In progress", review: "Review", high: "High priority", medium: "Medium priority", low: "Low priority", noTasks: "There are no related tasks here yet.", noColumnTasks: "No tasks", tableTask: "Task", tableStatus: "Status", tablePriority: "Priority", tableProject: "Project", tableSource: "Source", tableDeadline: "Due", tableAction: "Actions", sourceLocal: "Local", sourceLarkTask: "Feishu task", sourceProject: "Feishu Project", sourceInferred: "Feishu suggestion"
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
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!saved || typeof saved !== "object") return clone(emptyData);
    return {
      ...clone(emptyData),
      ...saved,
      tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
      taskOverrides: saved.taskOverrides && typeof saved.taskOverrides === "object" && !Array.isArray(saved.taskOverrides) ? saved.taskOverrides : {}
    };
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
function priorityColor(priority) { return { high: "#fb9380", medium: "#b58aff", low: "#73ddec" }[priority] || "#70eda0"; }

// Remove Markdown noise and long links before placing source text into a task card.
function cleanTaskCopy(value) {
  return String(value || "")
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\|\s*:?-{2,}:?\s*(?=\||$)/g, "")
    .replace(/\s*\|\s*/g, "；")
    .replace(/[>*_`#]/g, "")
    .replace(/\s+/g, " ")
    .replace(/；{2,}/g, "；")
    .trim();
}

// Turn a Markdown-style message table into a compact list of the useful outcomes.
function summarizeTaskMessage(value, limit = 180) {
  const raw = String(value || "");
  const cells = raw.split("|").map((cell) => cell.trim()).filter(Boolean);
  const headerIndex = cells.findIndex((cell) => /^(?:模式|方案|事项|用户核心诉求|典型场景)$/u.test(cell));
  if (headerIndex >= 0 && cells.length >= headerIndex + 6) {
    const prefix = cleanTaskCopy(cells.slice(0, headerIndex).join(" "));
    const rows = cells.slice(headerIndex + 3).filter((cell) => !/^:?-{2,}:?$/u.test(cell));
    const outcomes = [];
    for (let index = 0; index + 2 < rows.length && outcomes.length < 3; index += 3) {
      outcomes.push(`${cleanTaskCopy(rows[index])}：${cleanTaskCopy(rows[index + 2])}`);
    }
    const structured = cleanTaskCopy([prefix, ...outcomes].filter(Boolean).join("；")).replace(/：；/g, "：");
    if (structured) return structured.length > limit ? `${structured.slice(0, limit)}…` : structured;
  }
  const summary = cleanTaskCopy(raw);
  return summary.length > limit ? `${summary.slice(0, limit)}…` : summary;
}

// Return a concise task title while preserving the complete source through its link.
function taskDisplayTitle(task) { const text = cleanTaskCopy(task.title || "Untitled task"); return text.length > 58 ? `${text.slice(0, 58)}…` : text; }

// Locate the source message for a derived task without storing its full body locally.
function sourceMessageForTask(task) {
  if (task.source !== "lark-inferred") return null;
  return (contextData.feishu?.messages || []).find((message) => `inferred-${message.id}` === task.id || (message.link && message.link === task.link)) || null;
}

// Split a message-derived task into a readable conversation title and a bounded content summary.
function taskPresentation(task) {
  const message = sourceMessageForTask(task);
  const sourceTitle = task.sourceTitle || message?.chat || task.chat || task.title || "Untitled task";
  const rawSummary = task.summary || message?.preview || task.preview || "";
  const summary = task.source === "lark-inferred" || task.source === "message-confirmed" ? summarizeTaskMessage(rawSummary) : cleanTaskCopy(rawSummary);
  return {
    title: taskDisplayTitle({ title: sourceTitle }),
    summary: summary && summary !== cleanTaskCopy(sourceTitle) ? (summary.length > 132 ? `${summary.slice(0, 132)}…` : summary) : ""
  };
}

// State exactly why a Project item appears in Jessboard without relying on its title.
function taskRelevanceLabel(task) {
  if (task.myWorkActions?.length) return newsLanguage === "en" ? "My Project action" : "我的飞书 Project 待办";
  if (task.watchedByMe) return newsLanguage === "en" ? "Watching" : "我关注";
  if (task.inBusinessScope) return newsLanguage === "en" ? "Realtime/EOD business line" : "实时&EOD相关业务线";
  return newsLanguage === "en" ? "Related work" : "相关工作";
}

// Pick a readable label from variable Project detail response records.
function projectDetailLabel(record, fallback) {
  const value = record?.work_item_info?.name || record?.work_item?.name || record?.name || record?.title || record?.content || record?.operation_name || record?.action || record?.relationName || fallback;
  return record?.fullText ? String(value || fallback).trim() : taskDisplayTitle({ title: value });
}

// Render a compact Project-detail section from a list of source records.
function projectDetailSection(title, icon, records, fallback) {
  const rows = (records || []).slice(0, 4);
  return `<section class="project-context-section"><p class="eyebrow">${escapeHtml(title)}</p>${rows.length ? rows.map((record) => { const label = projectDetailLabel(record, fallback); const content = record.url ? `<a href="${escapeHtml(record.url)}" target="_blank" rel="noreferrer" title="${escapeHtml(label)}">${escapeHtml(label)}</a>` : `<strong title="${escapeHtml(label)}">${escapeHtml(label)}</strong>`; return `<article${record.multiline ? ' class="multiline"' : ""}><i data-lucide="${icon}"></i>${content}</article>`; }).join("") : `<p class="workspace-empty">${escapeHtml(fallback)}</p>`}</section>`;
}

// Translate synchronized workflow dates into compact schedule records for the Project dialog.
function projectScheduleRecords(records) {
  return (records || []).map((record) => ({
    title: `${record.node || "工作流阶段"}${record.start || record.end ? ` · ${formatDate(record.start || record.end, true)}${record.end && record.end !== record.start ? ` 至 ${formatDate(record.end, true)}` : ""}` : ""}`
  }));
}

// Open a Project item's authoritative context without putting private detail in the shared snapshot.
async function openProjectWorkDetail(workItemId, projectKey, taskTitle = "", sourceUrl = "") {
  if (!workItemId || !projectKey) return;
  const dialog = document.querySelector("#project-dialog");
  const cacheKey = `${projectKey}:${workItemId}`;
  const sourceLink = document.querySelector("#project-dialog-source");
  document.querySelector("#project-dialog-kicker").textContent = newsLanguage === "en" ? "Feishu Project context" : "飞书 Project 上下文";
  document.querySelector("#project-dialog-title").textContent = taskDisplayTitle({ title: taskTitle || "Project task" });
  sourceLink.href = sourceUrl || `https://project.feishu.cn/${encodeURIComponent(projectKey)}/story/detail/${encodeURIComponent(workItemId)}`;
  sourceLink.querySelector("span").textContent = newsLanguage === "en" ? "Open in Feishu" : "打开飞书项目";
  sourceLink.hidden = false;
  document.querySelector("#project-dialog-content").innerHTML = `<div class="project-context-loading"><i data-lucide="loader-circle" class="spin"></i><span>${newsLanguage === "en" ? "Loading Project context" : "正在读取飞书 Project 上下文"}</span></div>`;
  if (!dialog.open) dialog.showModal();
  lucide.createIcons();
  try {
    let detail = projectDetailCache.get(cacheKey);
    if (!detail) {
      const response = await fetch(`/api/project-work-item?projectKey=${encodeURIComponent(projectKey)}&workItemId=${encodeURIComponent(workItemId)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      detail = await response.json();
      projectDetailCache.set(cacheKey, detail);
    }
    if (detail.state === "unauthenticated") {
      document.querySelector("#project-dialog-content").innerHTML = `<div class="empty-state"><i data-lucide="key-round"></i><strong>${newsLanguage === "en" ? "Project detail needs Meegle sign-in" : "项目详情需要登录 Meegle"}</strong><span>${newsLanguage === "en" ? "The regular Project snapshot remains available." : "常规 Project 同步不受影响。"}</span></div>`;
      lucide.createIcons();
      return;
    }
    const nodes = detail.workflow?.nodes || detail.workflow?.data?.nodes || [];
    const capacity = detail.capacity?.length ? detail.capacity : projectScheduleRecords(detail.workflowSchedule);
    const scheduleTitle = detail.capacity?.length
      ? (newsLanguage === "en" ? "Your two-week workload" : "你未来两周的排期")
      : (newsLanguage === "en" ? "This item's workflow schedule" : "当前事项的工作流排期");
    const scheduleFallback = detail.capacity?.length
      ? (newsLanguage === "en" ? "No scheduled workload." : "没有已排期工作量。")
      : (newsLanguage === "en" ? "No workflow schedule is set." : "飞书未设置工作流排期。");
    const failures = detail.failures?.length ? `<p class="project-context-note">${newsLanguage === "en" ? `${detail.failures.length} detail sources were unavailable.` : `${detail.failures.length} 个详情来源暂不可用。`}</p>` : "";
    document.querySelector("#project-dialog-content").innerHTML = `<div class="project-context-summary"><div><span>${newsLanguage === "en" ? "Workflow nodes" : "工作流节点"}</span><strong>${nodes.length}</strong></div><div><span>${newsLanguage === "en" ? "Dependencies" : "依赖关系"}</span><strong>${detail.relations?.length || 0}</strong></div><div><span>${newsLanguage === "en" ? "Upcoming schedule" : "近期排期"}</span><strong>${capacity.length}</strong></div></div><div class="project-context-grid">${projectDetailSection(newsLanguage === "en" ? "Current workflow" : "当前工作流", "git-branch", nodes, newsLanguage === "en" ? "No workflow node returned." : "未返回工作流节点。")}${projectDetailSection(newsLanguage === "en" ? "Dependencies" : "依赖与关联", "git-pull-request", detail.relations, newsLanguage === "en" ? "No Project dependencies." : "没有 Project 依赖关系。")}${projectDetailSection(newsLanguage === "en" ? "Linked materials" : "关联资料", "file-text", detail.materials, newsLanguage === "en" ? "No Project link is available." : "没有可读取的 Project 关联资料。")}${projectDetailSection(newsLanguage === "en" ? "Recent changes" : "近期变更", "history", detail.operations, newsLanguage === "en" ? "No recent operation record." : "没有近期操作记录。")}${projectDetailSection(newsLanguage === "en" ? "Recent discussion" : "近期讨论", "message-square", detail.comments, newsLanguage === "en" ? "No recent comment." : "没有近期评论。")}${projectDetailSection(scheduleTitle, "calendar-range", capacity, scheduleFallback)}</div>${failures}`;
    lucide.createIcons();
  } catch (error) {
    document.querySelector("#project-dialog-content").innerHTML = `<div class="empty-state"><i data-lucide="circle-alert"></i><strong>${newsLanguage === "en" ? "Project detail is unavailable" : "项目详情暂不可用"}</strong><span>${escapeHtml(error.message || "Unknown error")}</span></div>`;
    lucide.createIcons();
  }
}

// Translate known workflow names into readable labels for the development analysis.
function workflowLabel(name) { return { "jessiecao-cam-test-runner": "CAM 测试与验收", "jessiecao-product-test-case-writer": "测试用例设计", "jessiecao-technical-solution-writer": "技术方案梳理", "jessiecao-requirement-consistency-reviewer": "需求一致性核对", "jessiecao-pm-intake": "需求资料收集" }[name] || name || "未识别流程"; }

// Derive a practical work summary and suggestion from privacy-safe session and commit aggregates.
function buildDevelopmentInsights(codex, localGit, github, codeActivity = {}) {
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
    delivery: `本周期记录 ${Number(codeActivity.commitCount || 0)} 次代码提交，覆盖 ${Number(localGit.repositoryCount || 0)} 个本机仓库；提交较多的是 ${repositories}。${github.state === "ready" ? "GitHub 与本机记录已合并展示。" : "GitHub 暂不可用，当前以本机记录补充。"}`,
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

// Derive a stable work category when the source task has no explicit type.
function taskWorkType(task) {
  if (task.workType) return task.workType;
  const text = `${task.title || ""} ${task.project || ""}`.toLowerCase();
  if (/开发|代码|接口|bug|测试|codex|github|deploy|api|code/.test(text)) return "development";
  if (/会议|沟通|回复|同步|客户|review|meeting/.test(text)) return "communication";
  if (/研究|调研|分析|数据|资讯|report|research/.test(text)) return "research";
  if (/整理|报销|行政|排期|日程|文档/.test(text)) return "operations";
  return "product";
}

// Add derived display fields and local completion overlays to synchronized or locally created work items.
function prepareTask(task) {
  const override = data.taskOverrides?.[task.id] || {};
  const presentation = taskPresentation(task);
  return {
    ...task,
    ...override,
    priority: taskPriority({ ...task, ...override }),
    workType: taskWorkType({ ...task, ...override }),
    displayTitle: presentation.title,
    displaySummary: presentation.summary
  };
}

// Return only the synchronized work relevant to the EOD group or assigned directly to Jessie.
function syncedWorkTasks() {
  return [...(contextData.feishu?.todoTasks || []), ...(contextData.feishu?.tasks || []), ...(contextData.feishu?.inferredTasks || [])]
    .filter((task) => {
      if (task.source === "feishu-project") return task.status !== "done" && (task.inBusinessScope === true || task.inRealtimeEodTeam === true || task.watchedByMe === true || task.myWorkActions?.length || task.assignedToMe === true);
      return (task.source === "lark-task" || task.source === "lark-inferred" || /实时|eod|图表/i.test(`${task.title || ""} ${task.project || ""}`)) && !isStaleTask(task);
    })
    .map(prepareTask)
    .filter((task) => !task.dismissedAt);
}

// Combine read-only synchronized work with optional browser-local personal tasks.
function visibleTasks() { return [...syncedWorkTasks(), ...data.tasks.map(prepareTask).filter((task) => !task.dismissedAt)]; }

// Recognize work explicitly tied to the real-time and EOD business scope.
function isRealtimeEodWork(task) {
  if (task.businessScope === "realtime-eod") return true;
  const text = `${task.title || ""} ${task.project || ""} ${task.nextStep || ""}`.toLowerCase();
  return /实时|eod|real-time|realtime|行情|市场数据|k线|报价|净值|估值|pnl|fundinfo|fund count|portfolio|投组|风控|风险表|监控|table view|表格视图|graph view|图表视图|时间序列|time series/.test(text);
}

// Keep direct work only when it is both in scope and assigned to the current user.
function isPersonalBusinessWork(task) {
  if (task.source === "lark-inferred") return isRealtimeEodWork(task);
  return Boolean(task.assignedToMe || task.createdByMe || task.ownerIsMe) && isRealtimeEodWork(task);
}

// Use Feishu Project's business-line scope and personal watchlist, not title keywords, for Project work.
function isRelevantProjectWork(task) {
  return task.inBusinessScope === true || task.inRealtimeEodTeam === true || task.watchedByMe === true;
}

// Read previously seen goal identities so a refresh can preserve continuity.
function loadBusinessGoalState() { try { return JSON.parse(localStorage.getItem(businessGoalStateKey) || "{\"goals\":[],\"archived\":[]}"); } catch { return { goals: [], archived: [] }; } }

// Persist the small objective history without storing source-task content separately.
function saveBusinessGoalState() { try { localStorage.setItem(businessGoalStateKey, JSON.stringify(businessGoalState)); } catch { /* Keep rendering even when local storage is unavailable. */ } }

// Rebuild product objectives from the current Feishu scope while preserving stable identities.
function currentWorkGroups() {
  const now = Date.now();
  const activeCutoff = now - 45 * 24 * 60 * 60 * 1000;
  const completedCutoff = now - 7 * 24 * 60 * 60 * 1000;
  const isClosedTask = (task) => task.status === "done" || Number(task.progress) >= 100;
  const recentlyUpdated = (task, cutoff) => {
    const timestamp = isClosedTask(task)
      ? task.updatedAt || task.createdAt
      : task.inBusinessScope === true || task.inRealtimeEodTeam === true || task.watchedByMe === true
        ? task.observedAt
        : task.updatedAt || task.createdAt;
    return new Date(timestamp || 0).getTime() >= cutoff;
  };
  const directCandidates = [...(contextData.feishu?.todoTasks || []), ...(contextData.feishu?.inferredTasks || [])]
    .filter(isPersonalBusinessWork)
    .filter((task) => !isStaleTask(task))
    .map(prepareTask);
  const directTasks = directCandidates.filter((task) => !isClosedTask(task) && recentlyUpdated(task, activeCutoff));
  const recentCompletedTasks = directCandidates.filter((task) => isClosedTask(task) && recentlyUpdated(task, completedCutoff));
  const participatingProjectTasks = (contextData.feishu?.tasks || [])
    .filter(isRelevantProjectWork)
    .filter((task) => recentlyUpdated(task, isClosedTask(task) ? completedCutoff : activeCutoff))
    .map(prepareTask);
  const taskById = new Map();
  [...participatingProjectTasks, ...directTasks, ...recentCompletedTasks].forEach((task) => taskById.set(task.id || `${task.source}-${task.title}`, task));
  const tasks = [...taskById.values()];
  const cacheKey = `${newsLanguage}:${tasks.map((task) => `${task.id || task.title}:${task.updatedAt || ""}:${task.progress || 0}`).sort().join("|")}`;
  if (businessGoalCache.key === cacheKey) return businessGoalCache.groups;
  const result = window.BusinessGoalEngine?.build(tasks, businessGoalState, newsLanguage);
  if (!result) return [];
  businessGoalState = result.state;
  saveBusinessGoalState();
  const groups = result.groups.map((group) => {
    const completed = group.tasks.filter(isClosedTask).length;
    const projectItems = group.tasks.filter((task) => task.source === "feishu-project").length;
    const directItems = group.tasks.length - projectItems;
    const progress = Math.round(group.tasks.reduce((sum, task) => sum + taskProgress(task), 0) / group.tasks.length);
    const preview = [...group.tasks].filter((task) => !isClosedTask(task)).sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))[0] || group.tasks[0];
    return { ...group, completed, active: group.tasks.length - completed, projectItems, directItems, progress, preview };
  }).filter((group) => group.active > 0).sort((left, right) => right.active - left.active || right.projectItems - left.projectItems);
  businessGoalCache = { key: cacheKey, groups };
  return groups;
}

// Explain whether the displayed objective was retained, updated, or newly discovered.
function businessGoalStatus(group) {
  if (newsLanguage === "en") return group.lifecycle === "new" ? "New objective" : group.lifecycle === "updated" ? "Updated from refresh" : "Auto-grouped";
  return group.lifecycle === "new" ? "新归纳目标" : group.lifecycle === "updated" ? "本次刷新已更新" : "自动归纳";
}

// Map a task to the delivery state that best describes the next operational action.
function businessGoalStage(task) {
  const text = `${task.title || ""} ${task.nextStep || ""} ${task.action || ""}`.toLowerCase();
  if (task.status === "done" || Number(task.progress) >= 100) return "delivered";
  if (task.status === "review" || taskProgress(task) >= 75) return "verification";
  if (task.state?.key === "waiting" || /等待|确认|依赖|阻塞|回复|审批/.test(text)) return "waiting";
  return "execution";
}

// Summarize one objective into the four delivery states shown in the dashboard.
function businessGoalStageSummary(group) {
  const summary = { waiting: 0, execution: 0, verification: 0, delivered: 0 };
  group.tasks.forEach((task) => { summary[businessGoalStage(task)] += 1; });
  return summary;
}

// Group contributing work by its real Feishu Project source or direct-work origin.
function businessGoalSources(group) {
  const sources = new Map();
  group.tasks.forEach((task) => {
    const isProject = task.source === "feishu-project";
    const name = isProject ? (task.project || "未命名飞书 Project") : "直接事项";
    const key = `${isProject ? "project" : "direct"}:${name}`;
    const source = sources.get(key) || { name, kind: isProject ? "project" : "direct", total: 0, active: 0, completed: 0 };
    source.total += 1;
    if (task.status === "done" || Number(task.progress) >= 100) source.completed += 1;
    else source.active += 1;
    sources.set(key, source);
  });
  return [...sources.values()].sort((left, right) => right.active - left.active || right.total - left.total || left.name.localeCompare(right.name, "zh-CN"));
}

// Render the objective composition and stage distribution for quick dashboard decisions.
function renderGoalPortfolio() {
  const target = document.querySelector("#goal-portfolio");
  if (!target) return;
  const groups = currentWorkGroups();
  const totalActive = groups.reduce((sum, group) => sum + group.active, 0);
  const stages = [
    ["waiting", "待确认", "需要外部确认或依赖"],
    ["execution", "推进中", "正在执行"],
    ["verification", "验证中", "等待验证或验收"],
    ["delivered", "已交付", "已完成的近期事项"]
  ];
  if (!groups.length) {
    target.innerHTML = "";
    return;
  }
  target.innerHTML = `<section class="goal-composition"><div class="goal-portfolio-heading"><div><p class="eyebrow">当前投入</p><h3>工作主要服务哪些业务目标</h3></div><span>相关业务线及我关注 · ${totalActive} 项</span></div><div class="goal-composition-map">${groups.map((group) => {
    const share = totalActive ? Math.round(group.active / totalActive * 100) : 0;
    return `<button class="goal-composition-cell" data-goal-workspace="${escapeHtml(group.name)}" type="button" style="--goal-color:${group.color};--goal-weight:${Math.max(group.active, 1)}" aria-label="查看业务目标：${escapeHtml(group.name)}"><span>${share}% 当前投入</span><strong>${escapeHtml(group.name)}</strong><small>${group.active} 项进行中 · ${group.projectItems} 项飞书需求</small></button>`;
  }).join("")}</div></section><section class="goal-stage-overview"><div class="goal-portfolio-heading"><div><p class="eyebrow">交付状态</p><h3>工作当前卡在哪个环节</h3></div><span>按近期参与事项统计</span></div><div class="goal-stage-legend">${stages.map(([key, label]) => `<span class="${key}"><i></i>${label}</span>`).join("")}</div><div class="goal-stage-rows">${groups.map((group) => {
    const summary = businessGoalStageSummary(group);
    const total = group.tasks.length || 1;
    const status = stages.map(([key, label]) => summary[key] ? `${label} ${summary[key]} 项` : "").filter(Boolean).join(" · ");
    return `<button class="goal-stage-row" data-goal-workspace="${escapeHtml(group.name)}" type="button"><span class="goal-stage-name"><i style="background:${group.color}"></i>${escapeHtml(group.name)}</span><span class="goal-stage-track" aria-label="${escapeHtml(group.name)}：${escapeHtml(status)}">${stages.map(([key]) => summary[key] ? `<i class="${key}" style="width:${summary[key] / total * 100}%"></i>` : "").join("")}</span><small>${escapeHtml(status || "暂无近期事项")}</small></button>`;
  }).join("")}</div></section>`;
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

// Return a readable source label for the task table.
function taskSourceLabel(task) {
  const labels = { "lark-task": t("sourceLarkTask"), "feishu-project": t("sourceProject"), "lark-inferred": t("sourceInferred") };
  if (task.source === "feishu-project" && task.myWorkActions?.length) return newsLanguage === "en" ? "My Project action" : "我的飞书 Project 待办";
  return labels[task.source] || t("sourceLocal");
}

// Build an individual task row for a task list.
function taskRow(task, includeDelete = true) {
  const done = task.status === "done";
  const sourceAuthoritative = task.source === "lark-task" || task.source === "feishu-project";
  const title = task.displayTitle || taskDisplayTitle(task);
  const summary = task.displaySummary || "";
  const sourceLink = task.link || "";
  const sourceRow = sourceLink ? ` data-task-link="${escapeHtml(sourceLink)}" role="link" tabindex="0" aria-label="打开来源：${escapeHtml(task.title)}"` : "";
  const completionControl = sourceAuthoritative ? "" : `<button class="task-toggle" data-toggle-task="${escapeHtml(task.id)}" type="button" aria-label="${done ? "标记未完成" : "标记完成"}：${escapeHtml(task.title)}" title="${done ? "标记未完成" : "标记完成"}">${done ? "<i data-lucide=\"check\"></i>" : ""}</button>`;
  const sourceControl = sourceLink ? `<a class="task-source-open" href="${escapeHtml(sourceLink)}" target="_blank" rel="noreferrer" aria-label="在飞书中打开：${escapeHtml(task.title)}" title="在飞书中打开"><i data-lucide="arrow-up-right"></i></a>` : "";
  const sourceInline = sourceLink && !sourceAuthoritative ? sourceControl : "";
  const controls = `${completionControl}${sourceAuthoritative ? sourceControl : ""}`;
  const deleteControl = includeDelete && !sourceAuthoritative ? `<button class="task-delete" data-delete-task="${escapeHtml(task.id)}" type="button" aria-label="删除任务：${escapeHtml(task.title)}" title="删除任务"><i data-lucide="trash-2"></i></button>` : "";
  if (taskLayout === "table") {
    return `<article class="task-row ${done ? "done" : ""}"${sourceRow} style="--task-color:${priorityColor(task.priority)}">
      <div class="task-table-title" title="${escapeHtml(task.title)}">${escapeHtml(title)}</div>
      <span class="task-table-status">${t(task.status)}</span>
      <span class="task-table-priority"><span class="status-chip ${task.priority === "high" ? "orange" : "pale"}">${t(task.priority)}</span></span>
      <span class="task-table-project" title="${escapeHtml(task.project || t("noProject"))}">${escapeHtml(task.project || t("noProject"))}</span>
      <span class="task-table-source">${taskSourceLabel(task)}</span>
      <span class="task-due">${escapeHtml(formatDate(task.dueAt || task.due))}</span>
      <div class="task-table-actions">${controls}${deleteControl}</div>
    </article>`;
  }
  if (taskLayout === "card") {
    const detail = summary || cleanTaskCopy(task.nextStep || task.action || "");
    const origin = task.project || taskSourceLabel(task);
    return `<article class="task-row task-card ${done ? "done" : ""}"${sourceRow} style="--task-color:${priorityColor(task.priority)}">
      <div class="task-card-primary">
        ${completionControl || sourceControl}
        <div class="task-copy"><div class="task-title" title="${escapeHtml(task.title)}">${escapeHtml(title)}</div>${detail ? `<p class="task-summary" title="${escapeHtml(detail)}">${escapeHtml(detail)}</p>` : ""}</div>
      </div>
      <footer class="task-card-footer">
        <div class="task-meta"><span class="status-chip ${task.priority === "high" ? "orange" : "pale"}">${t(task.priority)}</span><span class="task-card-origin">${escapeHtml(origin)}</span></div>
        <div class="task-card-actions"><span class="task-due">${escapeHtml(formatDate(task.dueAt || task.due))}</span>${sourceInline}${deleteControl}</div>
      </footer>
    </article>`;
  }
  return `<article class="task-row ${done ? "done" : ""}"${sourceRow} style="--task-color:${priorityColor(task.priority)}">
    ${completionControl || sourceControl}
    <div class="task-copy"><div class="task-title" title="${escapeHtml(task.title)}">${escapeHtml(title)}</div>${summary ? `<p class="task-summary" title="${escapeHtml(summary)}">${escapeHtml(summary)}</p>` : ""}<div class="task-meta"><span class="status-chip ${task.priority === "high" ? "orange" : "pale"}">${t(task.priority)}</span> ${escapeHtml(task.project || t("noProject"))}${sourceInline}</div></div>
    <span class="task-due">${escapeHtml(formatDate(task.dueAt || task.due))}</span>
    ${deleteControl || "<span class=\"task-row-spacer\" aria-hidden=\"true\"></span>"}
  </article>`;
}

// Convert a task due value into a safe timestamp for range filters and ordering.
function taskDueTime(task) {
  const time = new Date(task.dueAt || task.due || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

// Keep task ranges honest by filtering against due dates, never only changing a label.
function matchesTaskRange(task) {
  if (taskRange === "all") return true;
  const due = taskDueTime(task);
  if (!due) return taskRange === "later";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endToday = startToday + 24 * 60 * 60 * 1000;
  const endWeek = startToday + 7 * 24 * 60 * 60 * 1000;
  if (taskRange === "overdue") return task.status !== "done" && due < startToday;
  if (taskRange === "today") return due >= startToday && due < endToday;
  if (taskRange === "week") return due >= startToday && due < endWeek;
  return due >= endWeek;
}

// Label tasks for the time-axis view using practical work buckets.
function taskTimeBucket(task) {
  const due = taskDueTime(task);
  if (!due) return { key: "later", label: "稍后安排" };
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endToday = startToday + 24 * 60 * 60 * 1000;
  const endWeek = startToday + 7 * 24 * 60 * 60 * 1000;
  if (task.status !== "done" && due < startToday) return { key: "overdue", label: "已逾期" };
  if (due < endToday) return { key: "today", label: "今天" };
  if (due < endWeek) return { key: "week", label: "未来 7 天" };
  return { key: "later", label: "稍后安排" };
}

// Keep the custom task-range menu synchronized with the active data filter.
function renderTaskRangeMenu() {
  const label = document.querySelector("#task-range-label");
  const menu = document.querySelector("#task-range-menu");
  const trigger = document.querySelector("#task-range-trigger");
  if (!label || !menu || !trigger) return;
  label.textContent = taskScopeLabel || taskRangeLabels[taskRange] || taskRangeLabels.all;
  menu.classList.remove("open");
  trigger.setAttribute("aria-expanded", "false");
  document.querySelectorAll("[data-task-range]").forEach((option) => {
    const selected = !taskScopeIds && option.dataset.taskRange === taskRange;
    option.classList.toggle("active", selected);
    option.setAttribute("aria-selected", String(selected));
  });
}

// Return unfinished tasks whose latest activity falls within the current Monday-to-Sunday week.
function currentWeekPendingTasks(tasks = visibleTasks()) {
  const now = Date.now();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
  const weekEnd = weekStart.getTime() + 7 * 24 * 60 * 60 * 1000;
  return tasks.filter((task) => {
    const activity = new Date(task.completedAt || task.updatedAt || task.createdAt || task.dueAt || task.due || 0).getTime();
    return task.status !== "done" && Number(task.progress) < 100 && activity >= weekStart.getTime() && activity < weekEnd;
  });
}

// Render completion, work-type, and activity statistics from this week's task changes.
function renderInsights() {
  const target = document.querySelector("#insight-grid");
  if (!target) return;
  const tasks = visibleTasks();
  const now = Date.now();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
  const weekEnd = weekStart.getTime() + 7 * 24 * 60 * 60 * 1000;
  const taskActivityTime = (task) => new Date(task.completedAt || task.updatedAt || task.createdAt || task.dueAt || task.due || 0).getTime();
  const weeklyTasks = tasks.filter((task) => { const timestamp = taskActivityTime(task); return timestamp >= weekStart.getTime() && timestamp < weekEnd; });
  const completed = weeklyTasks.filter((task) => task.status === "done" || Number(task.progress) >= 100).length;
  const pendingTasks = currentWeekPendingTasks(tasks);
  const open = pendingTasks.length;
  const completionRate = weeklyTasks.length ? Math.round(completed / weeklyTasks.length * 100) : 0;
  const typeLabels = { product: "产品", development: "开发", communication: "沟通", research: "研究", operations: "行政", other: "其他" };
  const knownTypeKeys = new Set(Object.keys(typeLabels).filter((key) => key !== "other"));
  const typeCounts = Object.entries(typeLabels).map(([key, label]) => ({ key, label, count: key === "other" ? weeklyTasks.filter((task) => !knownTypeKeys.has(task.workType)).length : weeklyTasks.filter((task) => task.workType === key).length })).sort((left, right) => right.count - left.count);
  const leadType = typeCounts[0] || { label: "暂无", count: 0 };
  const leadShare = weeklyTasks.length ? Math.round(leadType.count / weeklyTasks.length * 100) : 0;
  const typeDistribution = typeCounts.filter((item) => item.count > 0).map((item, index) => ({ ...item, segment: index + 1, share: weeklyTasks.length ? Math.round(item.count / weeklyTasks.length * 100) : 0 }));
  const typeLegend = typeDistribution.slice(1);
  const weeklyActivity = [3, 2, 1, 0].map((offset) => {
    const end = now - offset * 7 * 24 * 60 * 60 * 1000;
    const start = end - 7 * 24 * 60 * 60 * 1000;
    return tasks.filter((task) => {
      const timestamp = taskActivityTime(task);
      return timestamp >= start && timestamp < end;
    }).length;
  });
  const maxActivity = Math.max(...weeklyActivity, 1);
  const activityTotal = weeklyActivity.reduce((sum, value) => sum + value, 0);
  const weeklyLabels = ["4 周前", "3 周前", "2 周前", "本周"];
  target.innerHTML = `
    <article class="metric-card metric-card-completion"><p class="eyebrow">本周完成情况</p><div class="stat-main"><div class="stat-gauge" style="--completion:${completionRate}%"><div><strong>${completionRate}%</strong><small>完成率</small></div></div><div class="stat-meta"><strong>${completed}</strong><span>本周已完成</span><span>${open} 项仍待推进</span></div><div class="completion-aside"><strong>${weeklyTasks.length}</strong><span>本周有更新</span></div></div><div class="stat-foot"><span>周一至周日的任务进度</span><button class="metric-link" data-show-week-pending type="button" aria-label="查看本周待处理任务">待处理 ${open}<i data-lucide="arrow-up-right"></i></button></div></article>
    <article class="metric-card metric-card-types"><p class="eyebrow">本周任务类型</p><div class="type-summary"><div><strong>${leadShare}%</strong><span>${leadType.label}工作</span></div><div><strong>${weeklyTasks.length}</strong><span>本周有更新</span></div></div><div class="type-bar" aria-label="本周任务类型占比">${typeDistribution.map((item) => `<span class="type-segment-${item.segment}" style="width:${item.share}%"></span>`).join("")}</div><div class="type-list">${typeLegend.map((item) => `<div><i class="type-segment-${item.segment}"></i><span>${item.label}</span><strong>${item.share}%</strong></div>`).join("")}</div></article>
    <article class="metric-card metric-card-activity"><p class="eyebrow">近期工作动态</p><p class="activity-explainer">按任务创建、更新和完成计数。柱子越高，表示那一周的工作变动越多。</p><div class="stat-bars" aria-label="最近四周任务变动">${weeklyActivity.map((value, index) => `<span class="${index === weeklyActivity.length - 1 ? "active" : ""}" style="height:${Math.max(12, Math.round(value / maxActivity * 100))}%"><b>${value}</b><small>${weeklyLabels[index]}</small></span>`).join("")}</div><div class="stat-foot"><span>最近 4 周</span><span>${activityTotal} 次任务变动</span></div></article>`;
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
  const sentAt = message.createdAt || message.updatedAt;
  return `<article class="reply-item"><div class="reply-item-head"><div><span class="brief-state">${escapeHtml(message.reason)}</span><h4 title="${escapeHtml(message.chat)}">${escapeHtml(message.chat || t("messageFrom"))}</h4></div><div class="reply-item-meta"><span>${escapeHtml(message.sender || t("unknownSender"))}</span><time>${escapeHtml(formatDate(sentAt, true))}</time></div></div><p>${escapeHtml(message.preview)}</p><div class="reply-actions"><a class="reply-action" href="${escapeHtml(message.link || "#")}" ${message.link ? "target=\"_blank\" rel=\"noreferrer\"" : ""}>${t("viewMessage")}</a><button class="reply-action" data-add-message-task="${escapeHtml(message.id)}" type="button">${t("addTask")}</button><button class="reply-action dismiss" data-dismiss-message="${escapeHtml(message.id)}" type="button">${t("dismiss")}</button></div></article>`;
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
  const priorityItems = brief.priorities.slice(0, 3);
  const meetingItems = brief.meetings.slice(0, 3);
  [[".priority-brief", brief.priorities.length], [".meeting-brief", meetingItems.length], [".reply-brief", brief.reply.length], [".risk-brief", brief.risks.length]].forEach(([selector, count]) => {
    document.querySelector(selector)?.classList.toggle("is-empty", !count);
  });
  const morePriorities = brief.priorities.length > priorityItems.length ? `<button class="brief-more" data-go-to="today" type="button">查看全部 ${brief.priorities.length} 项 <i data-lucide="arrow-right"></i></button>` : "";
  document.querySelector("#daily-priority-list").innerHTML = `${priorityItems.map((task, index) => dailyBriefTaskItem(task, index === 0 ? { color: "amber", note: t("startHere") } : null)).join("")}${morePriorities}` || syncCue;
  document.querySelector("#daily-meeting-list").innerHTML = meetingItems.map(dailyBriefMeetingItem).join("") || `<p class="brief-empty">${t("noMeeting")}</p>`;
  document.querySelector("#daily-reply-list").innerHTML = brief.reply.map(dailyBriefReplyItem).join("") || `<p class="brief-empty">${t("noReply")}</p>`;
  document.querySelector("#daily-risk-list").innerHTML = brief.risks.map((task, index) => dailyBriefTaskItem(task, index === 0 ? { color: "red", note: t("checkDependency") } : null)).join("") || `<p class="brief-empty">${t("noRisk")}</p>`;
  const closeout = document.querySelector("#daily-closeout");
  const hasCloseout = brief.closed.length > 0 || brief.risks.length > 0;
  closeout.hidden = !hasCloseout;
  if (!hasCloseout) {
    closeout.innerHTML = "";
    return;
  }
  const closed = brief.closed.map((task) => `<div class="closeout-done"><i data-lucide="check-circle-2"></i><span>${escapeHtml(taskDisplayTitle(task))}</span></div>`).join("");
  const risk = brief.risks[0];
  const followUpLink = risk?.link ? `<a class="brief-open" href="${escapeHtml(risk.link)}" target="_blank" rel="noreferrer" aria-label="在飞书中打开：${escapeHtml(risk.title)}" title="在飞书中打开"><i data-lucide="arrow-up-right"></i></a>` : "";
  const followUp = risk ? `<article class="closeout-risk"><i class="risk-icon" data-lucide="triangle-alert"></i><div><span class="closeout-risk-label">${t("nextRisk")}</span><strong>${escapeHtml(taskDisplayTitle(risk))}</strong><p><span>${escapeHtml(risk.reason)}</span><span>·</span><span>${escapeHtml(risk.action)}</span></p></div>${followUpLink}</article>` : "";
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
  const query = taskSearch.trim().toLowerCase();
  const filtered = tasks.filter((task) => (!taskScopeIds || taskScopeIds.has(task.id)) && (taskFilter === "all" || (taskFilter === "open" ? task.status !== "done" : task.status === "done")) && (priorityFilter === "all" || task.priority === priorityFilter) && matchesTaskRange(task) && (!query || `${task.title || ""} ${task.project || ""}`.toLowerCase().includes(query))).sort((left, right) => taskDueTime(left) - taskDueTime(right) || (left.status === "done") - (right.status === "done"));
  document.querySelector('[data-task-filter="all"]').textContent = `${t("all")} ${tasks.length}`;
  document.querySelector('[data-task-filter="open"]').textContent = `${t("open")} ${tasks.filter((task) => task.status !== "done").length}`;
  document.querySelector('[data-task-filter="done"]').textContent = `${t("done")} ${tasks.filter((task) => task.status === "done").length}`;
  document.querySelector('[data-priority-filter="all"]').textContent = t("allPriorities");
  ["high", "medium", "low"].forEach((priority) => { document.querySelector(`[data-priority-filter="${priority}"]`).textContent = t(priority); });
  document.querySelector("#task-list-count").textContent = newsLanguage === "en" ? `${filtered.length} items` : `${filtered.length} 项`;
  const list = document.querySelector("#all-task-list");
  list.dataset.layout = taskLayout;
  renderTaskRangeMenu();
  document.querySelectorAll("[data-task-layout]").forEach((tab) => tab.classList.toggle("active", tab.dataset.taskLayout === taskLayout));
  if (taskLayout === "week") {
    list.innerHTML = renderWeeklySchedule(filtered);
    document.querySelector("#task-pagination").innerHTML = "";
    return;
  }
  const pageCount = Math.max(1, Math.ceil(filtered.length / taskPageSize));
  taskPage = Math.min(taskPage, pageCount - 1);
  const pageTasks = filtered.slice(taskPage * taskPageSize, (taskPage + 1) * taskPageSize);
  const renderTask = (task) => taskRow(task, task.source !== "lark-task" && task.source !== "feishu-project");
  if (taskLayout === "block") {
    const buckets = new Map();
    pageTasks.forEach((task) => { const bucket = taskTimeBucket(task); if (!buckets.has(bucket.key)) buckets.set(bucket.key, { ...bucket, tasks: [] }); buckets.get(bucket.key).tasks.push(task); });
    list.innerHTML = [...buckets.values()].map((bucket) => `<section class="task-time-group task-time-${bucket.key}"><div class="task-time-heading"><span>${bucket.label}</span><small>${bucket.tasks.length} 项</small></div>${bucket.tasks.map(renderTask).join("")}</section>`).join("") || `<div class="empty-state"><i data-lucide="inbox"></i><span>${t("noTasks")}</span></div>`;
  } else {
    const tableHead = taskLayout === "table" && pageTasks.length ? `<div class="task-table-heading"><span>${t("tableTask")}</span><span>${t("tableStatus")}</span><span>${t("tablePriority")}</span><span>${t("tableProject")}</span><span>${t("tableSource")}</span><span>${t("tableDeadline")}</span><span>${t("tableAction")}</span></div>` : "";
    list.innerHTML = `${tableHead}${pageTasks.map(renderTask).join("")}` || `<div class="empty-state"><i data-lucide="inbox"></i><span>${t("noTasks")}</span></div>`;
  }
  document.querySelector("#task-pagination").innerHTML = filtered.length > taskPageSize ? `<span>显示 ${taskPage * taskPageSize + 1}-${Math.min((taskPage + 1) * taskPageSize, filtered.length)} / ${filtered.length}</span><div><button class="icon-button" data-task-page="${taskPage - 1}" ${taskPage === 0 ? "disabled" : ""} type="button" aria-label="上一页" title="上一页"><i data-lucide="arrow-left"></i></button><button class="icon-button" data-task-page="${taskPage + 1}" ${taskPage >= pageCount - 1 ? "disabled" : ""} type="button" aria-label="下一页" title="下一页"><i data-lucide="arrow-right"></i></button></div>` : "";
}

// Open the exact unfinished task set counted by the weekly completion card.
function showWeekPendingTasks() {
  taskScopeIds = new Set(currentWeekPendingTasks().map((task) => task.id).filter(Boolean));
  taskScopeLabel = newsLanguage === "en" ? "Pending this week" : "本周待处理";
  taskFilter = "open";
  priorityFilter = "all";
  taskRange = "all";
  taskSearch = "";
  taskPage = 0;
  document.querySelector("#task-search").value = "";
  document.querySelectorAll("[data-task-filter]").forEach((tab) => tab.classList.toggle("active", tab.dataset.taskFilter === "open"));
  document.querySelectorAll("[data-priority-filter]").forEach((tab) => tab.classList.toggle("active", tab.dataset.priorityFilter === "all"));
  setView("today");
  renderAllTasks();
  lucide.createIcons();
}

// Render the next seven days as one schedule for tasks and calendar events.
function renderWeeklySchedule(tasks) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const meetings = (contextData.feishu?.schedule || []).filter((item) => item.source === "lark-calendar");
  const days = Array.from({ length: 7 }, (_, offset) => {
    const start = new Date(today);
    start.setDate(start.getDate() + offset);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const dayTasks = tasks.filter((task) => { const due = taskDueTime(task); return due >= start.getTime() && due < end.getTime(); });
    const dayMeetings = meetings.filter((item) => { const startTime = new Date(item.start || item.startAt || 0).getTime(); return startTime >= start.getTime() && startTime < end.getTime(); });
    const dateLabel = new Intl.DateTimeFormat("zh-CN", { weekday: "short", month: "numeric", day: "numeric" }).format(start);
    return `<section class="week-day ${offset === 0 ? "today" : ""}"><header><strong>${offset === 0 ? "今天" : dateLabel}</strong><span>${dayTasks.length + dayMeetings.length} 项安排</span></header><div class="week-day-items">${dayMeetings.map((item) => `<a class="week-entry meeting" href="${escapeHtml(item.link || "#")}" ${item.link ? "target=\"_blank\" rel=\"noreferrer\"" : ""}><i data-lucide="calendar-clock"></i><span><strong>${escapeHtml(item.title || "日程")}</strong><small>${escapeHtml(formatDate(item.start || item.startAt, true))}</small></span></a>`).join("")}${dayTasks.map((task) => `<button class="week-entry task" data-go-to="today" type="button"><i data-lucide="${task.status === "done" ? "check-circle-2" : "circle"}"></i><span><strong>${escapeHtml(task.displayTitle)}</strong><small>${escapeHtml(task.project || t("noProject"))}</small></span></button>`).join("") || "<p class=\"week-empty\">暂无安排</p>"}</div></section>`;
  });
  return `<div class="week-schedule" aria-label="未来七天日程">${days.join("")}</div>`;
}

// Render messages, risks, and nearby commitments that need a human decision.
function renderInbox() {
  const brief = window.DailyBrief?.build(contextData, { ignoredMessageIds: [...dismissedBriefMessages] }) || { reply: [], risks: [] };
  const messages = brief.reply || [];
  const risks = brief.risks || [];
  const now = Date.now();
  const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
  const meetings = [...(contextData.feishu?.schedule || [])]
    .filter((item) => item.source === "lark-calendar")
    .map((item) => ({ type: "meeting", timestamp: new Date(item.start || item.startAt || 0).getTime(), item }))
    .filter((entry) => entry.timestamp >= now && entry.timestamp < weekEnd);
  const deadlines = visibleTasks()
    .filter((task) => task.status !== "done")
    .map((task) => ({ type: "deadline", timestamp: taskDueTime(task), task }))
    .filter((entry) => Number.isFinite(entry.timestamp) && entry.timestamp >= now && entry.timestamp < weekEnd);
  const upcoming = [...meetings, ...deadlines].sort((left, right) => left.timestamp - right.timestamp).slice(0, 4);
  document.querySelector("#inbox-summary").textContent = `${messages.length + risks.length} 项需要决定`;
  document.querySelector("#inbox-message-count").textContent = `${messages.length} 条`;
  document.querySelector("#inbox-risk-count").textContent = `${risks.length} 项`;
  const badge = document.querySelector("#inbox-nav-count");
  badge.textContent = String(messages.length + risks.length);
  badge.hidden = messages.length + risks.length === 0;
  document.querySelector("#inbox-message-list").innerHTML = messages.map((message) => `<article class="inbox-item"><span class="inbox-item-kicker">${escapeHtml(message.reason)}</span><h3>${escapeHtml(message.chat || t("messageFrom"))}</h3><p>${escapeHtml(message.preview)}</p><footer><span>${escapeHtml(message.sender || t("unknownSender"))}</span><div><a class="text-button" href="${escapeHtml(message.link || "#")}" ${message.link ? "target=\"_blank\" rel=\"noreferrer\"" : ""}>查看</a><button class="text-button" data-add-message-task="${escapeHtml(message.id)}" type="button">转任务</button><button class="text-button muted-action" data-dismiss-message="${escapeHtml(message.id)}" type="button">忽略</button></div></footer></article>`).join("") || "<div class=\"empty-state\"><i data-lucide=\"inbox\"></i><span>没有需要人工确认的消息。</span></div>";
  document.querySelector("#inbox-risk-list").innerHTML = risks.map((task) => `<article class="inbox-item risk"><span class="inbox-item-kicker">${escapeHtml(task.reason)}</span><h3>${escapeHtml(taskDisplayTitle(task))}</h3><p>${escapeHtml(task.action)}</p><footer><span>${escapeHtml(task.due ? formatDate(task.due, true) : t("noDate"))}</span>${task.link ? `<a class="text-button" href="${escapeHtml(task.link)}" target="_blank" rel="noreferrer">在飞书中打开</a>` : ""}</footer></article>`).join("") || "<div class=\"empty-state\"><i data-lucide=\"shield-check\"></i><span>当前没有明显的截止或依赖风险。</span></div>";
  document.querySelector("#inbox-upcoming-list").innerHTML = upcoming.map((entry) => {
    if (entry.type === "deadline") {
      const task = entry.task;
      return `<article class="inbox-item compact deadline"><span class="inbox-item-kicker">截止 ${escapeHtml(formatDate(task.dueAt || task.due, true))}</span><h3>${escapeHtml(taskDisplayTitle(task))}</h3><p>${escapeHtml(task.project || t("noProject"))}</p><button class="text-button" data-go-to="today" type="button">查看任务</button></article>`;
    }
    const item = entry.item;
    return `<article class="inbox-item compact"><span class="inbox-item-kicker">${escapeHtml(formatDate(item.start || item.startAt, true))}</span><h3>${escapeHtml(item.title || "日程")}</h3><p>${escapeHtml(item.availability === "busy" ? "预留准备时间，避免和任务截止冲突。" : "可安排用于推进本周任务。")}</p>${item.link ? `<a class="text-button" href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">打开日程</a>` : ""}</article>`;
  }).join("") || "<div class=\"empty-state\"><i data-lucide=\"calendar-check\"></i><span>未来七天没有已同步的日程。</span></div>";
  document.querySelector("#inbox-upcoming-summary").innerHTML = `<span>${meetings.length} 个日程 · ${deadlines.length} 个任务截止</span><button class="text-button" data-go-to="projects" type="button">查看完整排期 <i data-lucide="arrow-up-right"></i></button>`;
}

// Summarize the last seven days and show the work that needs a new plan.
function renderWeeklyReview() {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const tasks = visibleTasks();
  const completed = tasks.filter((task) => task.status === "done" && new Date(task.completedAt || task.updatedAt || 0).getTime() >= weekAgo);
  const carryover = tasks.filter((task) => task.status !== "done" && (taskDueTime(task) < now || new Date(task.updatedAt || task.createdAt || 0).getTime() < weekAgo)).sort((left, right) => taskDueTime(left) - taskDueTime(right));
  const next = tasks.filter((task) => task.status !== "done" && taskDueTime(task) >= now && taskDueTime(task) < now + 14 * 24 * 60 * 60 * 1000).sort((left, right) => taskDueTime(left) - taskDueTime(right)).slice(0, 5);
  const riskCount = (window.DailyBrief?.build(contextData, { ignoredMessageIds: [...dismissedBriefMessages] }).risks || []).length;
  document.querySelector("#review-summary").innerHTML = [[completed.length, "本周完成"], [carryover.length, "需要重新安排"], [riskCount, "仍有风险或依赖"], [next.length, "下周已排入重点"]].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("");
  const entry = (task, note) => `<article class="review-item"><span class="priority-dot" style="--task-color:${priorityColor(task.priority)}"></span><div><strong>${escapeHtml(task.displayTitle)}</strong><p>${escapeHtml(note || task.nextStep || task.action || task.project || t("noProject"))}</p></div><span>${escapeHtml(task.dueAt || task.due ? formatDate(task.dueAt || task.due) : t("noDate"))}</span></article>`;
  document.querySelector("#review-completed-list").innerHTML = completed.slice(0, 5).map((task) => entry(task, task.project || "已完成并保留为本周记录")).join("") || "<p class=\"review-empty\">本周还没有同步到已完成事项。</p>";
  document.querySelector("#review-carryover-list").innerHTML = carryover.slice(0, 5).map((task) => entry(task, taskDueTime(task) < now ? "已超过原定时间，需要重新确认下一步。" : "近期没有进展，建议决定继续或暂缓。" )).join("") || "<p class=\"review-empty\">没有需要重新安排的遗留事项。</p>";
  document.querySelector("#review-next-list").innerHTML = next.map((task) => entry(task, task.nextStep || "保留在下周计划中，确认负责人与截止时间。")).join("") || "<p class=\"review-empty\">下周尚未安排带截止时间的重点任务。</p>";
}

// Render active business objectives with their underlying Feishu-work scope.
function renderProjects() {
  const target = document.querySelector("#project-cards");
  if (!target) return;
  const groups = currentWorkGroups();
  target.innerHTML = groups.map((group) => `<button class="project-card" data-project-group="${escapeHtml(group.name)}" style="--project-color:${group.color}" type="button" aria-label="${escapeHtml(t("projectDetails"))}：${escapeHtml(group.name)}"><div class="project-card-top"><span class="status-chip ${group.emerging ? "orange" : "pale"}">${businessGoalStatus(group)}</span><span class="project-percent">${group.progress}%</span></div><h3>${escapeHtml(group.name)}</h3><p class="project-goal-summary">${escapeHtml(group.summary)}</p><p>${group.active} ${t("active")} · ${newsLanguage === "en" ? `${group.completed} completed this week` : `本周完成 ${group.completed} 项`}</p><div class="project-goal-scope">${newsLanguage === "en" ? `${group.projectItems} Feishu requests · ${group.directItems} direct items` : `${group.projectItems} 项飞书需求 · ${group.directItems} 项直接事项`} · ${newsLanguage === "en" ? `Focus: ${group.focus}` : `当前焦点：${group.focus}`}</div><div class="progress-line"><span style="width:${group.progress}%"></span></div><div class="project-task-preview"><span title="${escapeHtml(group.preview?.title || "")}">${t("current")}${escapeHtml(taskDisplayTitle(group.preview || {}))}</span><span>${escapeHtml(group.preview?.nextStep || t("waitingSync"))}</span></div></button>`).join("") || `<div class="empty-state"><i data-lucide="folder-open"></i><span>${t("noCurrentProject")}</span></div>`;
}

// Open a detailed progress view for one current-work group.
function openProjectDialog(name) {
  const group = currentWorkGroups().find((item) => item.name === name);
  if (!group) return;
  const dialog = document.querySelector("#project-dialog");
  document.querySelector("#project-dialog-kicker").textContent = businessGoalStatus(group);
  document.querySelector("#project-dialog-title").textContent = group.name;
  const tasks = (group.tasks || []).filter((task) => task.status !== "done" && Number(task.progress) < 100);
  document.querySelector("#project-dialog-content").innerHTML = `<p class="business-goal-summary">${escapeHtml(group.summary)}</p><div class="project-dialog-summary"><div><strong>${group.progress}%</strong><span>${t("projectProgress")}</span></div><div><strong>${group.active}</strong><span>${t("projectItems")}</span></div><div><strong>${group.projectItems}</strong><span>${newsLanguage === "en" ? "Feishu requests" : "飞书需求"}</span></div></div><div class="project-detail-list">${tasks.map((task) => `<article class="project-detail-item"><div class="project-detail-top"><div><h3>${escapeHtml(taskDisplayTitle(task))}</h3><p>${escapeHtml(task.project || t("noProject"))} · ${escapeHtml(taskRelevanceLabel(task))}</p></div><span class="status-chip ${task.priority === "high" ? "orange" : "pale"}">${t(task.priority)}</span></div><div class="project-detail-progress"><span><i style="width:${taskProgress(task)}%"></i></span><strong>${taskProgress(task)}%</strong></div><p class="project-detail-next">${t("projectNextStep")}${escapeHtml(task.nextStep || task.action || t("noNextStep"))}</p>${task.source === "feishu-project" && task.projectKey && task.workItemId ? `<button class="project-context-button" data-project-work-item="${escapeHtml(task.workItemId)}" data-project-key="${escapeHtml(task.projectKey)}" data-project-title="${escapeHtml(task.title)}" type="button"><i data-lucide="network"></i>${newsLanguage === "en" ? "Project context" : "项目上下文"}</button>` : ""}</article>`).join("") || `<div class="empty-state"><i data-lucide="folder-open"></i><span>${t("noTasks")}</span></div>`}</div>`;
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

// Render each business objective through its delivery stages.
function renderKanban() {
  const allTasks = visibleTasks();
  const doneCount = allTasks.filter((task) => task.status === "done").length;
  const activeCount = allTasks.length - doneCount;
  const overdueCount = allTasks.filter((task) => task.status !== "done" && taskDueTime(task) && taskDueTime(task) < Date.now()).length;
  document.querySelector("#kanban-board").innerHTML = `<section class="delivery-summary"><div><span>进行中</span><strong>${activeCount}</strong><small>需要推进的任务</small></div><div><span>交付风险</span><strong>${overdueCount}</strong><small>已逾期或需要确认</small></div><div><span>已完成</span><strong>${doneCount}</strong><small>历史工作已收纳</small></div></section><details class="completed-work"><summary>已完成工作 <span>${doneCount}</span></summary><p>已完成事项已从主要交付视图收纳，避免干扰当前决策。</p></details>`;
}

// Gather the task, meeting, and document context for one active work group.
function renderProjectWorkspace() {
  const groups = currentWorkGroups();
  const tabs = document.querySelector("#project-workspace-tabs");
  const detail = document.querySelector("#project-workspace-detail");
  if (!tabs || !detail) return;
  workspaceProject = groups.some((group) => group.name === workspaceProject) ? workspaceProject : groups[0]?.name || null;
  const active = groups.find((group) => group.name === workspaceProject);
  tabs.innerHTML = groups.map((group) => `<button class="project-workspace-tab ${group.name === workspaceProject ? "active" : ""}" data-workspace-project="${escapeHtml(group.name)}" type="button"><i style="background:${group.color}"></i><span>${escapeHtml(group.name)}</span><small>${group.active} 项进行中</small></button>`).join("");
  if (!active) { detail.innerHTML = "<div class=\"empty-state\"><i data-lucide=\"folder-open\"></i><span>暂无可聚合的业务目标。</span></div>"; return; }
  const currentTasks = active.tasks.filter((task) => task.status !== "done" && Number(task.progress) < 100);
  const currentTaskIds = new Set(currentTasks.map((task) => task.id));
  const projectWords = currentTasks.map((task) => `${task.title || ""} ${task.project || ""}`.toLowerCase()).join(" ");
  const meetings = (contextData.feishu?.schedule || [])
    .filter((item) => new Date(item.start || item.startAt || 0).getTime() >= Date.now())
    .filter((item) => item.taskId ? currentTaskIds.has(item.taskId) : Boolean(String(item.title || "").trim()) && projectWords.includes(String(item.title).toLowerCase()))
    .slice(0, 3);
  const documents = (contextData.feishu?.notes || [])
    .filter((item) => {
      const title = String(item.title || item.name || "").trim().toLowerCase();
      return title.length >= 4 && projectWords.includes(title);
    })
    .slice(0, 3);
  const risk = active.tasks.filter((task) => task.status !== "done" && taskDueTime(task) && taskDueTime(task) < Date.now()).length;
  const sources = businessGoalSources(active);
  detail.innerHTML = `<header><div><p class="eyebrow">${escapeHtml(active.name)}</p><h2>${active.progress}% 已推进</h2><p>${escapeHtml(active.summary)} · ${active.projectItems} 项飞书需求 · 当前焦点：${escapeHtml(active.focus)}${risk ? ` · ${risk} 项需要重新确认` : " · 当前没有逾期信号"}</p></div><span class="status-chip" style="background:${active.color}">${businessGoalStatus(active)}</span></header><section class="goal-lineage" aria-label="业务目标来源关系"><div class="goal-lineage-root"><span>业务目标</span><strong>${escapeHtml(active.name)}</strong><small>${active.active} 项正在推进</small></div><div class="goal-lineage-connector" aria-hidden="true"></div><div class="goal-lineage-sources"><p class="eyebrow">贡献来源</p>${sources.map((source) => `<div class="goal-lineage-source ${source.kind}"><i data-lucide="${source.kind === "project" ? "folders" : "list-checks"}"></i><div><strong>${escapeHtml(source.name)}</strong><small>${source.kind === "project" ? "飞书 Project" : "直接事项"} · ${source.active} 项进行中 · ${source.completed} 项已完成</small></div></div>`).join("") || "<p class=\"workspace-empty\">暂无可追溯的来源事项。</p>"}</div></section><div class="project-workspace-columns ${documents.length ? "" : "without-documents"}"><section><p class="eyebrow">当前任务</p>${currentTasks.map((task) => `<article><span class="priority-dot" style="--task-color:${priorityColor(task.priority)}"></span><div><div class="project-task-title"><strong>${escapeHtml(task.displayTitle)}</strong>${task.source === "feishu-project" && task.projectKey && task.workItemId ? `<button class="project-context-icon" data-project-work-item="${escapeHtml(task.workItemId)}" data-project-key="${escapeHtml(task.projectKey)}" data-project-title="${escapeHtml(task.title)}" data-project-url="${escapeHtml(task.url || task.link || "")}" type="button" aria-label="查看飞书 Project 上下文" title="查看飞书 Project 上下文"><i data-lucide="network"></i></button>` : ""}</div><small>${escapeHtml(taskRelevanceLabel(task))} · ${escapeHtml(task.nextStep || task.action || t("noNextStep"))}</small></div></article>`).join("") || "<p class=\"workspace-empty\">当前没有待推进任务。</p>"}</section><section><p class="eyebrow">任务排期</p>${meetings.map((item) => `<article><i data-lucide="calendar-clock"></i><div><strong>${escapeHtml(item.taskTitle || item.title || "未命名日程")}</strong><small>${escapeHtml(`${item.node ? `${item.node} · ` : ""}${formatDate(item.start || item.startAt || item.end, true)}`)}</small></div></article>`).join("") || "<p class=\"workspace-empty\">当前任务没有近期排期。</p>"}</section>${documents.length ? `<section><p class="eyebrow">关联资料</p>${documents.map((item) => `<article><i data-lucide="file-text"></i><div><strong>${escapeHtml(item.title || item.name || "文档")}</strong><small>${escapeHtml(item.updatedAt ? formatDate(item.updatedAt, true) : "已同步资料")}</small></div></article>`).join("")}</section>` : ""}</div>`;
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
  document.querySelectorAll("[data-focus-duration]").forEach((button) => button.classList.toggle("active", Number(button.dataset.focusDuration) === focusDuration));
  document.querySelector("#focus-round").textContent = `第 ${Math.floor(data.focusMinutes / focusDuration) + 1} 轮 · ${focusDuration} 分钟`;
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

// Convert structured source headlines into a concise editorial line without clipping information.
function editorialHeadline(value = "", language = newsLanguage) {
  const title = cleanNewsCopy(value);
  const limit = language === "en" ? 72 : 42;
  if (title.length <= limit) return title;
  if (/广东省安委会约谈汕头市政府/.test(title)) return "安全生产考核靠后，广东约谈汕头市政府";
  const bracketHeadline = title.match(/^[【\[]([^】\]]+)[】\]]/);
  const sentence = (bracketHeadline ? bracketHeadline[1] : title).split(/[。；!?！？]/)[0].trim();
  const topic = sentence.split(/[：:]/)[0].trim();
  if (topic.length >= 8 && topic.length < sentence.length) return topic;
  const clause = sentence.split(/[，、,]/)[0].trim();
  if (clause.length >= 8 && clause.length < sentence.length) return clause;
  return sentence;
}

// Keep the visible newspaper copy concise enough to read without clipping the key point.
function editorialSummary(value, variant) { const limit = variant === "lead" ? 240 : variant === "secondary" ? 170 : 115; const clean = cleanNewsCopy(value); return clean.length > limit ? `${clean.slice(0, limit).replace(/[，。；、,. ]+$/, "")}…` : clean; }

// Estimate card height so the two supporting columns stay balanced without forced empty space.
function storyWeight(item) { const sourceTitle = newsLanguage === "en" ? (item.originalTitle || item.title) : item.title; const title = editorialHeadline(sourceTitle).length; const summary = cleanNewsCopy(item.summary || "").length; return 1 + title / 38 + summary / 95; }

// Approximate the rendered editorial height before assigning stories to newspaper columns.
function storyLayoutWeight(item, variant = "secondary") {
  const title = editorialHeadline(newsLanguage === "en" ? (item.originalTitle || item.title) : item.title).length;
  const summary = editorialSummary(newsLanguage === "en" ? (item.originalSummary || item.summary) : item.summary, variant).length;
  return variant === "lead" ? 150 + title * 1.9 + summary * 0.75 : 110 + title * 1.6 + summary * 0.68;
}

// Render a single editorial story with source, market, importance, and editorial hierarchy.
function newspaperStory(item, variant = "brief") {
  const originalTitle = newsLanguage === "en" ? (item.originalTitle || item.title) : item.title;
  const title = editorialHeadline(originalTitle);
  const summary = editorialSummary(newsLanguage === "en" ? (item.originalSummary || item.summary) : item.summary, variant);
  const fallbackTitle = newsLanguage === "en" ? "Untitled" : "无标题";
  const fallbackSummary = newsLanguage === "en" ? "No summary" : "暂无摘要";
  const meta = editorialMeta(item);
  const shape = storyWeight(item) > 4.2 ? "story-tall" : storyWeight(item) < 2.3 ? "story-compact" : "story-standard";
  const tag = variant === "lead" ? "头条" : variant === "secondary" ? "重点" : "简报";
  const targetUrl = item.url || item.sourceUrl;
  const linkLabel = item.url ? (newsLanguage === "en" ? "Open article" : "打开原文") : (newsLanguage === "en" ? "Open source" : "打开快讯来源");
  const originalTitleHint = escapeHtml(originalTitle || fallbackTitle);
  return `<article class="news-story ${variant} ${shape}"><div class="news-story-kicker"><span class="source-label ${escapeHtml(item.source)}">${escapeHtml(item.sourceLabel || item.source)}</span><span>${tag}</span></div><div class="news-story-context"><span>${escapeHtml(meta.market)}</span><strong>${escapeHtml(meta.importance)}</strong></div><h3 title="${originalTitleHint}">${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer" title="${originalTitleHint}">${escapeHtml(title || fallbackTitle)}</a>` : escapeHtml(title || fallbackTitle)}</h3><p>${escapeHtml(summary || fallbackSummary)}</p><footer><span>${escapeHtml(item.author || item.attribution || (newsLanguage === "en" ? "Public source" : "公开来源"))}</span><time>${escapeHtml(formatDate(item.publishedAt, true))}</time>${targetUrl ? `<a class="news-link" href="${escapeHtml(targetUrl)}" target="_blank" rel="noreferrer" aria-label="${linkLabel}" title="${linkLabel}"><i data-lucide="external-link"></i></a>` : ""}</footer></article>`;
}

// Distribute ranked stories into headline, priority, and brief tiers without leaving a blank column tail.
function renderNewspaperColumns(pageItems) {
  const lead = pageItems[0];
  const support = pageItems.slice(1).map((item, index) => ({ item, variant: index < 3 ? "secondary" : "brief" }));
  const initialColumns = lead ? [[{ item: lead, variant: "lead" }], [], []] : [[], [], []];
  const initialHeights = [lead ? storyLayoutWeight(lead, "lead") : 0, 0, 0];
  let best = { columns: initialColumns, score: Number.POSITIVE_INFINITY };

  // With a small fixed page size, evaluate every safe placement instead of accepting a visibly uneven greedy result.
  function placeStory(index, columns, heights) {
    if (index === support.length) {
      const counts = columns.map((column) => column.length);
      if (support.length >= 5 && Math.min(...counts) < 2) return;
      const spread = Math.max(...heights) - Math.min(...heights);
      const countSpread = Math.max(...counts) - Math.min(...counts);
      const score = spread + countSpread * 35;
      if (score < best.score) best = { columns, score };
      return;
    }
    const story = support[index];
    const weight = storyLayoutWeight(story.item, story.variant);
    for (let target = 0; target < 3; target += 1) {
      const nextColumns = columns.map((column, columnIndex) => columnIndex === target ? [...column, story] : column);
      const nextHeights = heights.map((height, columnIndex) => columnIndex === target ? height + weight : height);
      placeStory(index + 1, nextColumns, nextHeights);
    }
  }

  placeStory(0, initialColumns, initialHeights);
  return `<div class="newspaper-grid">${best.columns.map((column, index) => `<div class="${index === 0 ? "newspaper-lead-column" : "newspaper-column"}">${column.map(({ item, variant }) => newspaperStory(item, variant)).join("")}</div>`).join("")}</div>`;
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
  document.querySelectorAll("[data-i18n-tooltip]").forEach((element) => {
    const label = copy[element.dataset.i18nTooltip];
    if (!label) return;
    element.dataset.tooltip = label;
    element.title = label;
  });
  document.querySelectorAll("[data-news-language]").forEach((tab) => { const active = tab.dataset.newsLanguage === newsLanguage; tab.classList.toggle("active", active); tab.setAttribute("aria-pressed", String(active)); });
  document.querySelector("#news-masthead-title").textContent = newsLanguage === "en" ? "JessDaily" : "Jess日报";
  document.querySelectorAll("[data-news-filter]").forEach((tab) => { const key = `newsFilter${tab.dataset.newsFilter[0].toUpperCase()}${tab.dataset.newsFilter.slice(1)}`; tab.textContent = t(key); });
  updateThemeControl(copy);
  updateSidebarToggle();
}

// Update the focus-mode button to describe the change it will make.
function updateThemeControl() {
  const button = document.querySelector("#theme-toggle");
  if (!button) return;
  const focused = document.body.classList.contains("focus-mode");
  const label = focused ? (newsLanguage === "en" ? "Exit focus mode" : "退出专注模式") : (newsLanguage === "en" ? "Enter focus mode" : "进入专注模式");
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = `<i data-lucide="${focused ? "minimize-2" : "maximize-2"}"></i>`;
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

// Toggle the low-distraction view while keeping all work data available.
function setFocusMode(enabled) {
  document.body.classList.toggle("focus-mode", enabled);
  localStorage.setItem("jessboard-focus-mode", enabled ? "on" : "off");
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

// Show the actual context-sync phase reported by the local service.
function setContextRefreshFeedback(progress = {}, state = "loading") {
  const feedback = document.querySelector("#context-refresh-feedback");
  const label = document.querySelector("#context-refresh-status");
  const bar = document.querySelector("#context-refresh-bar");
  if (!feedback || !label || !bar) return;
  feedback.hidden = false;
  feedback.dataset.state = state;
  if (state === "success") {
    label.textContent = newsLanguage === "en" ? "Sync complete · Today's brief is up to date" : "同步完成 · 今日简报已更新";
    bar.style.width = "100%";
    return;
  }
  if (state === "partial") {
    label.textContent = newsLanguage === "en" ? "Partly refreshed · Showing the last successful snapshot" : "部分同步完成 · 正在保留上次成功的快照";
    bar.style.width = "100%";
    return;
  }
  if (state === "error") {
    label.textContent = newsLanguage === "en" ? "Sync failed · Your current brief has been kept" : "同步失败 · 已保留当前工作简报";
    bar.style.width = "100%";
    return;
  }
  const workflowProgress = progress.total ? Math.round((Number(progress.completed) || 0) / progress.total * 42) : 0;
  const phases = {
    starting: ["正在准备同步", 8],
    "reading-local-context": ["正在读取本机工作上下文", 14],
    "feishu-tasks": ["正在同步飞书任务", 28],
    "project-scope": ["正在读取相关业务线和关注事项", 40],
    "project-workflows": [`正在读取 Project 工作流排期${progress.total ? ` · ${progress.completed || 0}/${progress.total}` : ""}`, 48 + workflowProgress],
    "meegle-actions": ["正在读取飞书 Project 个人待办", 88],
    "lark-context": ["正在整理日历、文档与消息", 92],
    brief: ["正在生成今日简报", 97]
  };
  const [labelText, percent] = phases[progress.phase] || phases.starting;
  label.textContent = newsLanguage === "en" ? "Syncing local work context" : labelText;
  bar.style.width = `${percent}%`;
}

// Cancel scheduled visual progress updates after the local sync completes.
function clearContextRefreshTimers() {
  contextRefreshTimers.forEach((timer) => window.clearTimeout(timer));
  contextRefreshTimers = [];
  if (contextRefreshPoller) window.clearInterval(contextRefreshPoller);
  contextRefreshPoller = null;
}

// Poll the local service while a refresh is in progress.
async function pollContextRefreshStatus() {
  try {
    const response = await fetch("/api/context/refresh-status");
    if (!response.ok) return;
    const progress = await response.json();
    if (contextRefreshLoading) setContextRefreshFeedback(progress);
  } catch { /* Keep the most recent visible phase when polling is unavailable. */ }
}

// Run a read-only local context refresh and expose its visible stages to the daily brief.
async function refreshContext() {
  if (contextRefreshLoading) return;
  contextRefreshLoading = true;
  const button = document.querySelector("#refresh-context");
  clearContextRefreshTimers();
  button.disabled = true;
  button.innerHTML = `<i data-lucide="loader-circle" class="spin"></i><span>${newsLanguage === "en" ? "Syncing" : "同步中"}</span>`;
  setContextRefreshFeedback({ phase: "starting" });
  await pollContextRefreshStatus();
  contextRefreshPoller = window.setInterval(pollContextRefreshStatus, 700);
  lucide.createIcons();
  try {
    const response = await fetch("/api/context/refresh", { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    contextData = payload;
    renderApp();
    setContextRefreshFeedback({ phase: "complete" }, payload.refresh?.partial ? "partial" : "success");
    if (payload.refresh?.partial) document.querySelector("#daily-brief-updated").textContent = newsLanguage === "en" ? "Partial refresh: showing the last successful snapshot" : "部分同步完成：正在显示上次成功的快照";
  } catch (error) {
    document.querySelector("#daily-brief-updated").textContent = `更新失败：${error.message}`;
    setContextRefreshFeedback({ phase: "error" }, "error");
  } finally {
    clearContextRefreshTimers();
    contextRefreshLoading = false;
    button.disabled = false;
    button.innerHTML = `<i data-lucide="refresh-cw"></i><span>${newsLanguage === "en" ? "Refresh" : "手动刷新"}</span>`;
    contextRefreshTimers.push(window.setTimeout(() => {
      const feedback = document.querySelector("#context-refresh-feedback");
      if (feedback && !contextRefreshLoading) feedback.hidden = true;
    }, 2800));
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

// Describe the active development period in reader-friendly language.
function devRangeLabel(range = devRange) { return { "24h": "最近 24 小时", "7d": "最近 7 天", "30d": "最近 30 天", all: "全部时间" }[range] || "当前周期"; }

// Explain a period-on-period change without implying a comparison for all-time data.
function formatDevDelta(current, previous) {
  if (!Number.isFinite(Number(previous))) return "累计记录";
  const delta = Number(current || 0) - Number(previous || 0);
  if (!delta) return "与上一周期持平";
  return `较上一周期 ${delta > 0 ? "+" : ""}${compactNumber(delta)}`;
}

// Render recent commit rows with their repository, hash, and author timestamp.
function renderDevCommits(target, commits, emptyLabel) {
  const element = document.querySelector(target);
  element.innerHTML = commits?.length ? commits.map((commit) => {
    const meta = [commit.repo || "本地仓库", commit.sha ? commit.sha.slice(0, 7) : "", commit.date ? formatDate(commit.date, true) : ""].filter(Boolean).join(" · ");
    const source = { public: "GitHub 公开", github: "GitHub", private: "私有仓库", local: "本机" }[commit.source] || "已同步";
    const sourceTag = commit.source === "local" ? "" : `<b class="dev-source-tag ${escapeHtml(commit.source || "synced")}">${source}</b>`;
    const title = escapeHtml(commit.message || "未命名提交");
    const heading = commit.url ? `<a href="${escapeHtml(commit.url)}" target="_blank" rel="noreferrer" title="${title}">${title}</a>` : `<strong title="${title}">${title}</strong>`;
    const delta = commit.additions != null
      ? `<em aria-label="新增 ${compactNumber(commit.additions)} 行，删除 ${compactNumber(commit.deletions)} 行"><b class="dev-additions">+${compactNumber(commit.additions)}</b><span aria-hidden="true">/</span><b class="dev-deletions">-${compactNumber(commit.deletions)}</b></em>`
      : "<em>已记录</em>";
    return `<article class="dev-commit"><div>${heading}<span>${sourceTag}${escapeHtml(meta)}</span></div>${delta}</article>`;
  }).join("") : `<span class="dev-empty">${escapeHtml(emptyLabel)}</span>`;
}

// Render repository filters for the currently selected activity period.
function renderDevRepositoryFilters(commits) {
  const element = document.querySelector("#dev-repository-tabs");
  const repositories = Object.entries((commits || []).reduce((counts, commit) => {
    const name = String(commit.repo || "未识别仓库");
    counts[name] = Number(counts[name] || 0) + 1;
    return counts;
  }, {})).map(([name, count]) => ({ name, count })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  if (devCommitRepository !== "all" && !repositories.some((repository) => repository.name === devCommitRepository)) devCommitRepository = "all";
  element.innerHTML = [`<button type="button" class="${devCommitRepository === "all" ? "active" : ""}" data-dev-repository="all">全部 ${compactNumber((commits || []).length)}</button>`, ...repositories.map((repository) => `<button type="button" class="${repository.name === devCommitRepository ? "active" : ""}" data-dev-repository="${escapeHtml(repository.name)}" title="${escapeHtml(repository.name)}">${escapeHtml(repository.name)} ${compactNumber(repository.count)}</button>`)].join("");
}

// Render the Codex, GitHub, and local workspace development dashboard.
function renderDevMetrics() {
  if (!devMetrics) return;
  document.querySelector("#dev-view").classList.remove("is-loading", "is-unavailable");
  const codex = devMetrics.codex || {};
  const tokens = codex.tokenUsage || {};
  const github = devMetrics.github || {};
  const local = devMetrics.localGit || {};
  const overview = devMetrics.overview || {};
  const comparison = overview.comparison || {};
  const codeActivity = devMetrics.codeActivity || { commits: [] };
  const activityRepositories = new Set((codeActivity.commits || []).map((commit) => commit.repo).filter(Boolean));
  const activityRepositoryCount = activityRepositories.size;
  const githubAvailable = ["ready", "fallback"].includes(github.state);
  const metricCards = [
    [`${devRangeLabel()} Token`, compactNumber(overview.tokens), formatDevDelta(overview.tokens, comparison.tokens)],
    ["本周期会话", compactNumber(overview.sessions), `${compactNumber(overview.activeSessions)} 个仍活跃 · ${formatDevDelta(overview.sessions, comparison.sessions)}`],
    ["代码提交", compactNumber(codeActivity.commitCount), `${activityRepositoryCount} 个仓库 · ${devRangeLabel()}`],
    ["待提交改动", compactNumber(local.workingTree?.files), Number(local.workingTree?.files) ? `+${compactNumber(local.workingTree?.additions)} / -${compactNumber(local.workingTree?.deletions)}` : "工作区干净"]
  ];
  document.querySelector("#dev-metric-grid").innerHTML = metricCards.map(([label, value, detail]) => `<article class="dev-metric"><p class="eyebrow">${label}</p><strong>${value}</strong><span>${detail}</span></article>`).join("");
  document.querySelector("#codex-token-summary").innerHTML = [["输入", tokens.input_tokens], ["输出", tokens.output_tokens], ["推理", tokens.reasoning_output_tokens]].map(([label, value]) => `<div><strong>${compactNumber(value)}</strong><span>${label} Token</span></div>`).join("");
  const cachedTokens = Number(tokens.cached_input_tokens || 0);
  const inputTokens = Number(tokens.input_tokens || 0);
  const cacheRate = inputTokens ? Math.round(cachedTokens / inputTokens * 100) : 0;
  document.querySelector("#codex-cache-insight").innerHTML = `<strong>缓存命中 ${cacheRate}%</strong><span>${compactNumber(cachedTokens)} 缓存输入已包含在输入 Token 中，仅用于说明复用程度，不会重复计入消耗。</span>`;
  const tokenBars = [["输入", tokens.input_tokens], ["输出", tokens.output_tokens], ["推理", tokens.reasoning_output_tokens]];
  const maxToken = Math.max(...tokenBars.map(([, value]) => Number(value) || 0), 1);
  document.querySelector("#codex-token-bars").innerHTML = tokenBars.map(([label, value]) => `<div class="dev-bar-row"><span>${label}</span><div class="dev-bar-track"><span style="width:${Math.max(2, Math.round((Number(value) || 0) / maxToken * 100))}%"></span></div><strong>${compactNumber(value)}</strong></div>`).join("");
  document.querySelector("#dev-range-copy").textContent = `${devRangeLabel()}的本机 Codex 记录；Token 变化按相邻同长度周期比较。`;
  const models = (codex.models || []).map((model) => ({ ...model, name: model.name === "Unknown" ? "Legacy session (model not recorded)" : model.name }));
  renderTokenShareList("#codex-models", models, "尚未识别到模型记录");
  renderTokenShareList("#codex-scenarios", codex.scenarios, "尚未识别到使用场景");
  document.querySelector("#codex-top-sessions").innerHTML = codex.highestTokenSessions?.length ? codex.highestTokenSessions.map((session) => {
    const threadId = encodeURIComponent(String(session.id || ""));
    const title = escapeHtml(session.title);
    return `<div class="dev-list-row"><a class="dev-session-link" href="codex://thread/${threadId}" target="_blank" rel="noopener" title="在 Codex 中打开此对话">${title}<small>${escapeHtml(session.id)} · 在 Codex 中打开</small></a><strong>${compactNumber(session.tokens)}</strong></div>`;
  }).join("") : "<span class=\"dev-empty\">No token records</span>";
  const insights = buildDevelopmentInsights(codex, local, github, codeActivity);
  document.querySelector("#dev-analysis").innerHTML = `<p class="eyebrow">本周期总结</p><h2>开发工作画像</h2><div class="dev-analysis-grid"><article><h3>工作重心</h3><p>${escapeHtml(insights.focus)}</p></article><article><h3>交付节奏</h3><p>${escapeHtml(insights.delivery)}</p></article><article><h3>下一步建议</h3>${insights.suggestions.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</article></div><details class="dev-history"><summary>查看累计历史</summary><p>累计 ${compactNumber(overview.allTokens)} Token · ${compactNumber(overview.allSessions)} 个本机会话。累计数用于回顾，不参与本周期判断。</p></details>`;
  renderDevList("#dev-skills", codex.skills, "尚未识别到 skill 调用");
  renderDevList("#dev-tools", codex.tools, "尚未识别到工具调用");
  const privateGithub = github.private || {};
  const privateRepositoryCount = Number(privateGithub.repositoryCount || 0);
  const privateAvailable = ["ready", "partial"].includes(privateGithub.state);
  document.querySelector("#github-state").textContent = activityRepositoryCount ? `${activityRepositoryCount} 个仓库` : "暂无提交";
  document.querySelector("#github-state").className = `status-chip ${githubAvailable ? "blue" : "orange"}`;
  document.querySelector("#github-scope-note").textContent = github.state === "fallback" ? "公开 GitHub 活动暂不可用，正在显示本机历史；可配置指定私有仓库的只读提交记录。" : privateAvailable ? `显示 @${github.username} 的公开 Push Events，以及 ${privateRepositoryCount} 个已授权私有仓库中由你提交的记录；不读取代码内容或差异。` : privateGithub.state === "needs-token" ? `显示 @${github.username} 的公开 Push Events；已配置 ${privateRepositoryCount} 个私有仓库，等待本机只读访问令牌。` : github.username ? `仅显示 @${github.username} 的公开 Push Events；可配置指定私有仓库的只读提交记录。` : "仅显示公开事件流可识别的提交；可配置指定私有仓库的只读提交记录。";
  document.querySelector("#local-scope-note").textContent = "仅扫描当前 src 工作区内已发现的仓库；其它本机目录需要接入后才会统计。";
  document.querySelector("#code-activity-scope").textContent = `${devRangeLabel()}内 ${compactNumber(codeActivity.commitCount)} 次提交，覆盖 ${activityRepositoryCount} 个仓库；按仓库查看具体交付。`;
  document.querySelector("#code-activity-summary").innerHTML = [["提交", codeActivity.commitCount], ["新增行", codeActivity.additions], ["删除行", codeActivity.deletions]].map(([label, value]) => `<div><strong>${compactNumber(value)}</strong><span>${label}</span></div>`).join("");
  renderDevRepositoryFilters(codeActivity.commits || []);
  const selectedCommits = (codeActivity.commits || []).filter((commit) => devCommitRepository === "all" || commit.repo === devCommitRepository);
  renderDevCommits("#code-activity-list", selectedCommits, devCommitRepository === "all" ? "本周期没有识别到代码提交" : `${devCommitRepository} 在${devRangeLabel()}内没有提交`);
  const quotaNote = codex.quota?.detail || "仅展示本机记录";
  document.querySelector("#dev-notice-copy").textContent = `${quotaNote}；显示会话标题预览，不显示凭证或代码内容。`;
}

// Keep development analytics informative while local records are loading or unavailable.
function renderDevState(state, detail = "") {
  const view = document.querySelector("#dev-view");
  view.classList.toggle("is-loading", state === "loading");
  view.classList.toggle("is-unavailable", state === "unavailable");
  const target = document.querySelector("#dev-metric-grid");
  if (state === "loading") target.innerHTML = Array.from({ length: 3 }, () => `<article class="dev-metric dev-skeleton"><span></span><strong></strong><i></i></article>`).join("");
  if (state === "unavailable") target.innerHTML = `<article class="dev-state-card"><i data-lucide="chart-no-axes-combined"></i><div><strong>开发数据暂不可用</strong><span>${escapeHtml(detail || "请稍后刷新本机记录。")}</span></div></article>`;
}

// Fetch fresh development metrics from the local service on demand.
async function loadDevMetrics() {
  if (devMetricsLoading) return;
  devMetricsLoading = true;
  renderDevState("loading");
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
    renderDevState("unavailable", "当前无法读取本机聚合指标，请确认服务已启动后重试。");
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
function renderApp() { renderDailyBrief(); renderInsights(); renderInbox(); renderWeeklyReview(); renderPriorities(); renderAllTasks(); renderGoalPortfolio(); renderProjects(); renderProjectWorkspace(); renderKanban(); renderFocusOptions(); renderSourceStatus(); lucide.createIcons(); }

// Switch between views without leaving the single-page workbench.
function setView(view) {
  document.querySelectorAll("[data-view-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === view));
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  document.querySelector("#open-task-dialog").classList.toggle("is-hidden", !["dashboard", "today", "projects"].includes(view));
  if (view === "dev" && !devMetrics && !devMetricsLoading) loadDevMetrics();
  updatePageHeader(view);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Keep the compact toolbar title aligned with the active workspace view.
function updatePageHeader(view) {
  const copy = newsLanguage === "en" ? {
    dashboard: ["Today", "Jessboard"], inbox: ["Triage", "Work inbox"], today: ["This week", "My tasks"], review: ["Review", "Weekly review"], projects: ["Delivery rhythm", "Business goals"], focus: ["Focus session", "One thing at a time"], dev: ["Development data", "Development analysis"], news: ["Daily edition", "JessDaily"]
  } : {
    dashboard: ["今天", "Jessboard"], inbox: ["待处理输入", "工作收件箱"], today: ["本周", "我的任务"], review: ["复盘与调整", "每周复盘"], projects: ["交付节奏", "业务目标"], focus: ["专注时段", "一次只做一件事"], dev: ["开发数据", "开发分析"], news: ["每日版", "Jess日报"]
  };
  const [kicker] = copy[view] || copy.dashboard;
  document.querySelector("#page-kicker").textContent = kicker;
  document.querySelector("#page-title").textContent = "Jessboard";
}

// Add a new local task from the dialog form.
function addTask(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const dueDate = form.get("due");
  const project = form.get("project") || "未归类";
  const task = { id: `task-${Date.now()}`, title: form.get("title").trim(), project, workType: form.get("workType"), priority: form.get("priority"), status: form.get("status"), due: dueDate ? formatDate(`${dueDate}T00:00:00`) : "暂无日期", createdAt: new Date().toISOString(), completedAt: form.get("status") === "done" ? new Date().toISOString() : null };
  data.tasks.unshift(task);
  data.selectedTaskId ||= task.id;
  saveData(); renderApp(); event.currentTarget.reset(); document.querySelector("#task-dialog").close(); setView("today");
}

// Switch a local or message-derived task between complete and planned without changing Feishu.
function toggleTask(id) {
  const task = data.tasks.find((item) => item.id === id);
  const sourceTask = syncedWorkTasks().find((item) => item.id === id);
  if (task) {
    task.status = task.status === "done" ? "todo" : "done";
    task.completedAt = task.status === "done" ? new Date().toISOString() : null;
    task.updatedAt = new Date().toISOString();
  } else if (sourceTask?.source === "lark-inferred") {
    const status = sourceTask.status === "done" ? "todo" : "done";
    data.taskOverrides[id] = { status, completedAt: status === "done" ? new Date().toISOString() : null, updatedAt: new Date().toISOString() };
  } else {
    return;
  }
  saveData();
  renderApp();
}

// Remove a local task or hide a message-derived task without altering its Feishu source.
function deleteTask(id) {
  const localTask = data.tasks.find((task) => task.id === id);
  const sourceTask = syncedWorkTasks().find((task) => task.id === id);
  if (localTask) {
    data.tasks = data.tasks.filter((task) => task.id !== id);
    if (data.selectedTaskId === id) data.selectedTaskId = data.tasks[0]?.id || null;
  } else if (sourceTask?.source === "lark-inferred") {
    data.taskOverrides[id] = {
      ...(data.taskOverrides[id] || {}),
      dismissedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  } else {
    return;
  }
  saveData();
  renderApp();
}

// Open the original Feishu record retained by a synchronized task or message-derived task.
function openTaskSource(link) {
  try {
    const url = new URL(link, window.location.href);
    if (!/^https?:$/u.test(url.protocol)) return;
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  } catch (error) {
    console.warn("无法打开任务来源链接。", error);
  }
}

// Add a confirmed message to the browser-local task list without changing Feishu.
function addBriefMessageTask(id) {
  const message = (contextData.feishu?.messages || []).find((item) => item.id === id);
  if (!message || data.tasks.some((task) => task.originMessageId === id)) return;
  const title = `回复：${taskDisplayTitle({ title: message.chat || t("messageFrom") })}`;
  const summary = cleanTaskCopy(message.preview);
  const task = { id: `message-task-${Date.now()}`, title, summary, sourceTitle: message.chat || t("messageFrom"), project: "飞书消息", workType: "communication", priority: "medium", status: "todo", due: "暂无日期", createdAt: new Date().toISOString(), source: "message-confirmed", link: message.link, originMessageId: id };
  data.tasks.unshift(task);
  data.selectedTaskId ||= task.id;
  dismissedBriefMessages.add(id);
  saveDismissedBriefMessages();
  saveData();
  renderApp();
}

// Hide one message prompt locally and refresh every surface that summarizes it.
function dismissBriefMessage(id) { dismissedBriefMessages.add(id); saveDismissedBriefMessages(); renderApp(); }

// Move a task to a new board state.
function changeTaskStatus(id, status) { const task = data.tasks.find((item) => item.id === id); if (!task) return; task.status = status; task.completedAt = status === "done" ? new Date().toISOString() : null; task.updatedAt = new Date().toISOString(); saveData(); renderApp(); }

// Display the focus timer in minutes and seconds.
function renderTimer() { document.querySelector("#timer-display").textContent = `${String(Math.floor(timerSeconds / 60)).padStart(2, "0")}:${String(timerSeconds % 60).padStart(2, "0")}`; }

// Select a practical focus interval and reset the current countdown.
function setFocusDuration(minutes) {
  focusDuration = Number(minutes) || 25;
  localStorage.setItem("jessboard-focus-duration", String(focusDuration));
  if (timerId) { clearInterval(timerId); timerId = null; document.querySelector("#timer-start").innerHTML = "<i data-lucide=\"play\"></i>开始专注"; }
  timerSeconds = focusDuration * 60;
  renderTimer();
  renderFocusOptions();
  lucide.createIcons();
}

// Move to the next open task without changing its completion state.
function skipFocusTask() {
  const active = visibleTasks().filter((task) => task.status !== "done");
  const currentIndex = active.findIndex((task) => task.id === data.selectedTaskId);
  const next = active[(currentIndex + 1) % active.length];
  if (!next) return;
  data.selectedTaskId = next.id;
  saveData();
  renderFocusOptions();
  lucide.createIcons();
}

// Start or pause a single focus countdown.
function toggleTimer() {
  const button = document.querySelector("#timer-start");
  if (timerId) { clearInterval(timerId); timerId = null; button.innerHTML = "<i data-lucide=\"play\"></i>继续专注"; lucide.createIcons(); return; }
  button.innerHTML = "<i data-lucide=\"pause\"></i>暂停专注"; lucide.createIcons();
  timerId = window.setInterval(() => { timerSeconds -= 1; renderTimer(); if (timerSeconds <= 0) { clearInterval(timerId); timerId = null; timerSeconds = focusDuration * 60; data.focusMinutes += focusDuration; saveData(); renderApp(); renderTimer(); button.innerHTML = "<i data-lucide=\"play\"></i>开始专注"; lucide.createIcons(); } }, 1000);
}

// Populate the project choice field from the active local project list.
function populateProjectMenu() { document.querySelector("#task-project").innerHTML = data.projects.length ? data.projects.map((project) => `<option value="${escapeHtml(project.name)}">${escapeHtml(project.name)}</option>`).join("") : "<option value=\"未归类\">未归类</option>"; }

// Keep the sidebar control label and icon aligned with its current layout state.
function updateSidebarToggle() {
  const button = document.querySelector("#sidebar-toggle");
  const expanded = document.body.classList.contains("sidebar-expanded");
  const label = newsLanguage === "en" ? (expanded ? "Collapse sidebar" : "Expand sidebar") : (expanded ? "收起侧边栏" : "展开侧边栏");
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.innerHTML = `<i data-lucide="${expanded ? "panel-right-close" : "panel-right-open"}"></i>`;
  lucide.createIcons();
}

// Toggle the compact sidebar and retain the preference for the next visit.
function toggleSidebar() {
  document.body.classList.toggle("sidebar-expanded");
  localStorage.setItem("jessboard-sidebar", document.body.classList.contains("sidebar-expanded") ? "expanded" : "collapsed");
  updateSidebarToggle();
}

// Wire shared controls, filters, navigation, and dialogs.
function bindEvents() {
  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-toggle-task]"); const deletion = event.target.closest("[data-delete-task]"); const messageTask = event.target.closest("[data-add-message-task]"); const messageDismiss = event.target.closest("[data-dismiss-message]"); const choice = event.target.closest("[data-focus-task]"); const navigation = event.target.closest("[data-view], [data-go-to]"); const taskTab = event.target.closest("[data-task-filter]"); const priorityTab = event.target.closest("[data-priority-filter]"); const taskLayoutTab = event.target.closest("[data-task-layout]"); const taskPageControl = event.target.closest("[data-task-page]"); const taskRangeTrigger = event.target.closest("#task-range-trigger"); const taskRangeOption = event.target.closest("[data-task-range]"); const taskRangeMenu = event.target.closest("#task-range-menu"); const weekPending = event.target.closest("[data-show-week-pending]"); const taskSource = event.target.closest("[data-task-link]"); const projectCard = event.target.closest("[data-project-group]"); const workspaceProjectButton = event.target.closest("[data-workspace-project]"); const goalWorkspaceButton = event.target.closest("[data-goal-workspace]"); const projectWorkItem = event.target.closest("[data-project-work-item]"); const newsTab = event.target.closest("[data-news-filter]"); const languageTab = event.target.closest("[data-news-language]"); const sidebarToggle = event.target.closest("#sidebar-toggle"); const focusPager = event.target.closest("[data-focus-page]"); const focusDurationButton = event.target.closest("[data-focus-duration]");
    if (toggle) toggleTask(toggle.dataset.toggleTask);
    if (deletion) deleteTask(deletion.dataset.deleteTask);
    if (messageTask) addBriefMessageTask(messageTask.dataset.addMessageTask);
    if (messageDismiss) dismissBriefMessage(messageDismiss.dataset.dismissMessage);
    if (choice) { data.selectedTaskId = choice.dataset.focusTask; saveData(); renderFocusOptions(); lucide.createIcons(); }
    if (taskSource && !event.target.closest("a, button")) openTaskSource(taskSource.dataset.taskLink);
    if (weekPending) showWeekPendingTasks();
    if (navigation) setView(navigation.dataset.view || navigation.dataset.goTo);
    if (taskTab) { taskScopeIds = null; taskScopeLabel = ""; taskFilter = taskTab.dataset.taskFilter; document.querySelectorAll("[data-task-filter]").forEach((tab) => tab.classList.toggle("active", tab === taskTab)); renderAllTasks(); lucide.createIcons(); }
    if (priorityTab) { taskScopeIds = null; taskScopeLabel = ""; priorityFilter = priorityTab.dataset.priorityFilter; document.querySelectorAll("[data-priority-filter]").forEach((tab) => tab.classList.toggle("active", tab === priorityTab)); renderAllTasks(); lucide.createIcons(); }
    if (taskLayoutTab) { taskLayout = taskLayoutTab.dataset.taskLayout; taskPage = 0; localStorage.setItem("jessboard-task-layout", taskLayout); renderAllTasks(); lucide.createIcons(); }
    if (taskPageControl) { taskPage = Number(taskPageControl.dataset.taskPage); renderAllTasks(); lucide.createIcons(); }
    if (taskRangeTrigger) { const menu = document.querySelector("#task-range-menu"); const open = menu.classList.toggle("open"); taskRangeTrigger.setAttribute("aria-expanded", String(open)); }
    if (taskRangeOption) { taskScopeIds = null; taskScopeLabel = ""; taskRange = taskRangeOption.dataset.taskRange; taskPage = 0; localStorage.setItem("jessboard-task-range", taskRange); renderAllTasks(); lucide.createIcons(); }
    if (!taskRangeMenu) { const menu = document.querySelector("#task-range-menu"); const trigger = document.querySelector("#task-range-trigger"); menu?.classList.remove("open"); trigger?.setAttribute("aria-expanded", "false"); }
    if (projectCard) openProjectDialog(projectCard.dataset.projectGroup);
    if (workspaceProjectButton) { workspaceProject = workspaceProjectButton.dataset.workspaceProject; renderProjectWorkspace(); lucide.createIcons(); }
    if (goalWorkspaceButton) { workspaceProject = goalWorkspaceButton.dataset.goalWorkspace; setView("projects"); renderProjectWorkspace(); lucide.createIcons(); }
    if (projectWorkItem) openProjectWorkDetail(projectWorkItem.dataset.projectWorkItem, projectWorkItem.dataset.projectKey, projectWorkItem.dataset.projectTitle, projectWorkItem.dataset.projectUrl);
    if (newsTab) { newsFilter = newsTab.dataset.newsFilter; newsPage = 0; document.querySelectorAll("[data-news-filter]").forEach((tab) => tab.classList.toggle("active", tab === newsTab)); renderNews(); lucide.createIcons(); }
    if (languageTab) setNewsLanguage(languageTab.dataset.newsLanguage);
    if (sidebarToggle) toggleSidebar();
    if (focusPager) { focusPage = Number(focusPager.dataset.focusPage); renderFocusOptions(); lucide.createIcons(); }
    if (focusDurationButton) setFocusDuration(focusDurationButton.dataset.focusDuration);
    const devRepository = event.target.closest("[data-dev-repository]");
    if (devRepository) { devCommitRepository = devRepository.dataset.devRepository || "all"; renderDevMetrics(); lucide.createIcons(); }
  });
  document.addEventListener("change", (event) => { if (event.target.matches("[data-status-task]")) changeTaskStatus(event.target.dataset.statusTask, event.target.value); });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const taskSource = event.target.closest("[data-task-link]");
    if (!taskSource) return;
    event.preventDefault();
    openTaskSource(taskSource.dataset.taskLink);
  });
  document.querySelector("#open-task-dialog").addEventListener("click", () => document.querySelector("#task-dialog").showModal());
  document.querySelector("#close-task-dialog").addEventListener("click", () => document.querySelector("#task-dialog").close());
  document.querySelector("#cancel-task-dialog").addEventListener("click", () => document.querySelector("#task-dialog").close());
  document.querySelector("#task-form").addEventListener("submit", addTask);
  document.querySelector("#clear-completed").addEventListener("click", () => { if (!window.confirm("确定清除本机已完成任务吗？该操作不会影响飞书来源。")) return; data.tasks = data.tasks.filter((task) => task.status !== "done"); saveData(); renderApp(); });
  document.querySelector("#timer-start").addEventListener("click", toggleTimer);
  document.querySelector("#timer-skip").addEventListener("click", skipFocusTask);
  document.querySelector("#timer-reset").addEventListener("click", () => { timerSeconds = focusDuration * 60; renderTimer(); });
  document.querySelector("#theme-toggle").addEventListener("click", () => setFocusMode(!document.body.classList.contains("focus-mode")));
  document.querySelector("#task-search").addEventListener("input", (event) => { taskSearch = event.target.value; renderAllTasks(); lucide.createIcons(); });
  document.querySelector("#close-project-dialog").addEventListener("click", () => document.querySelector("#project-dialog").close());
  document.querySelector("#refresh-news").addEventListener("click", refreshNews);
  document.querySelector("#refresh-dev-metrics").addEventListener("click", loadDevMetrics);
  document.querySelector("#dev-range").addEventListener("change", (event) => { devRange = event.target.value; localStorage.setItem("jessboard-dev-range", devRange); loadDevMetrics(); });
  document.querySelector("#refresh-context").addEventListener("click", refreshContext);
  document.querySelector("#news-prev").addEventListener("click", () => { if (newsPage > 0) { newsPage -= 1; renderNews(); lucide.createIcons(); } });
  document.querySelector("#news-next").addEventListener("click", () => { const pageCount = Math.max(1, Math.ceil(sortedNewsItems().length / newsPageSize)); if (newsPage < pageCount - 1) { newsPage += 1; renderNews(); lucide.createIcons(); } });
}

// Keep the toolbar focused on the active workspace instead of a decorative quote.
function renderDailyQuote() { updatePageHeader(document.querySelector("[data-view-panel].active")?.dataset.viewPanel || "dashboard"); }

// Set the current date labels in the Chinese locale.
function renderToday() { const now = new Date(); const locale = newsLanguage === "en" ? "en-US" : "zh-CN"; const todayDate = document.querySelector("#today-date"); document.querySelector("#page-kicker").textContent = new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }).format(now); if (todayDate) todayDate.textContent = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(now); document.querySelector("#news-edition-date").textContent = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(now); renderDailyQuote(now); }

setFocusMode(localStorage.getItem("jessboard-focus-mode") === "on");
if (localStorage.getItem("jessboard-sidebar") === "expanded") document.body.classList.add("sidebar-expanded");
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
