// Jessboard sync command writes a normalized context snapshot for Codex and Feishu adapters.
import fs from "node:fs/promises";
import path from "node:path";

const target = path.join(process.cwd(), "data", "context.json");

// Preserve the normalized shape while leaving private-source adapters opt-in.
async function syncContext() {
  let previous = {};
  try { previous = JSON.parse(await fs.readFile(target, "utf8")); } catch { previous = {}; }
  const current = { codex: previous.codex || [], feishu: previous.feishu || { tasks: [], schedule: [], notes: [], messages: [] }, sources: { codex: "agent-export", feishu: "lark-cli-pending" }, syncedAt: new Date().toISOString() };
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  console.log(`Wrote ${target}`);
}

syncContext().catch((error) => { console.error(`同步失败：${error.message}`); process.exitCode = 1; });
