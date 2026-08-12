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

  // Convert a structured approval notification into a readable, complete sentence.
  function summarizeApproval(value) {
    const raw = String(value || "");
    const text = cleanText(raw, 1200)
      .replace(/\s+\[(?:查看详情|已同意|已拒绝|已撤回|已取消)[\s\S]*$/u, "")
      .trim();
    if (!/申请人|审批事由/.test(text)) return null;
    const applicant = text.match(/申请人\s*@?([^\s(（]+)/)?.[1] || "";
    const reason = text.match(/原因\s*[:：]\s*(.+?)(?=\s+(?:单选|多选|开始时间|结束时间|审批结果)|$)/)?.[1]?.trim() || "";
    const category = text.match(/单选\s*[:：]\s*(.+?)(?=\s+(?:多选|开始时间|结束时间|审批结果)|$)/)?.[1]?.trim() || "";
    const start = text.match(/开始时间\s*[:：]\s*(.+?)(?=\s+(?:结束时间|审批结果)|$)/)?.[1]?.replace(/\s+---.*$/, "").trim() || "";
    const decision = raw.match(/已同意|已拒绝|已撤回|已取消/)?.[0] || "";
    if (!applicant && !reason && !start) return null;
    const subject = applicant ? `${applicant}申请` : "审批申请";
    const details = [reason, category ? `类型：${category}` : "", start ? `开始时间：${start}` : ""].filter(Boolean);
    return `${subject}${details.length ? `：${details.join("；")}` : ""}${decision ? `。${decision}` : ""}`;
  }

  // Summarize any message into its context and the most useful next action.
  function summarizeMessage(value, limit = 68) {
    const text = cleanText(value, 1400)
      .replace(/(?:^|\s)---+\s*/g, " ")
      .replace(/\[(?:Button|查看详情|已同意|已拒绝|已撤回|已取消)[^\]]*\]/giu, "")
      .trim();
    if (!text) return "";

    const dailyReview = text.match(/^每日回顾\s*[·:：-]\s*(.+)$/u);
    if (dailyReview) {
      const detail = dailyReview[1];
      const marker = detail.search(/(?:你今天的主线|今日重点|重点事项|今天需要)/u);
      const overview = (marker >= 0 ? detail.slice(0, marker) : detail)
        .replace(/\s*[·•]\s*/gu, "；")
        .replace(/\d+\s*月\s*\d+\s*日\s*/u, "")
        .replace(/(\d+)\s*个智能优化建议/u, "$1项建议")
        .replace(/\s+/gu, "")
        .replace(/[。；\s]+$/u, "");
      const focus = marker >= 0 ? detail.slice(marker).replace(/^(?:你今天的主线|今日重点|重点事项|今天需要)[^：:]*[：:]?\s*/u, "").split(/[。！？!?]/u)[0].trim() : "";
      return cleanText(`今日：${overview}${focus ? `；${focus.replace(/^本周/u, "")}` : ""}`, limit);
    }

    const parts = text.split(/[。！？!?；;]/u).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) return cleanText(text, limit);
    const context = parts[0];
    const action = parts.find((part) => /请|需要|确认|回复|跟进|处理|评审|安排|完成|主持|准备/u.test(part));
    return cleanText(action && action !== context ? `${context}；${action}` : context, limit);
  }

  // Identify task records that can reasonably affect this person's daily plan.
  function isRelevantTask(task) {
    const text = `${task.title || ""} ${task.project || ""}`;
    return task.source === "lark-task" || (task.myWorkActions || []).length > 0 || task.inBusinessScope === true || /实时|eod|图表/i.test(text);
  }

  // Keep overdue, unrefreshed assignments out of the action-focused daily brief.
  function isStaleTask(task, now) {
    const due = timeOf(task.dueAt);
    const updated = timeOf(task.updatedAt || task.createdAt);
    const activeWindow = 3 * DAY;
    return task.source === "lark-task" && due && due < now - activeWindow && (!updated || updated < now - activeWindow);
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
    const text = `${task.nextStep || ""} ${task.myWorkState || ""}`;
    if (/等待|待.*确认|待.*回复|对方确认|依赖|阻塞/.test(text)) return { key: "waiting", label: "等待他人" };
    if (/确认|回复|跟进|评审|审阅|处理/.test(text)) return { key: "decision", label: "待推进" };
    return { key: "active", label: "进行中" };
  }

  // Rank tasks only when there is enough evidence for a person to act today.
  function rankTask(task, now) {
    const due = timeOf(task.dueAt);
    const updated = timeOf(task.updatedAt);
    const text = `${task.nextStep || ""} ${task.myWorkState || ""}`;
    const state = taskState(task);
    const hoursToDue = due == null ? null : (due - now) / (60 * 60 * 1000);
    const isAutoGenerated = /🤖\s*auto/i.test(task.title || "") || task.source === "lark-inferred";
    const hasExternalImpact = /客户|报障|线上故障|紧急|超时/.test(text);
    const hasActionRequest = /请|需|需要|确认|回复|跟进|处理|修复|排查/.test(text);
    const isMyWorkOverdue = (task.myWorkActions || []).includes("overdue");
    const hasMyWorkAction = (task.myWorkActions || []).some((action) => action === "todo" || action === "this_week" || action === "overdue");
    const hasRecentManualProgress = updated && now - updated < DAY && !isAutoGenerated;
    let score = 60;
    let reason = "需要明确下一步";
    if (isMyWorkOverdue || (hoursToDue !== null && hoursToDue < 0)) { score = 0; reason = isMyWorkOverdue ? "飞书 Project 标记为逾期" : "已超过截止时间"; }
    else if (due && isToday(due, now)) { score = 5; reason = `今天 ${formatTime(due)} 截止`; }
    else if (hoursToDue !== null && hoursToDue <= 48) { score = 15; reason = "两天内截止"; }
    else if (hasMyWorkAction) { score = 25; reason = "飞书 Project 的个人待办"; }
    else if (hasExternalImpact && hasActionRequest) { score = 30; reason = "外部影响且需要立即处理"; }
    else if (state.key === "waiting") { score = 35; reason = "需要确认外部依赖"; }
    else if (hasActionRequest && !isAutoGenerated) { score = 40; reason = "有明确推进请求"; }
    else if (hasRecentManualProgress) { score = 45; reason = "近期有人工推进"; }
    return { ...task, due, updated, state, reason, score, qualifiesForToday: score <= 45, action: task.nextStep || (state.key === "waiting" ? "确认对方反馈和推进时间" : "在飞书中确认下一步") };
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

  // Keep group-message relevance tied to the user's explicitly managed business scope.
  function isBusinessScopedMessage(message) {
    const text = `${message.chat || ""} ${message.preview || ""}`;
    return /实时(?:\s*[&和]\s*)?eod|\beod\b|end of day|real-time|realtime|行情|市场数据|图表|k线|candlestick|ohlc|ticker|报价|基金净值|实时风险|风险表|风险指标|ai agents?|ai 前台|智能体|自动技术分析|auto ta/i.test(text);
  }

  // Score messages conservatively so only plausible reply candidates are shown.
  function messageScore(message) {
    const text = `${message.chat || ""} ${message.preview || ""}`;
    if (!cleanText(message.preview, 200) || /飞书项目|工单机器人|邮箱助手|机器人/.test(message.sender || "")) return { score: 0, reason: "" };
    let score = 0;
    const reasons = [];
    const mentionsUser = /@曹逸婕|@你/.test(text);
    const isDirect = /^Direct message$/i.test(message.chat || "");
    const inBusinessScope = isBusinessScopedMessage(message);
    if (mentionsUser) { score += 5; reasons.push("明确提及你"); }
    if (isDirect) { score += 4; reasons.push("来自私聊"); }
    if (inBusinessScope) { score += 3; reasons.push("涉及当前业务范围"); }
    if (/\?|？|是否|可以吗|能否/.test(text)) { score += 2; reasons.push("包含待确认问题"); }
    if (/请(?!假)|麻烦|帮忙|回复|确认|跟进|处理|看看|指引/.test(text)) { score += 2; reasons.push("包含行动请求"); }
    return { score, reason: reasons[0] || "需要人工判断", eligible: mentionsUser || isDirect };
  }

  // Extract recent messages that deserve a manual response decision.
  function replyCandidates(messages, ignoredMessageIds) {
    return messages
      .map((message) => ({ ...message, ...messageScore(message) }))
      .filter((message) => message.eligible && message.score >= 5 && !ignoredMessageIds.has(message.id))
      .sort((left, right) => right.score - left.score || (timeOf(right.createdAt) || 0) - (timeOf(left.createdAt) || 0))
      .slice(0, 4)
      .map((message) => {
        const approvalSummary = summarizeApproval(message.preview);
        return {
          ...message,
          chat: approvalSummary ? "审批通知" : message.chat,
          preview: approvalSummary || summarizeMessage(message.preview)
        };
      });
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
    const priorities = activeTasks.filter((task) => task.state.key !== "waiting" && task.qualifiesForToday).slice(0, 5);
    const meetings = (feishu.schedule || [])
      .filter((item) => item.source === "lark-calendar")
      .map((item) => ({ ...item, startTime: timeOf(item.start), endTime: timeOf(item.end) }))
      .filter((item) => item.startTime && item.endTime >= now && item.startTime < now + 48 * 60 * 60 * 1000)
      .sort((left, right) => left.startTime - right.startTime)
      .slice(0, 4)
      .map((item) => ({ ...item, preparation: meetingPreparation(item), relatedTask: relatedTask(item, activeTasks) }));
    const reply = replyCandidates(feishu.messages || [], ignoredMessageIds);
    const risks = activeTasks.filter((task) => task.state.key === "waiting").slice(0, 3);
    const closed = allTasks.filter(isClosed).filter((task) => {
      const updated = timeOf(task.updatedAt);
      return updated && updated >= now - 2 * DAY;
    }).sort((left, right) => (timeOf(right.updatedAt) || 0) - (timeOf(left.updatedAt) || 0)).slice(0, 3);
    const tomorrowKey = dayKey(now + DAY);
    const tomorrowCount = activeTasks.filter((task) => task.due && dayKey(task.due) === tomorrowKey).length + meetings.filter((item) => dayKey(item.startTime) === tomorrowKey).length;
    return {
      generatedAt: context?.syncedAt || null,
      priorities,
      meetings,
      reply,
      risks,
      closed,
      tomorrowCount,
      summary: {
        priorities: priorities.length,
        meetings: meetings.filter((item) => isToday(item.startTime, now)).length,
        reply: reply.length,
        waiting: activeTasks.filter((task) => task.state.key === "waiting").length
      }
    };
  }

  window.DailyBrief = { build };
})();
