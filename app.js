// Jessboard behavior renders the dashboard and keeps personal data in local storage.
const storageKey = "jessboard-data-v1";
const legacyStorageKey = "focusboard-data-v1";
const defaultData = {
  focusMinutes: 168,
  selectedTaskId: "task-1",
  tasks: [
    { id: "task-1", title: "Draft the client kickoff brief", project: "Northstar launch", priority: "high", status: "progress", due: "Today" },
    { id: "task-2", title: "Review research notes", project: "Discovery sprint", priority: "medium", status: "todo", due: "Today" },
    { id: "task-3", title: "Map the onboarding flow", project: "Northstar launch", priority: "high", status: "review", due: "Thu" },
    { id: "task-4", title: "Prepare weekly check-in", project: "Team operations", priority: "low", status: "todo", due: "Fri" },
    { id: "task-5", title: "Share design handoff", project: "Northstar launch", priority: "medium", status: "done", due: "Done" }
  ],
  projects: [
    { name: "Northstar launch", color: "#d9654c", note: "Campaign and experience", progress: 68 },
    { name: "Discovery sprint", color: "#3d7196", note: "Customer learning", progress: 42 },
    { name: "Team operations", color: "#d39b2b", note: "Team systems", progress: 30 }
  ]
};
let data = loadData();
let timerSeconds = 25 * 60;
let timerId = null;

// Load saved information or create a fresh personal board.
function loadData() {
  try { return JSON.parse(localStorage.getItem(storageKey)) || JSON.parse(localStorage.getItem(legacyStorageKey)) || structuredClone(defaultData); }
  catch { return structuredClone(defaultData); }
}

// Save the current board after every task action.
function saveData() { localStorage.setItem(storageKey, JSON.stringify(data)); }

// Return a display color for a task priority.
function priorityColor(priority) { return { high: "#d9654c", medium: "#d39b2b", low: "#3d7196" }[priority] || "#28786c"; }

// Translate an internal task state into a readable label.
function statusLabel(status) { return { todo: "Planned", progress: "In progress", review: "In review", done: "Complete" }[status]; }

// Build an individual task row for a task list.
function taskRow(task, includeDelete = true) {
  const done = task.status === "done";
  return `<article class="task-row ${done ? "done" : ""}" style="--task-color:${priorityColor(task.priority)}">
    <button class="task-toggle" data-toggle-task="${task.id}" type="button" aria-label="Mark ${task.title} ${done ? "incomplete" : "complete"}">${done ? "<i data-lucide=\"check\"></i>" : ""}</button>
    <div><div class="task-title">${escapeHtml(task.title)}</div><div class="task-meta">${escapeHtml(task.project)} <span aria-hidden="true">•</span> ${statusLabel(task.status)}</div></div>
    <span class="task-due">${escapeHtml(task.due || "No date")}</span>
    ${includeDelete ? `<button class="task-delete" data-delete-task="${task.id}" type="button" aria-label="Delete ${task.title}" title="Delete task"><i data-lucide="trash-2"></i></button>` : "<span class=\"priority-dot\"></span>"}
  </article>`;
}

// Escape task text before it is placed into generated markup.
function escapeHtml(value) { const element = document.createElement("div"); element.textContent = value; return element.innerHTML; }

// Update the summary cards across the top of the overview.
function renderInsights() {
  const open = data.tasks.filter((task) => task.status !== "done");
  const metrics = [
    ["#28786c", open.length, "Open tasks", "Momentum"],
    ["#d9654c", data.tasks.filter((task) => task.status === "progress").length, "In progress", "In motion"],
    ["#d39b2b", data.tasks.filter((task) => task.status === "review").length, "Need a decision", "Review queue"],
    ["#3d7196", data.tasks.filter((task) => task.status === "done").length, "Finished", "This week"]
  ];
  document.querySelector("#insight-grid").innerHTML = metrics.map(([color, value, detail, label]) => `<article class="metric-card" style="--metric-color:${color}"><p class="eyebrow">${label}</p><strong>${value}</strong><span>${detail}</span></article>`).join("");
}

// Render short priority list on the overview page.
function renderPriorities() {
  const tasks = data.tasks.filter((task) => task.status !== "done").slice(0, 4);
  document.querySelector("#priority-list").innerHTML = tasks.map((task) => taskRow(task)).join("") || "<p class=\"empty-state\">Your priority list is clear.</p>";
}

// Render all daily tasks in their own view.
function renderAllTasks() { document.querySelector("#all-task-list").innerHTML = data.tasks.map((task) => taskRow(task)).join("") || "<p class=\"empty-state\">Add a task to start your day.</p>"; }

// Render project cards from the current task data.
function renderProjects() {
  document.querySelector("#project-cards").innerHTML = data.projects.map((project) => {
    const related = data.tasks.filter((task) => task.project === project.name);
    const complete = related.length ? Math.round(related.filter((task) => task.status === "done").length / related.length * 100) : project.progress;
    return `<article class="project-card" style="--project-color:${project.color}"><div class="project-card-top"><span class="status-chip blue">${related.length} tasks</span><span>${complete}%</span></div><h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.note)}</p><div class="progress-line"><span style="width:${complete}%"></span></div></article>`;
  }).join("");
}

// Render the compact weekly focus chart.
function renderRhythm() {
  const values = [36, 54, 42, 76, 61, 28, 12];
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  document.querySelector("#week-bars").innerHTML = values.map((value, index) => `<div class="day-bar ${index === 2 ? "today" : ""}"><span style="height:${value}%"></span><small>${days[index]}</small></div>`).join("");
  document.querySelector("#focus-hours").textContent = `${Math.floor(data.focusMinutes / 60)}h ${String(data.focusMinutes % 60).padStart(2, "0")}m`;
  document.querySelector("#completed-count").textContent = data.tasks.filter((task) => task.status === "done").length;
}

// Render project tasks grouped into planning columns.
function renderKanban() {
  const columns = [["todo", "Planned"], ["progress", "In progress"], ["review", "In review"]];
  document.querySelector("#kanban-board").innerHTML = columns.map(([status, label]) => {
    const tasks = data.tasks.filter((task) => task.status === status);
    return `<section class="kanban-column"><div class="kanban-heading"><span>${label}</span><span class="kanban-count">${tasks.length}</span></div>${tasks.map((task) => `<article class="kanban-card" style="--task-color:${priorityColor(task.priority)}"><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.project)} · ${escapeHtml(task.due || "No date")}</p><div class="kanban-footer"><span class="priority-dot"></span><select class="status-select" data-status-task="${task.id}" aria-label="Change status for ${task.title}"><option value="todo" ${task.status === "todo" ? "selected" : ""}>Planned</option><option value="progress" ${task.status === "progress" ? "selected" : ""}>In progress</option><option value="review" ${task.status === "review" ? "selected" : ""}>In review</option><option value="done">Complete</option></select></div></article>`).join("")}</section>`;
  }).join("");
}

// Render task choices for the focus session.
function renderFocusOptions() {
  const active = data.tasks.filter((task) => task.status !== "done");
  document.querySelector("#focus-task-options").innerHTML = active.map((task) => `<button class="focus-choice ${task.id === data.selectedTaskId ? "active" : ""}" data-focus-task="${task.id}" type="button"><span class="priority-dot" style="--task-color:${priorityColor(task.priority)}"></span><span>${escapeHtml(task.title)}<small>${escapeHtml(task.project)}</small></span></button>`).join("") || "<p class=\"empty-state\">All tasks are complete.</p>";
  const selected = data.tasks.find((task) => task.id === data.selectedTaskId);
  document.querySelector("#timer-task").textContent = selected ? selected.title : "Choose a task, then begin.";
}

// Rebuild every dynamic section after changes.
function renderApp() { renderInsights(); renderPriorities(); renderAllTasks(); renderProjects(); renderRhythm(); renderKanban(); renderFocusOptions(); lucide.createIcons(); }

// Toggle between dashboard sections without leaving the page.
function setView(view) {
  document.querySelectorAll("[data-view-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.viewPanel === view));
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  const pageTitle = { dashboard: "Make today count.", today: "A clear plan for today.", projects: "Keep every project moving.", focus: "Protect your attention." }[view];
  document.querySelector("#page-title").textContent = pageTitle;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Add a new task from the dialog form.
function addTask(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const dueDate = form.get("due");
  data.tasks.unshift({ id: `task-${Date.now()}`, title: form.get("title").trim(), project: form.get("project"), priority: form.get("priority"), status: form.get("status"), due: dueDate ? new Date(`${dueDate}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" }) : "No date" });
  saveData(); renderApp(); event.currentTarget.reset(); document.querySelector("#task-dialog").close(); setView("today");
}

// Switch a task between complete and planned.
function toggleTask(id) {
  const task = data.tasks.find((item) => item.id === id);
  task.status = task.status === "done" ? "todo" : "done";
  saveData(); renderApp();
}

// Delete a task after the user selects its delete control.
function deleteTask(id) { data.tasks = data.tasks.filter((task) => task.id !== id); if (data.selectedTaskId === id) data.selectedTaskId = data.tasks[0]?.id; saveData(); renderApp(); }

// Move a task to a new board state.
function changeTaskStatus(id, status) { const task = data.tasks.find((item) => item.id === id); task.status = status; saveData(); renderApp(); }

// Display the timer in minutes and seconds.
function renderTimer() { document.querySelector("#timer-display").textContent = `${String(Math.floor(timerSeconds / 60)).padStart(2, "0")}:${String(timerSeconds % 60).padStart(2, "0")}`; }

// Start or pause a single focus countdown.
function toggleTimer() {
  const button = document.querySelector("#timer-start");
  if (timerId) { clearInterval(timerId); timerId = null; button.innerHTML = "<i data-lucide=\"play\"></i>Resume focus"; lucide.createIcons(); return; }
  button.innerHTML = "<i data-lucide=\"pause\"></i>Pause focus"; lucide.createIcons();
  timerId = window.setInterval(() => { timerSeconds -= 1; renderTimer(); if (timerSeconds <= 0) { clearInterval(timerId); timerId = null; timerSeconds = 25 * 60; data.focusMinutes += 25; saveData(); renderApp(); renderTimer(); button.innerHTML = "<i data-lucide=\"play\"></i>Start focus"; lucide.createIcons(); } }, 1000);
}

// Wire up shared clicks from dynamic task controls.
function bindEvents() {
  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-toggle-task]"); const deletion = event.target.closest("[data-delete-task]"); const choice = event.target.closest("[data-focus-task]"); const navigation = event.target.closest("[data-view], [data-go-to]");
    if (toggle) toggleTask(toggle.dataset.toggleTask);
    if (deletion) deleteTask(deletion.dataset.deleteTask);
    if (choice) { data.selectedTaskId = choice.dataset.focusTask; saveData(); renderFocusOptions(); }
    if (navigation) setView(navigation.dataset.view || navigation.dataset.goTo);
  });
  document.addEventListener("change", (event) => { if (event.target.matches("[data-status-task]")) changeTaskStatus(event.target.dataset.statusTask, event.target.value); });
  document.querySelector("#open-task-dialog").addEventListener("click", () => document.querySelector("#task-dialog").showModal());
  document.querySelector("#close-task-dialog").addEventListener("click", () => document.querySelector("#task-dialog").close());
  document.querySelector("#cancel-task-dialog").addEventListener("click", () => document.querySelector("#task-dialog").close());
  document.querySelector("#task-form").addEventListener("submit", addTask);
  document.querySelector("#clear-completed").addEventListener("click", () => { data.tasks = data.tasks.filter((task) => task.status !== "done"); saveData(); renderApp(); });
  document.querySelector("#timer-start").addEventListener("click", toggleTimer);
  document.querySelector("#timer-reset").addEventListener("click", () => { timerSeconds = 25 * 60; renderTimer(); });
  document.querySelector("#theme-toggle").addEventListener("click", () => { document.body.classList.toggle("dark"); });
}

// Populate the project choice field from the active project list.
function populateProjectMenu() { document.querySelector("#task-project").innerHTML = data.projects.map((project) => `<option value="${escapeHtml(project.name)}">${escapeHtml(project.name)}</option>`).join(""); }

populateProjectMenu();
bindEvents();
renderApp();
renderTimer();
