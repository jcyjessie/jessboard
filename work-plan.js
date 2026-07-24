// Work planning ranks synchronized Project tasks and calendar commitments for the dashboard.
(() => {
  const DAY = 24 * 60 * 60 * 1000;

  // Convert a date-like value to a valid timestamp or return no date.
  function timeOf(value) {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) && time > 0 ? time : null;
  }

  // Check whether a timestamp falls on the current Shanghai calendar day.
  function isToday(time, now) {
    if (!time) return false;
    const format = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" });
    return format.format(new Date(time)) === format.format(new Date(now));
  }

  // Keep the daily plan focused on EOD work and tasks explicitly assigned to the user.
  function isRelevantTask(task) {
    return task.source === "lark-task" || task.source === "lark-inferred" || /实时|eod|图表/i.test(`${task.title || ""} ${task.project || ""}`);
  }

  // Exclude old unmaintained Feishu assignments from the active daily plan.
  function isStaleTask(task, now) {
    const due = timeOf(task.dueAt);
    const updated = timeOf(task.updatedAt || task.createdAt);
    const cutoff = now - 14 * DAY;
    return task.source === "lark-task" && due && due < cutoff && (!updated || updated < cutoff);
  }

  // Rank one task from its Project deadline, workflow state, and recent activity.
  function rankTask(task, now) {
    const dueTime = timeOf(task.dueAt);
    const updatedTime = timeOf(task.updatedAt);
    const hoursToDue = dueTime === null ? null : (dueTime - now) / (60 * 60 * 1000);
    if (hoursToDue !== null && hoursToDue < 0) return { priority: "high", score: 0, reason: "工作流截止时间已过" };
    if (dueTime && isToday(dueTime, now)) return { priority: "high", score: 1, reason: "工作流今天截止" };
    if (hoursToDue !== null && hoursToDue <= 48) return { priority: "high", score: 2, reason: "工作流将在两天内截止" };
    if (hoursToDue !== null && hoursToDue <= 7 * 24) return { priority: "medium", score: 3, reason: "工作流本周截止" };
    if (updatedTime && now - updatedTime <= DAY) return { priority: "medium", score: 4, reason: "最近更新，需要明确下一步" };
    return { priority: "low", score: 5, reason: "暂无临近排期" };
  }

  // Mark a calendar record that is happening at the current moment.
  function calendarState(item, now) {
    const start = timeOf(item.start);
    const end = timeOf(item.end);
    if (start && end && start <= now && now < end) return "in-progress";
    if (end && end < now) return "completed";
    return item.availability || "free";
  }

  // Build a ranked work plan from read-only synchronized records.
  function build(context) {
    const now = Date.now();
    const feishu = context?.feishu || {};
    const tasks = [...(feishu.todoTasks || []), ...(feishu.tasks || [])]
      .filter(isRelevantTask)
      .filter((task) => !isStaleTask(task, now))
      .filter((task) => task.status !== "done")
      .map((task) => ({ ...task, ...rankTask(task, now) }))
      .sort((left, right) => left.score - right.score || (timeOf(right.updatedAt) || 0) - (timeOf(left.updatedAt) || 0));
    const calendar = (feishu.schedule || [])
      .filter((item) => item.source === "lark-calendar" && ((timeOf(item.end) || 0) >= now || isToday(timeOf(item.start), now)))
      .map((item) => ({ ...item, state: calendarState(item, now) }))
      .sort((left, right) => (timeOf(left.start) || 0) - (timeOf(right.start) || 0));
    const activeCodex = (context?.codex || []).filter((session) => session.status === "active").length;
    return {
      updatedAt: context?.syncedAt || null,
      tasks: tasks.slice(0, 6),
      agenda: calendar.slice(0, 4),
      summary: {
        activeTasks: tasks.length,
        highPriority: tasks.filter((task) => task.priority === "high").length,
        todayMeetings: calendar.filter((item) => isToday(timeOf(item.start), now)).length,
        activeCodex
      }
    };
  }

  window.WorkPlanner = { build };
})();
