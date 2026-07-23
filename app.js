// Jessboard behavior renders Chinese work views, local tasks, source snapshots, and the news feed.
const storageKey = "jessboard-data-v2";
const legacyStorageKeys = ["jessboard-data-v1", "focusboard-data-v1"];
const resetMarkerKey = "jessboard-reset-v2";
const emptyData = { focusMinutes: 0, selectedTaskId: null, tasks: [], projects: [] };
let data = loadData();
let contextData = { codex: [], feishu: { tasks: [], schedule: [], notes: [], messages: [] }, sources: {} };
let newsItems = [];
let providerStatuses = {};
let newsFilter = "all";
let newsLanguage = localStorage.getItem("jessboard-news-language") === "en" ? "en" : "zh";
let newsPage = 0;
const newsPageSize = 7;
let taskFilter = "all";
let devMetrics = null;
let devMetricsLoading = false;
let devRefreshTimer = null;
let timerSeconds = 25 * 60;
let timerId = null;

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

// Escape untrusted text before placing it into generated markup.
function escapeHtml(value = "") { const element = document.createElement("div"); element.textContent = value; return element.innerHTML; }

// Return a display color for a task priority.
function priorityColor(priority) { return { high: "#cc680a", medium: "#6e8175", low: "#7f9b9a" }[priority] || "#405740"; }

// Translate an internal task state into a readable Chinese label.
function statusLabel(status) { return { todo: "计划中", progress: "进行中", review: "待复盘", done: "已完成" }[status] || "计划中"; }

// Format an ISO date in the app's Chinese display style.
function formatDate(value, withTime = false) { if (!value) return "暂无时间"; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return new Intl.DateTimeFormat("zh-CN", withTime ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric" }).format(date); }

// Build an individual task row for a task list.
function taskRow(task, includeDelete = true) {
  const done = task.status === "done";
  return `<article class="task-row ${done ? "done" : ""}" style="--task-color:${priorityColor(task.priority)}">
    <button class="task-toggle" data-toggle-task="${escapeHtml(task.id)}" type="button" aria-label="${done ? "标记未完成" : "标记完成"}：${escapeHtml(task.title)}">${done ? "<i data-lucide=\"check\"></i>" : ""}</button>
    <div><div class="task-title">${escapeHtml(task.title)}</div><div class="task-meta">${escapeHtml(task.project || "未归类")} <span aria-hidden="true">·</span> ${statusLabel(task.status)}</div></div>
    <span class="task-due">${escapeHtml(task.due || "暂无日期")}</span>
    ${includeDelete ? `<button class="task-delete" data-delete-task="${escapeHtml(task.id)}" type="button" aria-label="删除任务：${escapeHtml(task.title)}" title="删除任务"><i data-lucide="trash-2"></i></button>` : "<span class=\"priority-dot\"></span>"}
  </article>`;
}

// Render the summary cards across the overview page.
function renderInsights() {
  const open = data.tasks.filter((task) => task.status !== "done");
  const metrics = [
    ["#405740", open.length, "未完成任务", "待处理"],
    ["#cc680a", data.tasks.filter((task) => task.status === "progress").length, "进行中", "正在推进"],
    ["#6e8175", data.tasks.filter((task) => task.status === "review").length, "待复盘", "需要判断"],
    ["#7f9b9a", data.tasks.filter((task) => task.status === "done").length, "已完成", "本周累计"]
  ];
  document.querySelector("#insight-grid").innerHTML = metrics.map(([color, value, detail, label]) => `<article class="metric-card" style="--metric-color:${color}"><p class="eyebrow">${label}</p><strong>${value}</strong><span>${detail}</span></article>`).join("");
}

// Render the short priority list on the overview page.
function renderPriorities() {
  const tasks = data.tasks.filter((task) => task.status !== "done").slice(0, 4);
  document.querySelector("#priority-list").innerHTML = tasks.map((task) => taskRow(task)).join("") || "<div class=\"empty-state\"><i data-lucide=\"sparkles\"></i><span>今天还没有任务，先给自己留一点空间。</span></div>";
}

// Render all local tasks using the selected filter.
function renderAllTasks() {
  const filtered = data.tasks.filter((task) => taskFilter === "all" || (taskFilter === "open" ? task.status !== "done" : task.status === "done"));
  document.querySelector("#task-list-count").textContent = `${filtered.length} 项`;
  document.querySelector("#all-task-list").innerHTML = filtered.map((task) => taskRow(task)).join("") || "<div class=\"empty-state\"><i data-lucide=\"inbox\"></i><span>这里还没有任务。</span></div>";
}

// Render project cards from the current local task data.
function renderProjects() {
  document.querySelector("#project-cards").innerHTML = data.projects.map((project) => {
    const related = data.tasks.filter((task) => task.project === project.name);
    const complete = related.length ? Math.round(related.filter((task) => task.status === "done").length / related.length * 100) : Number(project.progress || 0);
    return `<article class="project-card" style="--project-color:${escapeHtml(project.color || "#405740")}"><div class="project-card-top"><span class="status-chip pale">${related.length} 项任务</span><span class="project-percent">${complete}%</span></div><h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.note || "暂无项目说明")}</p><div class="progress-line"><span style="width:${complete}%"></span></div></article>`;
  }).join("") || "<div class=\"empty-state\"><i data-lucide=\"folder-open\"></i><span>还没有项目，创建任务时可以再归类。</span></div>";
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
  const columns = [["todo", "计划中"], ["progress", "进行中"], ["review", "待复盘"], ["done", "已完成"]];
  document.querySelector("#kanban-board").innerHTML = columns.map(([status, label]) => {
    const tasks = data.tasks.filter((task) => task.status === status);
    return `<section class="kanban-column"><div class="kanban-heading"><span>${label}</span><span class="kanban-count">${tasks.length}</span></div>${tasks.map((task) => `<article class="kanban-card" style="--task-color:${priorityColor(task.priority)}"><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.project || "未归类")} · ${escapeHtml(task.due || "暂无日期")}</p><div class="kanban-footer"><span class="priority-dot"></span><select class="status-select" data-status-task="${escapeHtml(task.id)}" aria-label="修改任务状态：${escapeHtml(task.title)}"><option value="todo" ${task.status === "todo" ? "selected" : ""}>计划中</option><option value="progress" ${task.status === "progress" ? "selected" : ""}>进行中</option><option value="review" ${task.status === "review" ? "selected" : ""}>待复盘</option><option value="done" ${task.status === "done" ? "selected" : ""}>已完成</option></select></div></article>`).join("") || "<p class=\"column-empty\">暂无任务</p>"}</section>`;
  }).join("");
}

// Render task choices for the focus session.
function renderFocusOptions() {
  const active = data.tasks.filter((task) => task.status !== "done");
  document.querySelector("#focus-task-options").innerHTML = active.map((task) => `<button class="focus-choice ${task.id === data.selectedTaskId ? "active" : ""}" data-focus-task="${escapeHtml(task.id)}" type="button"><span class="priority-dot" style="--task-color:${priorityColor(task.priority)}"></span><span>${escapeHtml(task.title)}<small>${escapeHtml(task.project || "未归类")}</small></span></button>`).join("") || "<div class=\"empty-state\"><i data-lucide=\"check-circle-2\"></i><span>先创建一项未完成任务。</span></div>";
  const selected = data.tasks.find((task) => task.id === data.selectedTaskId);
  document.querySelector("#timer-task").textContent = selected ? selected.title : "选择一项任务开始。";
}

// Render source connection cards from the local context snapshot.
function renderSourceStatus() {
  const sources = [
    ["codex", "Codex 会话", "message-square-code", contextData.codex?.length ? `${contextData.codex.length} 个会话` : "等待同步"],
    ["feishu", "飞书任务", "cloud", contextData.feishu?.tasks?.length ? `${contextData.feishu.tasks.length} 项任务` : "等待授权"],
    ["schedule", "飞书排期", "calendar-clock", contextData.feishu?.schedule?.length ? `${contextData.feishu.schedule.length} 个安排` : "等待授权"],
    ["notes", "会议与消息", "notebook-tabs", (contextData.feishu?.notes?.length || contextData.feishu?.messages?.length) ? "已接入" : "等待授权"]
  ];
  document.querySelector("#source-status-grid").innerHTML = sources.map(([key, label, icon, detail]) => `<div class="source-card ${detail === "等待授权" ? "is-pending" : ""}"><i data-lucide="${icon}"></i><div><strong>${label}</strong><span>${detail}</span></div><span class="source-dot ${detail === "等待授权" ? "pending" : "ready"}"></span></div>`).join("");
}

// Render the provider states in the news sidebar.
function renderProviders() {
  const providers = [["aihot", "AI HOT", "中文 AI 精选"], ["builders", "Follow Builders", "AI Builder 观点"], ["worldmonitor", "World Monitor", "全球情报"]];
  document.querySelector("#provider-list").innerHTML = providers.map(([key, name, label]) => {
    const status = providerStatuses[key] || { state: "idle", detail: "手动刷新后加载" };
    return `<div class="provider-row"><span class="provider-icon ${key}"><i data-lucide="${key === "worldmonitor" ? "globe-2" : key === "builders" ? "users" : "sparkles"}"></i></span><div><strong>${name}</strong><small>${label}</small></div><span class="provider-state ${status.state}">${escapeHtml(status.detail)}</span></div>`;
  }).join("");
}

// Classify every story by market, topic, and editorial importance instead of its feed source.
function editorialMeta(item) {
  const text = `${item.title || ""} ${item.summary || ""}`.toLowerCase();
  const market = /中国|北京|上海|小红书|字节|阿里|腾讯|qwen|kimi/.test(text) ? "中国" : /英国|英格兰|欧洲|德国|法国|eu\b|uk\b/.test(text) ? "欧洲" : /美国|openai|google|anthropic|microsoft|amazon|meta\b/.test(text) ? "美国" : /印度|日本|韩国|澳大利亚|新西兰|亚太/.test(text) ? "亚太" : "全球";
  const topic = /hacking|hack|安全|漏洞|攻击|guardrail|防护/.test(text) ? "安全" : /政策|监管|business rates|政府|议会|法案|law|regulation/.test(text) ? "市场与政策" : /投资|融资|估值|收购|营收|公司|business|funding|valuation|investment/.test(text) ? "产品与公司" : /builder|开发者|github|开源|open source|zig|bun|代码|runtime/.test(text) ? "开发者生态" : "AI 与模型";
  const score = (item.source === "aihot" ? 3 : item.source === "worldmonitor" ? 2.7 : 1.8) + (/发布|开源|政策|投资|安全|launch|open|policy|attack/.test(text) ? 1 : 0) + (text.length > 120 ? .35 : 0);
  const importance = score >= 3.7 ? "重要" : score >= 2.5 ? "关注" : "观察";
  const category = topic === "AI 与模型" ? "ai" : topic === "市场与政策" ? "market" : topic === "产品与公司" ? "product" : topic === "开发者生态" ? "builders" : "security";
  return { market, topic, importance, category, score };
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
  return `<article class="news-story ${variant} ${shape}"><div class="news-story-kicker"><span class="source-label ${escapeHtml(item.source)}">${escapeHtml(item.sourceLabel || item.source)}</span><span>${tag}</span></div><div class="news-story-context"><span>${escapeHtml(meta.topic)}</span><span>${escapeHtml(meta.market)}</span><strong>${escapeHtml(meta.importance)}</strong></div><h3>${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(title || fallbackTitle)}</a>` : escapeHtml(title || fallbackTitle)}</h3><p>${escapeHtml(summary || fallbackSummary)}</p><footer><span>${escapeHtml(item.author || item.attribution || (newsLanguage === "en" ? "Public source" : "公开来源"))}</span><time>${escapeHtml(formatDate(item.publishedAt, true))}</time>${item.url ? `<a class="news-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer" aria-label="打开原文" title="打开原文"><i data-lucide="external-link"></i></a>` : ""}</footer></article>`;
}

// Distribute supporting stories by estimated length so each column grows independently.
function renderNewspaperColumns(pageItems) {
  const lead = pageItems[0];
  const columns = [[], []];
  const heights = [0, 0];
  pageItems.slice(1).forEach((item) => { const target = heights[0] <= heights[1] ? 0 : 1; columns[target].push(item); heights[target] += storyWeight(item); });
  return `<div class="newspaper-grid"><div class="newspaper-lead-column">${newspaperStory(lead, "lead")}</div>${columns.map((column) => `<div class="newspaper-column">${column.map((item) => newspaperStory(item, "secondary")).join("")}</div>`).join("")}</div>`;
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
function setNewsLanguage(language) { newsLanguage = language === "en" ? "en" : "zh"; localStorage.setItem("jessboard-news-language", newsLanguage); renderNews(); lucide.createIcons(); }

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
  renderSourceStatus();
}

// Format large development counters without overwhelming the dashboard.
function compactNumber(value) { return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0); }

// Render one ranked development list while keeping empty and unavailable states explicit.
function renderDevList(target, entries, emptyLabel) {
  const element = document.querySelector(target);
  element.innerHTML = entries?.length ? entries.map((entry) => `<div class="dev-list-row"><span title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</span><strong>${compactNumber(entry.count)}</strong></div>`).join("") : `<span class="dev-empty">${escapeHtml(emptyLabel)}</span>`;
}

// Render recent commit rows from a public or local source.
function renderDevCommits(target, commits, emptyLabel) {
  const element = document.querySelector(target);
  element.innerHTML = commits?.length ? commits.map((commit) => `<article class="dev-commit"><div><strong>${escapeHtml(commit.message || "未命名提交")}</strong><span>${escapeHtml(commit.repo || commit.date || "本地仓库")} ${commit.sha ? `· ${escapeHtml(commit.sha.slice(0, 7))}` : ""}</span></div><em>${commit.additions != null ? `+${compactNumber(commit.additions)} / -${compactNumber(commit.deletions)}` : "已记录"}</em></article>`).join("") : `<span class="dev-empty">${escapeHtml(emptyLabel)}</span>`;
}

// Render the Codex, GitHub, and local workspace development dashboard.
function renderDevMetrics() {
  if (!devMetrics) return;
  const codex = devMetrics.codex || {};
  const tokens = codex.tokenUsage || {};
  const recentTokens = codex.recentTokenUsage || {};
  const github = devMetrics.github || {};
  const local = devMetrics.localGit || {};
  const metricCards = [
    ["Codex 总 Token", compactNumber(tokens.total_tokens), "本机会话累计"],
    ["近 7 日 Token", compactNumber(recentTokens.total_tokens), "最近一周"],
    ["Codex 会话", compactNumber(codex.sessionCount), `${compactNumber(codex.activeSessionCount)} 个活跃`],
    ["GitHub 提交", github.state === "ready" ? compactNumber(github.commitCount) : "--", github.state === "ready" ? `@${github.username}` : "公共活动不可用"]
  ];
  document.querySelector("#dev-metric-grid").innerHTML = metricCards.map(([label, value, detail]) => `<article class="dev-metric"><p class="eyebrow">${label}</p><strong>${value}</strong><span>${detail}</span></article>`).join("");
  document.querySelector("#codex-token-summary").innerHTML = [["输入", tokens.input_tokens], ["输出", tokens.output_tokens], ["推理", tokens.reasoning_output_tokens]].map(([label, value]) => `<div><strong>${compactNumber(value)}</strong><span>${label} Token</span></div>`).join("");
  const tokenBars = [["输入 Token", tokens.input_tokens], ["缓存输入", tokens.cached_input_tokens], ["输出 Token", tokens.output_tokens], ["推理输出", tokens.reasoning_output_tokens]];
  const maxToken = Math.max(...tokenBars.map(([, value]) => Number(value) || 0), 1);
  document.querySelector("#codex-token-bars").innerHTML = tokenBars.map(([label, value]) => `<div class="dev-bar-row"><span>${label}</span><div class="dev-bar-track"><span style="width:${Math.max(2, Math.round((Number(value) || 0) / maxToken * 100))}%"></span></div><strong>${compactNumber(value)}</strong></div>`).join("");
  renderDevList("#dev-skills", codex.skills, "尚未识别到 skill 调用");
  renderDevList("#dev-tools", codex.tools, "尚未识别到工具调用");
  document.querySelector("#github-state").textContent = github.state === "ready" ? `@${github.username}` : "不可用";
  document.querySelector("#github-state").className = `status-chip ${github.state === "ready" ? "blue" : "orange"}`;
  document.querySelector("#github-summary").innerHTML = [["提交", github.commitCount], ["新增行", github.additions], ["删除行", github.deletions]].map(([label, value]) => `<div><strong>${github.state === "ready" ? compactNumber(value) : "--"}</strong><span>${label}</span></div>`).join("");
  renderDevCommits("#github-commits", github.commits, github.state === "ready" ? "最近没有公开提交" : github.detail || "GitHub 公共活动暂不可用");
  document.querySelector("#local-summary").innerHTML = [["未提交新增", local.workingTree?.additions], ["未提交删除", local.workingTree?.deletions], ["本地提交", local.commitCount]].map(([label, value]) => `<div><strong>${compactNumber(value)}</strong><span>${label}</span></div>`).join("");
  renderDevCommits("#local-commits", local.commits, "当前仓库没有匹配的本地提交");
  const quotaNote = codex.quota?.detail || "仅展示本机记录";
  document.querySelector("#dev-notice").innerHTML = `<i data-lucide="shield-check"></i><span>${escapeHtml(quotaNote)}；不显示会话正文、凭证或代码内容。</span>`;
}

// Fetch fresh development metrics from the local service on demand.
async function loadDevMetrics() {
  if (devMetricsLoading) return;
  devMetricsLoading = true;
  const button = document.querySelector("#refresh-dev-metrics");
  button.disabled = true;
  button.innerHTML = "<i data-lucide=\"loader-circle\" class=\"spin\"></i>统计中";
  lucide.createIcons();
  try {
    const response = await fetch("/api/dev-metrics");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    devMetrics = await response.json();
    document.querySelector("#dev-updated").textContent = `更新于 ${formatDate(devMetrics.fetchedAt, true)}`;
    renderDevMetrics();
  } catch (error) {
    document.querySelector("#dev-notice").innerHTML = `<i data-lucide="triangle-alert"></i><span>开发统计暂不可用：${escapeHtml(error.message)}。请确认本机服务已启动。</span>`;
  } finally {
    devMetricsLoading = false;
    button.disabled = false;
    button.innerHTML = "<i data-lucide=\"refresh-cw\"></i>刷新统计";
    lucide.createIcons();
  }
}

// Fetch all three news providers through the local service.
async function refreshNews() {
  const button = document.querySelector("#refresh-news");
  button.disabled = true;
  button.innerHTML = "<i data-lucide=\"loader-circle\" class=\"spin\"></i>刷新中";
  lucide.createIcons();
  try {
    const response = await fetch("/api/news");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    newsItems = payload.items || [];
    newsPage = 0;
    providerStatuses = payload.providers || {};
    document.querySelector("#news-updated").textContent = payload.fetchedAt ? `更新于 ${formatDate(payload.fetchedAt, true)}` : "已刷新";
  } catch (error) {
    newsItems = [];
    providerStatuses = { aihot: { state: "error", detail: "服务未启动" }, builders: { state: "error", detail: "服务未启动" }, worldmonitor: { state: "error", detail: "服务未启动" } };
    document.querySelector("#news-updated").textContent = "请先启动本机服务";
  } finally {
    button.disabled = false;
    button.innerHTML = "<i data-lucide=\"refresh-cw\"></i>手动刷新";
    renderNews();
    lucide.createIcons();
  }
}

// Rebuild every dynamic section after local changes.
function renderApp() { renderInsights(); renderPriorities(); renderAllTasks(); renderProjects(); renderRhythm(); renderKanban(); renderFocusOptions(); renderSourceStatus(); lucide.createIcons(); }

// Switch between views without leaving the single-page workbench.
function setView(view) {
  document.querySelectorAll("[data-view-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === view));
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  const titles = { dashboard: "把重要的事做好。", today: "今天，先完成最重要的。", projects: "让每个项目向前一步。", focus: "给注意力留出空间。", dev: "看见自己的开发节奏。", news: "保持对世界的感知。" };
  document.querySelector("#page-title").textContent = titles[view] || titles.dashboard;
  if (view === "dev") {
    if (!devMetrics) loadDevMetrics();
    if (!devRefreshTimer) devRefreshTimer = window.setInterval(() => { if (document.querySelector("#dev-view").classList.contains("active")) loadDevMetrics(); }, 30000);
  }
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

// Wire shared controls, filters, navigation, and dialogs.
function bindEvents() {
  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-toggle-task]"); const deletion = event.target.closest("[data-delete-task]"); const choice = event.target.closest("[data-focus-task]"); const navigation = event.target.closest("[data-view], [data-go-to]"); const taskTab = event.target.closest("[data-task-filter]"); const newsTab = event.target.closest("[data-news-filter]"); const languageTab = event.target.closest("[data-news-language]");
    if (toggle) toggleTask(toggle.dataset.toggleTask);
    if (deletion) deleteTask(deletion.dataset.deleteTask);
    if (choice) { data.selectedTaskId = choice.dataset.focusTask; saveData(); renderFocusOptions(); lucide.createIcons(); }
    if (navigation) setView(navigation.dataset.view || navigation.dataset.goTo);
    if (taskTab) { taskFilter = taskTab.dataset.taskFilter; document.querySelectorAll("[data-task-filter]").forEach((tab) => tab.classList.toggle("active", tab === taskTab)); renderAllTasks(); lucide.createIcons(); }
    if (newsTab) { newsFilter = newsTab.dataset.newsFilter; newsPage = 0; document.querySelectorAll("[data-news-filter]").forEach((tab) => tab.classList.toggle("active", tab === newsTab)); renderNews(); lucide.createIcons(); }
    if (languageTab) setNewsLanguage(languageTab.dataset.newsLanguage);
  });
  document.addEventListener("change", (event) => { if (event.target.matches("[data-status-task]")) changeTaskStatus(event.target.dataset.statusTask, event.target.value); });
  document.querySelector("#open-task-dialog").addEventListener("click", () => document.querySelector("#task-dialog").showModal());
  document.querySelector("#close-task-dialog").addEventListener("click", () => document.querySelector("#task-dialog").close());
  document.querySelector("#cancel-task-dialog").addEventListener("click", () => document.querySelector("#task-dialog").close());
  document.querySelector("#task-form").addEventListener("submit", addTask);
  document.querySelector("#clear-completed").addEventListener("click", () => { data.tasks = data.tasks.filter((task) => task.status !== "done"); saveData(); renderApp(); });
  document.querySelector("#timer-start").addEventListener("click", toggleTimer);
  document.querySelector("#timer-reset").addEventListener("click", () => { timerSeconds = 25 * 60; renderTimer(); });
  document.querySelector("#theme-toggle").addEventListener("click", () => { document.body.classList.toggle("dark"); localStorage.setItem("jessboard-theme", document.body.classList.contains("dark") ? "dark" : "light"); });
  document.querySelector("#refresh-news").addEventListener("click", refreshNews);
  document.querySelector("#refresh-dev-metrics").addEventListener("click", loadDevMetrics);
  document.querySelector("#news-prev").addEventListener("click", () => { if (newsPage > 0) { newsPage -= 1; renderNews(); lucide.createIcons(); } });
  document.querySelector("#news-next").addEventListener("click", () => { const pageCount = Math.max(1, Math.ceil(sortedNewsItems().length / newsPageSize)); if (newsPage < pageCount - 1) { newsPage += 1; renderNews(); lucide.createIcons(); } });
}

// Set the current date labels in the Chinese locale.
function renderToday() { const now = new Date(); document.querySelector("#page-kicker").textContent = new Intl.DateTimeFormat("zh-CN", { weekday: "long", month: "long", day: "numeric" }).format(now); document.querySelector("#today-date").textContent = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(now); document.querySelector("#news-edition-date").textContent = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(now); }

if (localStorage.getItem("jessboard-theme") === "dark") document.body.classList.add("dark");
populateProjectMenu();
bindEvents();
renderToday();
renderApp();
renderNews();
renderTimer();
loadContext();
loadShanghaiWeather();
