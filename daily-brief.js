// Daily Brief turns the read-only Feishu snapshot into a short, action-led dashboard view.
(() => {
  const DAY = 24 * 60 * 60 * 1000;
  const SHANGHAI = "Asia/Shanghai";

  // Convert an optional date-like value into a usable timestamp.
  function timeOf(value) {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) && time > 0 ? time : null;
  }

  // Format a timestamp as a Shanghai calendar key for reliable daily comparisons.
  function dayKey(time) {
    return time ? new Intl.DateTimeFormat("en-CA", { timeZone: SHANGHAI, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(time)) : "";
  }

  // Check whether a timestamp belongs to the current Shanghai day.
  function isToday(time, now) {
    return Boolean(time) && dayKey(time) === dayKey(now);
  }

  // Format a time without adding an unnecessary date label.
  function formatTime(time) {
    return time ? new Intl.DateTimeFormat("zh-CN", { timeZone: SHANGHAI, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(time)) : "暂无时间";
  }

  // Shorten Markdown-heavy titles while keeping their useful meaning.
  function cleanText(value, limit = 76) {
    const text = String(value || "")
      .replace(/!?\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/[>*_`#]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > limit ? `${text.slice(0, limit)}...` : text;
  }

  // Identify task records that can reasonably affect this person's daily plan.
  function isRelevantTask(task) {
    const text = `${task.title || ""} ${task.project || ""}`;
    return task.source === "lark-task" || /实时|eod|图表/i.test(text);
  }

  // Keep abandoned historical assignments out of the active daily brief.
  function isStaleTask(task, now) {
    const due = timeOf(task.dueAt);
    const updated = timeOf(task.updatedAt || task.createdAt);
    return task.source === "lark-task" && due && due < now - 14 * DAY && (!updated || updated < now - 14 * DAY);
  }

  // Exclude image-only and long-unupdated task titles that cannot guide a next action.
  function isActionableTask(task, now) {
    const title = cleanText(task.title, 120);
    const updated = timeOf(task.updatedAt || task.createdAt);
    if (title.length < 5 || /^\[?图片\]?/.test(title)) return false;
    if (/全部都重建好了|看着.*没问题|已经完成/.test(title) && !/需|需要|确认|审阅|评审|检查|回复|跟进|看看/.test(title)) return false;
    return !updated || updated >= now - 14 * DAY;
  }

  // Treat completed workflow progress as closed even when its raw status has not caught up.
  function isClosed(task) {
    return task.status === "done" || Number(task.progress) >= 100;
  }

  // Describe a task's practical state in terms a daily review can use.
  function taskState(task) {
    const text = `${task.title || ""} ${task.nextStep || ""}`;
    if (/等待|待.*确认|待.*回复|对方确认|依赖|阻塞/.test(text)) return { key: "waiting", label: "等待他人" };
    if (/确认|回复|跟进|评审|审阅|处理/.test(text)) return { key: "decision", label: "待推进" };
    return { key: "active", label: "进行中" };
  }

  // Rank tasks by the urgency a person needs to act on today.
  function rankTask(task, now) {
    const due = timeOf(task.dueAt);
    const updated = timeOf(task.updatedAt);
    const text = `${task.title || ""} ${task.nextStep || ""}`;
    const state = taskState(task);
    const hoursToDue = due == null ? null : (due - now) / (60 * 60 * 1000);
    let score = 60;
    let reason = "需要明确下一步";
    if (hoursToDue !== null && hoursToDue < 0) { score = 0; reason = "已超过截止时间"; }
    else if (due && isToday(due, now)) { score = 5; reason = `今天 ${formatTime(due)} 截止`; }
    else if (hoursToDue !== null && hoursToDue <= 48) { score = 15; reason = "两天内截止"; }
    else if (/客户|报障|问题|紧急|超时/.test(text)) { score = 25; reason = "涉及客户或问题处理"; }
    else if (state.key === "waiting") { score = 35; reason = "需要确认外部依赖"; }
    else if (updated && now - updated < DAY) { score = 45; reason = "近期有新进展"; }
    return { ...task, due, updated, state, reason, score, action: task.nextStep || (state.key === "waiting" ? "确认对方反馈和推进时间" : "在飞书中确认下一步") };
  }

  // Give each meeting a lightweight preparation prompt based on its purpose.
  function meetingPreparation(item) {
    const title = item.title || "";
    if (/站会|同步/.test(title)) return "梳理今天进展、阻塞和需要协调的事项";
    if (/评审|讨论|澄清/.test(title)) return "带上方案选项、待决问题和期望结论";
    if (/客户|外部|catch up/i.test(title)) return "确认对外口径、待回复问题和下一步负责人";
    return "确认会议目标，并准备需要同步的事项";
  }

  // Find one related task when a meeting and task share a useful work keyword.
  function relatedTask(item, tasks) {
    const title = item.title || "";
    const keywords = ["实时", "EOD", "图表", "客户", "报告", "需求", "评审"];
    const keyword = keywords.find((entry) => title.toLowerCase().includes(entry.toLowerCase()));
    return keyword ? tasks.find((task) => `${task.title || ""} ${task.project || ""}`.toLowerCase().includes(keyword.toLowerCase())) : null;
  }

  // Score messages conservatively so only plausible reply candidates are shown.
  function messageScore(message) {
    const text = `${message.chat || ""} ${message.preview || ""}`;
    if (!cleanText(message.preview, 200) || /飞书项目|工单机器人|邮箱助手|机器人/.test(message.sender || "")) return { score: 0, reason: "" };
    let score = 0;
    const reasons = [];
    if (/@曹逸婕|@你/.test(text)) { score += 5; reasons.push("明确提及你"); }
    if (/^Direct message$/i.test(message.chat || "")) { score += 4; reasons.push("来自私聊"); }
    if (/【外部】|客户|外部业务/.test(message.chat || "")) { score += 3; reasons.push("涉及外部沟通"); }
    if (/\?|？|是否|可以吗|能否/.test(text)) { score += 2; reasons.push("包含待确认问题"); }
    if (/请(?!假)|麻烦|帮忙|回复|确认|跟进|处理|看看|指引/.test(text)) { score += 2; reasons.push("包含行动请求"); }
    return { score, reason: reasons[0] || "需要人工判断" };
  }

  // Extract recent messages that deserve a manual response decision.
  function replyCandidates(messages, ignoredMessageIds) {
    return messages
      .map((message) => ({ ...message, ...messageScore(message) }))
      .filter((message) => message.score >= 5 && !ignoredMessageIds.has(message.id))
      .sort((left, right) => right.score - left.score || (timeOf(right.createdAt) || 0) - (timeOf(left.createdAt) || 0))
      .slice(0, 4)
      .map((message) => ({ ...message, preview: cleanText(message.preview, 112) }));
  }

  // Build the complete dashboard brief without changing the source snapshot.
  function build(context, options = {}) {
    const now = options.now || Date.now();
    const ignoredMessageIds = new Set(options.ignoredMessageIds || []);
    const feishu = context?.feishu || {};
    const allTasks = [...(feishu.todoTasks || []), ...(feishu.tasks || []), ...(feishu.inferredTasks || [])]
      .filter(isRelevantTask)
      .filter((task) => !isStaleTask(task, now));
    const activeTasks = allTasks.filter((task) => !isClosed(task) && isActionableTask(task, now)).map((task) => rankTask(task, now)).sort((left, right) => left.score - right.score || (right.updated || 0) - (left.updated || 0));
    const meetings = (feishu.schedule || [])
      .filter((item) => item.source === "lark-calendar")
      .map((item) => ({ ...item, startTime: timeOf(item.start), endTime: timeOf(item.end) }))
      .filter((item) => item.startTime && item.endTime >= now && item.startTime < now + 48 * 60 * 60 * 1000)
      .sort((left, right) => left.startTime - right.startTime)
      .slice(0, 4)
      .map((item) => ({ ...item, preparation: meetingPreparation(item), relatedTask: relatedTask(item, activeTasks) }));
    const reply = replyCandidates(feishu.messages || [], ignoredMessageIds);
    const risks = activeTasks.filter((task) => task.score <= 35 || task.state.key === "waiting").slice(0, 3);
    const closed = allTasks.filter(isClosed).filter((task) => {
      const updated = timeOf(task.updatedAt);
      return updated && updated >= now - 2 * DAY;
    }).sort((left, right) => (timeOf(right.updatedAt) || 0) - (timeOf(left.updatedAt) || 0)).slice(0, 3);
    const tomorrowKey = dayKey(now + DAY);
    const tomorrowCount = activeTasks.filter((task) => task.due && dayKey(task.due) === tomorrowKey).length + meetings.filter((item) => dayKey(item.startTime) === tomorrowKey).length;
    return {
      generatedAt: context?.syncedAt || null,
      priorities: activeTasks.slice(0, 5),
      meetings,
      reply,
      risks,
      closed,
      tomorrowCount,
      summary: {
        priorities: activeTasks.filter((task) => task.score <= 35).length,
        meetings: meetings.filter((item) => isToday(item.startTime, now)).length,
        reply: reply.length,
        waiting: activeTasks.filter((task) => task.state.key === "waiting").length
      }
    };
  }

  window.DailyBrief = { build };
})();
