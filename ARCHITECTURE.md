# Architecture

- `index.html`：提供中文工作台结构、导航、任务对话框、开发分析页和咨询页容器。
- `styles.css`：提供响应式布局、深浅色模式和绿色/黑色/橙色/蓝灰色视觉系统。
- `app.js`：维护本机任务、视图切换、专注计时、上下文状态、开发分析和资讯渲染；资讯按市场、主题、重要度和新鲜度分页为独立流式报纸版面，并支持中文/英文即时切换。
- `server.mjs`：提供静态文件服务、`/api/context` 快照接口、`/api/dev-metrics` 开发聚合接口、`/api/news` 三源资讯聚合接口和 `/api/weather/shanghai` 天气接口；World Monitor 默认走本地 RSS 和 Ollama，托管 MCP 仅显式启用时使用。
- `metrics.mjs`：只读取 Codex 会话的累计 Token/工具事件，并结合公开 GitHub 活动和当前仓库 Git 差异，输出不含正文和凭证的开发指标。
- `sync.mjs`：维护统一上下文快照的本机同步入口，后续接入 Codex 导出和飞书 CLI。
- `data/context.json`：保存可安全展示的 Codex 会话摘要与飞书同步结果，不保存凭证。
- `package.json`：提供本机服务和同步命令。
- `CONTEXT.md`：记录当前交付阶段和关键决定。

`index.html` 加载 `styles.css` 和 `app.js`。`app.js` 从浏览器本地存储读取个人任务，并从 `server.mjs` 读取上下文、资讯和上海天气；资讯语言偏好只保存在浏览器本地，中文是默认值，版面分页、市场分类、重要度和独立列流在浏览器端计算。`server.mjs` 对三个资讯源分别请求，单个来源失败不会影响其余来源，并为每条资讯保留原文和中文字段；私有的 Codex/飞书内容只能通过 `data/context.json` 快照进入页面。

项目保持前端和同步服务分离，原因是浏览器不能安全保存飞书授权，也可能受到跨域限制。所有外部内容都显示原文链接和来源名称。World Monitor 本地模式不需要 API Key；Ollama 或本机翻译暂不可用时保留原文并在来源栏显示降级状态。托管 MCP 模式仍会在没有 API Key 时显示不可用状态。
