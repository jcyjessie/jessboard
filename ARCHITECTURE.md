# Architecture

- `index.html`：提供中文工作台结构、导航、任务对话框、开发分析页和咨询页容器。
- `styles.css`：提供响应式布局、深浅色模式和绿色/黑色/橙色/蓝灰色视觉系统。
- `app.js`：维护本机任务、视图切换、专注计时、上下文状态、开发分析和资讯渲染；资讯按市场、主题、重要度和新鲜度分页为独立流式报纸版面，并支持中文/英文即时切换。
- `work-plan.js`：根据只读的飞书 Project 工作流、日历和 Codex 会话状态生成当天优先级和日程。
- `server.mjs`：提供静态文件服务、上下文读取和手动刷新接口、`/api/dev-metrics` 开发聚合接口、`/api/news` 三源资讯聚合接口和 `/api/weather/shanghai` 天气接口；World Monitor 默认走本地 RSS 和 Ollama，托管 MCP 仅显式启用时使用。
- `metrics.mjs`：只读取 Codex 会话的累计 Token/工具事件与安全会话摘要，并结合公开 GitHub 活动和当前仓库 Git 差异，输出不含正文和凭证的开发指标。
- `sync.mjs`：通过相邻项目的只读飞书 Project API 帮助程序和本机已授权 Lark CLI，同步“我负责的”飞书任务、EOD Project 需求、工作流进度、日程、分页文档元数据、消息预览和安全 Codex 会话摘要到统一上下文快照；仅将带明确行动指令且与 Jessie 或实时/EOD 业务相关的内容生成为建议任务。
- `sync.config.json`：提供不含凭证的飞书 Project、Lark CLI 同步范围和建议任务关键词配置。
- `data/context.json`：保存可安全展示的 Codex 会话摘要与飞书同步结果，不保存凭证。
- `package.json`：提供本机服务和同步命令。
- `CONTEXT.md`：记录当前交付阶段和关键决定。

`index.html` 加载 `styles.css`、`work-plan.js` 和 `app.js`。`app.js` 将浏览器本地任务与同步的只读飞书任务统一为各个任务视图的数据源，并从 `server.mjs` 读取上下文、资讯和上海天气；`work-plan.js` 只保留直接分配的任务和 EOD 范围的 Project 任务来进行优先级计算。`metrics.mjs` 还按模型和总 Token 汇总安全会话记录。`sync.mjs` 调用 `workteam-morning-report` 的本地只读 Project 帮助程序，以及已授权的本机 Lark CLI；它将任务、Project 需求、工作流进度、排期、日程、分页文档标题/链接、截断后的消息预览和安全 Codex 会话摘要写入 `data/context.json`。建议任务必须同时通过 Jessie/实时-EOD 关键词和明确行动指令两层筛选，关键词可在 `sync.config.json` 调整。`server.mjs` 对三个资讯源分别请求，单个来源失败不会影响其余来源，并为每条资讯保留原文和中文字段；私有的 Codex/飞书内容只能通过 `data/context.json` 快照进入页面。

项目保持前端和同步服务分离，原因是浏览器不能安全保存飞书授权，也可能受到跨域限制。所有外部内容都显示原文链接和来源名称。World Monitor 本地模式不需要 API Key；Ollama 或本机翻译暂不可用时保留原文并在来源栏显示降级状态。托管 MCP 模式仍会在没有 API Key 时显示不可用状态。
