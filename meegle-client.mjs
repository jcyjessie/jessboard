// Read-only Meegle CLI adapter used by sync.mjs and server.mjs for Project enrichment.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const runFile = promisify(execFile);

// Keep an optional command timeout within a safe range for local refreshes.
function boundedTimeout(value, fallback = 12000) {
  return Math.min(Math.max(Number(value) || fallback, 2000), 30000);
}

// Run one Meegle command and preserve its service error as a readable exception.
async function runMeegle(binary, args, timeoutMs) {
  try {
    const { stdout } = await runFile(binary, [...args, "--format", "json"], {
      timeout: boundedTimeout(timeoutMs),
      maxBuffer: 4 * 1024 * 1024
    });
    const response = JSON.parse(stdout);
    if (response?.error || response?.ok === false) throw new Error(response.error?.message || response.message || "Meegle request was not accepted.");
    return response;
  } catch (error) {
    const detail = String(error.stdout || error.stderr || error.message || error).trim();
    try {
      const response = JSON.parse(detail);
      if (response?.error || response?.ok === false) throw new Error(response.error?.message || response.message || detail);
      return response;
    } catch (parseError) {
      if (parseError instanceof SyntaxError) throw new Error(detail || "Meegle request failed.");
      throw parseError;
    }
  }
}

// Read one nested property without assuming a single CLI response shape.
function valueAt(record, path) {
  return path.split(".").reduce((value, key) => value && typeof value === "object" ? value[key] : undefined, record);
}

// Return the first meaningful value from documented and compatibility paths.
function firstValue(record, paths) {
  for (const path of paths) {
    const value = valueAt(record, path);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

// Find the list payload in a small number of documented Meegle response envelopes.
function responseItems(response) {
  const candidates = [response?.data?.items, response?.data?.list, response?.data?.data?.items, response?.data?.data?.list, response?.items, response?.list, response?.comments, response?.op_records, response?.data];
  return candidates.find(Array.isArray) || [];
}

// Convert a date-like Meegle field to an ISO string when it is a timestamp.
function isoTime(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" || /^\d{10,13}$/.test(String(value))) {
    const numeric = Number(value);
    const date = new Date(numeric < 100000000000 ? numeric * 1000 : numeric);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

// Format an absolute Project timestamp in Jessie's Shanghai timezone.
function shanghaiTime(value) {
  const iso = isoTime(value);
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

// Convert Project comment markup into complete readable text without executing HTML.
function cleanCommentContent(value) {
  return String(value || "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/giu, "$1")
    .replace(/\*\*([^*]+)\*\*/gu, "$1")
    .replace(/<span\b(?:\s+style="[^"]*")\s*>?/giu, "")
    .replace(/<\/span\s*>?/giu, "")
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<[^>]+>/gu, "")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;|&#34;/giu, "\"")
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/[ \t]+/gu, " ")
    .replace(/\s*\n\s*/gu, "\n")
    .trim();
}

// Format a local date for Meegle's schedule query without relying on browser time.
function scheduleDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

// Read the current user's near-term Project workload for one detail view.
async function loadPersonalCapacity(binary, projectKey, timeoutMs) {
  const profile = await runMeegle(binary, ["user", "me"], timeoutMs);
  const userKey = firstValue(profile, ["data.user_key", "data.userKey", "user_key", "userKey", "data.id", "id"]);
  if (!userKey) return [];
  const response = await runMeegle(binary, ["workhour", "list-schedule", "--project-key", projectKey, "--user-keys", String(userKey), "--start-time", scheduleDate(), "--end-time", scheduleDate(14), "--work-item-type-keys", "_all"], timeoutMs);
  return responseItems(response);
}

// Normalize one My Work record to the fields Jessboard needs for personal context.
function normalizeMyWorkItem(item, action) {
  const workItemId = firstValue(item, ["work_item_info.id", "work_item_id", "workItemId", "id"]);
  if (!workItemId) return null;
  const projectKey = firstValue(item, ["project_info.project_key", "project_key", "projectKey", "project_info.key"]);
  const schedule = firstValue(item, ["schedule", "node_info.schedule", "work_item_info.schedule"]) || {};
  return {
    workItemId: String(workItemId), projectKey: projectKey ? String(projectKey) : null,
    title: String(firstValue(item, ["work_item_info.name", "name", "title"]) || "Untitled Project item"),
    project: String(firstValue(item, ["project_info.name", "project_name", "project"]) || "Feishu Project"),
    nodeId: firstValue(item, ["node_info.id", "node_id", "nodeId"]),
    nodeName: firstValue(item, ["node_info.node_name", "node_info.name", "node_name", "nodeName"]),
    nodeState: firstValue(item, ["node_info.node_state_key", "node_info.state", "node_state", "state"]),
    dueAt: isoTime(firstValue(schedule, ["estimate_end_iso", "estimate_end_date", "end_time", "end"])),
    startAt: isoTime(firstValue(schedule, ["estimate_start_iso", "estimate_start_date", "start_time", "start"])),
    updatedAt: isoTime(firstValue(item, ["update_time", "updated_at", "updated_at_iso", "node_info.update_time"])),
    finishAt: isoTime(firstValue(item, ["finish_time", "finished_at", "node_info.finish_time"])), actions: [action]
  };
}

// Combine the same parent work item across My Work categories and workflow nodes.
function mergeMyWorkItems(items) {
  const merged = new Map();
  const actionOrder = ["overdue", "todo", "this_week"];
  for (const item of items) {
    if (!item) continue;
    const key = `${item.projectKey || "unknown"}:${item.workItemId}`;
    const existing = merged.get(key);
    if (!existing) { merged.set(key, item); continue; }
    const existingWeight = Math.min(...existing.actions.map((action) => actionOrder.indexOf(action)).filter((weight) => weight >= 0));
    const nextWeight = Math.min(...item.actions.map((action) => actionOrder.indexOf(action)).filter((weight) => weight >= 0));
    const primary = nextWeight < existingWeight ? item : existing;
    merged.set(key, { ...existing, ...primary, actions: [...new Set([...existing.actions, ...item.actions])], nodeName: primary.nodeName || existing.nodeName || item.nodeName, dueAt: primary.dueAt || existing.dueAt || item.dueAt });
  }
  return [...merged.values()];
}

// Convert raw workflow nodes into compact, reader-friendly detail records.
function workflowRecords(response) {
  const stateLabel = { finished: "已完成", doing: "进行中", not_started: "未开始" };
  return responseItems(response).map((node) => {
    const basic = node.basic || {};
    const schedule = node.schedule || {};
    const owners = (node.assignees?.owners || []).map((owner) => owner.name).filter(Boolean).join("、");
    const date = isoTime(schedule.estimate_finish_time || schedule.estimate_end_time || schedule.estimate_end_iso);
    const parts = [stateLabel[basic.status] || basic.status, owners, date ? date.slice(0, 10) : null].filter(Boolean);
    return { title: [basic.name || "工作流节点", parts.join(" · ")].filter(Boolean).join(" · ") };
  });
}

// Extract linked documents and recordings that Project exposes as workflow or item fields.
function linkedMaterials(workflowResponse, workItemResponse) {
  const candidates = [];
  responseItems(workflowResponse).forEach((node) => {
    (node.form_items || []).forEach((field) => candidates.push({ node: node.basic?.name, ...field }));
  });
  (workItemResponse?.work_item_fields || []).forEach((field) => candidates.push(field));
  const seen = new Set();
  return candidates.flatMap((field) => {
    const url = typeof field.value === "string" && /^https?:\/\//i.test(field.value) ? field.value : null;
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{ title: [field.node, field.field_name || field.name || "关联资料"].filter(Boolean).join(" · "), url }];
  });
}

// Keep comments useful in a compact detail surface without showing markup-only entries.
function commentRecords(response) {
  return responseItems(response).flatMap((comment) => {
    const content = cleanCommentContent(comment.content);
    if (!content) return [];
    const time = shanghaiTime(comment.created_at);
    return [{ title: `${content}${time ? ` · ${time}` : ""}`, multiline: true, fullText: true }];
  });
}

// Turn operation metadata into a short timeline label for the Project detail panel.
function operationRecords(response) {
  const label = { create: "创建", modify: "更新", complete: "完成", delete: "删除" };
  return responseItems(response).map((record) => {
    const time = shanghaiTime(record.operation_time);
    return { title: `${label[record.operation_type] || record.operation_type || "工作项变更"}${time ? ` · ${time}` : ""}` };
  });
}

// Read only relation definitions valid for the current item type, then list their linked items.
async function relationRecords(binary, projectKey, workItemId, workItemTypeKey, timeoutMs) {
  if (!workItemTypeKey) return { items: [], failures: [] };
  const definitions = responseItems(await runMeegle(binary, ["relation", "meta-definitions", "--project-key", projectKey], timeoutMs))
    .filter((definition) => !definition.disabled && definition.work_item_type_key === workItemTypeKey)
    .slice(0, 8);
  const results = await Promise.allSettled(definitions.map(async (definition) => {
    const response = await runMeegle(binary, ["relation", "list", "--work-item-id", workItemId, "--relation-id", definition.id, "--project-key", projectKey], timeoutMs);
    return responseItems(response).map((item) => ({ ...item, relationName: definition.name }));
  }));
  return {
    items: results.filter((result) => result.status === "fulfilled").flatMap((result) => result.value),
    failures: results.filter((result) => result.status === "rejected").map((result) => String(result.reason?.message || result.reason))
  };
}

// Read the current CLI authentication state without starting an interactive login.
export async function meegleAuthStatus(options = {}) {
  const response = await runMeegle(options.binary || "meegle", ["auth", "status"], options.timeoutMs);
  return response?.data || response;
}

// Read bounded personal Project action feeds and retain their category provenance.
export async function loadMyWorkActions(options = {}) {
  const status = await meegleAuthStatus(options);
  if (!status.authenticated) return { state: "unauthenticated", actions: [], detail: status.reason || "No reusable Meegle token." };
  const actions = ["todo", "overdue", "this_week"];
  const pageCount = Math.min(Math.max(Number(options.maxPages) || 1, 1), 4);
  const pages = await Promise.all(actions.flatMap((action) => Array.from({ length: pageCount }, (_, index) => runMeegle(options.binary || "meegle", ["mywork", "todo", "--action", action, "--page-num", String(index + 1)], options.timeoutMs).then((response) => responseItems(response).map((item) => normalizeMyWorkItem(item, action))))));
  return { state: "ready", actions: mergeMyWorkItems(pages.flat()), detail: "Meegle My Work" };
}

// Build a small detail payload from authoritative Project relations and activity records.
export async function loadProjectWorkDetail(options = {}) {
  const projectKey = String(options.projectKey || "").trim();
  const workItemId = String(options.workItemId || "").trim();
  if (!projectKey || !workItemId) throw new Error("Project key and work item ID are required.");
  const status = await meegleAuthStatus(options);
  if (!status.authenticated) return { state: "unauthenticated", detail: status.reason || "No reusable Meegle token." };
  const binary = options.binary || "meegle";
  const shared = ["--project-key", projectKey];
  const results = await Promise.allSettled([
    runMeegle(binary, ["workflow", "get-node", "--work-item-id", workItemId, ...shared, "--need-sub-task", "true"], options.timeoutMs),
    runMeegle(binary, ["workitem", "get", "--work-item-id", workItemId, ...shared], options.timeoutMs),
    runMeegle(binary, ["workitem", "list-op-records", "--work-item-id", workItemId, ...shared], options.timeoutMs),
    runMeegle(binary, ["comment", "list", "--work-item-id", workItemId, ...shared], options.timeoutMs),
    loadPersonalCapacity(binary, projectKey, options.timeoutMs)
  ]);
  const data = results.map((result) => result.status === "fulfilled" ? result.value : null);
  const failures = results.filter((result) => result.status === "rejected").map((result) => String(result.reason?.message || result.reason));
  const typeKey = data[1]?.work_item_attribute?.work_item_type?.key || null;
  const relations = await relationRecords(binary, projectKey, workItemId, typeKey, options.timeoutMs).catch((error) => ({ items: [], failures: [String(error.message || error)] }));
  return { state: failures.length === results.length ? "error" : "ready", workflow: { nodes: workflowRecords(data[0]) }, relations: relations.items, materials: linkedMaterials(data[0], data[1]), operations: operationRecords(data[2]), comments: commentRecords(data[3]), capacity: Array.isArray(data[4]) ? data[4] : responseItems(data[4]), failures: [...failures, ...relations.failures] };
}
