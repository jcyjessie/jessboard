// Provides dynamic business-goal grouping for synchronized Feishu work.
window.BusinessGoalTaxonomy = [
  {
    id: "portfolio-data-reliability",
    name: { zh: "投组数据与风控可靠性", en: "Portfolio data and risk reliability" },
    summary: { zh: "让资产、净值、实时与风控数据保持准确、可追踪和稳定。", en: "Keep portfolio, valuation, real-time, and risk data accurate and dependable." },
    color: "#86c8eb",
    keywords: ["投组", "pnl", "fund", "fundinfo", "对账", "净值", "估值", "实时", "eod", "历史", "chain", "资产", "账户", "告警", "风控", "监控", "grafana", "数据"]
  },
  {
    id: "market-connectivity",
    name: { zh: "多渠道账户与交易接入", en: "Account and market connectivity" },
    summary: { zh: "扩展交易所、经纪商和链上协议的账户、订单与资金数据接入。", en: "Expand account, order, and funding integrations across markets and protocols." },
    color: "#f2b86f",
    keywords: ["alpaca", "ibkr", "coinbase", "bybit", "bitget", "okx", "gate", "kraken", "币安", "coin-call", "coincall", "polymarket", "merkl", "morpho", "etherlink", "defi", "鉴权", "oauth", "flex", "broker", "交易所", "充提", "委托", "合约", "contract", "future", "futures", "perp", "xperp"]
  },
  {
    id: "reporting-operations",
    name: { zh: "报告与运营自动化", en: "Reporting and operations automation" },
    summary: { zh: "减少报告、下载、排队与日常运营中的人工等待和重复处理。", en: "Reduce manual waiting and repeated work in reporting and daily operations." },
    color: "#b8f85b",
    keywords: ["报告", "下载", "导出", "定时", "文件", "排队", "backlog", "同步", "文档", "工作流", "任务", "日志", "工具"]
  },
  {
    id: "product-delivery",
    name: { zh: "产品体验与交付协同", en: "Product experience and delivery" },
    summary: { zh: "推进页面体验、功能验证和跨角色协同，确保需求能够完成交付。", en: "Move experience, validation, and cross-team coordination through delivery." },
    color: "#b58aff",
    keywords: ["产品", "页面", "前端", "1ndex", "需求", "验收", "测试", "评审", "体验", "交互", "修复", "优化", "登录", "策略", "配置"]
  }
];

// Keep generic action words out of automatic objective names.
const businessGoalStopWords = new Set(["支持", "优化", "修复", "新增", "更新", "处理", "排查", "检查", "增加", "实现", "相关", "问题", "需求", "任务", "事项", "功能", "数据", "项目", "执行", "确认", "方案", "发起", "编写", "等待", "记录", "时间", "状态", "接口", "页面", "展示", "飞书", "auto", "bot", "todo", "done", "task", "test", "api", "cam", "feishu", "created", "updated", "create", "update", "status"]);

// Return a language-aware field from a taxonomy entry.
function businessGoalLabel(goal, field, language) {
  const value = goal?.[field];
  return typeof value === "string" ? value : value?.[language] || value?.zh || "";
}

// Extract stable domain signals from task text without sending private work content outside the browser.
function businessGoalSignals(task) {
  const text = `${task.title || ""} ${task.project || ""} ${task.nextStep || ""}`.toLowerCase().replace(/任务发起|方案确认|需求设计|测试用例编写|待确认下一步/g, " ");
  const signals = new Set();
  for (const token of text.match(/[a-z0-9][a-z0-9-]{2,}/g) || []) if (!/^\d+$/.test(token) && !businessGoalStopWords.has(token)) signals.add(token);
  for (const fragment of text.match(/[\u4e00-\u9fff]{2,}/g) || []) {
    for (let size = 2; size <= Math.min(4, fragment.length); size += 1) {
      for (let index = 0; index <= fragment.length - size; index += 1) {
        const token = fragment.slice(index, index + size);
        if (!businessGoalStopWords.has(token)) signals.add(token);
      }
    }
  }
  return [...signals];
}

// Score a task against a stable goal family using the configured domain vocabulary.
function scoreBusinessGoal(task, goal) {
  const text = `${task.title || ""} ${task.project || ""} ${task.nextStep || ""}`.toLowerCase();
  return (goal.keywords || []).reduce((score, keyword) => text.includes(String(keyword).toLowerCase()) ? score + String(keyword).length : score, 0);
}

// Pick a concise recurring signal for an automatically discovered objective.
function dynamicGoalTopic(tasks) {
  const frequency = new Map();
  tasks.forEach((task) => businessGoalSignals(task).forEach((signal) => frequency.set(signal, (frequency.get(signal) || 0) + 1)));
  return [...frequency.entries()]
    .filter(([signal, count]) => count > 1 && (/[\u4e00-\u9fff]/.test(signal) ? signal.length >= 2 : signal.length >= 3))
    .sort((left, right) => right[1] - left[1] || right[0].length - left[0].length)[0]?.[0] || "待确认事项";
}

// Split unmatched work into independently recurring topics before creating candidate objectives.
function dynamicGoalBuckets(tasks) {
  const frequency = new Map();
  tasks.forEach((task) => businessGoalSignals(task).forEach((signal) => frequency.set(signal, (frequency.get(signal) || 0) + 1)));
  const recurring = [...frequency.entries()]
    .filter(([signal, count]) => count > 1 && (/[\u4e00-\u9fff]/.test(signal) ? signal.length >= 2 : signal.length >= 3))
    .sort((left, right) => right[1] - left[1] || right[0].length - left[0].length)
    .map(([signal]) => signal);
  const buckets = new Map();
  const fallback = [];
  tasks.forEach((task) => {
    const topic = recurring.find((signal) => businessGoalSignals(task).includes(signal));
    if (!topic) { fallback.push(task); return; }
    const bucket = buckets.get(topic) || [];
    bucket.push(task);
    buckets.set(topic, bucket);
  });
  return { buckets, fallback };
}

// Build stable, language-aware objectives from current work and locally retained history.
function buildBusinessGoals(tasks, previousState = {}, language = "zh") {
  const families = window.BusinessGoalTaxonomy || [];
  const grouped = new Map(families.map((family) => [family.id, { ...family, name: businessGoalLabel(family, "name", language), summary: businessGoalLabel(family, "summary", language), tasks: [] }]));
  const unmatched = [];
  tasks.forEach((task) => {
    const match = families.map((family) => ({ family, score: scoreBusinessGoal(task, family) })).sort((left, right) => right.score - left.score)[0];
    if (match?.score > 0) grouped.get(match.family.id).tasks.push(task);
    else unmatched.push(task);
  });
  const { buckets, fallback: unmatchedFallback } = dynamicGoalBuckets(unmatched);
  buckets.forEach((bucket, topic) => {
    if (bucket.length < 2 || topic === "待确认事项") { unmatchedFallback.push(...bucket); return; }
    const id = `emerging-${topic.replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-").slice(0, 24)}`;
    grouped.set(id, {
      id,
      color: "#6e8175",
      name: language === "en" ? `Emerging objective: ${topic}` : `新出现目标：${topic}`,
      summary: language === "en" ? "A recurring work theme discovered in the latest refresh." : "最新刷新中出现的重复工作主题，会在后续刷新中继续聚合。",
      tasks: bucket,
      emerging: true
    });
  });
  if (unmatchedFallback.length) {
    const fallback = grouped.get("product-delivery") || grouped.values().next().value;
    if (fallback) fallback.tasks.push(...unmatchedFallback);
  }
  const seenAt = new Date().toISOString();
  const previous = new Map((previousState.goals || []).map((goal) => [goal.id, goal]));
  const hasHistory = previous.size > 0;
  const groups = [...grouped.values()].filter((group) => group.tasks.length).map((group) => {
    const signature = group.tasks.map((task) => `${task.id || task.title}:${task.updatedAt || ""}:${task.progress || 0}`).sort().join("|");
    const prior = previous.get(group.id);
    const focus = dynamicGoalTopic(group.tasks);
    return { ...group, focus, lifecycle: !prior ? (hasHistory ? "new" : "stable") : prior.signature === signature ? "stable" : "updated", signature, lastSeenAt: seenAt };
  }).sort((left, right) => right.tasks.length - left.tasks.length || left.name.localeCompare(right.name, language === "en" ? "en" : "zh-CN"));
  const activeIds = new Set(groups.map((group) => group.id));
  const archived = (previousState.goals || []).filter((goal) => !activeIds.has(goal.id)).map((goal) => ({ ...goal, archivedAt: seenAt }));
  return { groups, state: { goals: groups.map(({ tasks: ignoredTasks, ...goal }) => goal), archived: [...archived, ...(previousState.archived || [])].slice(0, 24), updatedAt: seenAt } };
}

// Expose the deterministic engine so dashboard refreshes can rebuild objectives without an external model.
window.BusinessGoalEngine = { build: buildBusinessGoals };
