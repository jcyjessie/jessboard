# Architecture

- `index.html`：提供中文工作台结构、每日工作简报、导航、任务对话框、开发分析页和咨询页容器。
- `styles.css`：提供响应式布局、深浅色模式和绿色/黑色/橙色/蓝灰色视觉系统。
- `design-demos.html`：提供独立的四种顶部导航与数据看板设计预览，不影响正式工作台。
- `design-demos.css`：定义设计预览的共用布局及四套可切换的视觉主题。
- `design-demos.js`：处理设计预览标签切换，并同步展示对应的说明文字。
- `neat-annotations.css`：提供本地的手绘箭头和标记样式，仅用于状态驱动的工作提示。
- `app.js`：维护本机任务、视图切换、专注计时、上下文状态、每日简报交互、开发分析和资讯渲染；资讯按五类阅读入口、市场、主题、重要度和新鲜度分页为报纸版面，并在浏览器保留最近一次成功刷新结果。
- `work-plan.js`：根据只读的飞书 Project 工作流、日历和 Codex 会话状态生成当天优先级和日程。
- `daily-brief.js`：从只读飞书任务、日程和消息快照筛选每日优先事项、会议准备、待确认消息、风险和闭环信息。
- `server.mjs`：提供静态文件服务、上下文读取和手动刷新接口、`/api/dev-metrics` 开发聚合接口、`/api/news` 五类资讯聚合接口和 `/api/weather/shanghai` 天气接口；World Monitor 默认走本地 RSS 和 Ollama，最多 12 条外文重点资讯经单次本机 Codex 翻译，财经快讯经只读 OpenCLI 获取，加密资讯读取公开 RSS，托管 MCP 仅显式启用时使用。
- `metrics.mjs`：只读取 Codex 会话的累计 Token、模型、使用场景、工具事件与安全会话摘要，并结合公开 GitHub 活动和当前仓库 Git 差异，输出不含正文和凭证的开发指标。
- `sync.mjs`：通过相邻项目的只读飞书 Project API 帮助程序和本机已授权 Lark CLI，同步“我负责的”飞书任务、EOD Project 需求、工作流进度、日程、分页文档元数据、消息预览和安全 Codex 会话摘要到统一上下文快照；仅将带明确行动指令且与 Jessie 或实时/EOD 业务相关的内容生成为建议任务。
- `sync.config.json`：提供不含凭证的飞书 Project、Lark CLI 同步范围和建议任务关键词配置。
- `data/context.json`：保存可安全展示的 Codex 会话摘要与飞书同步结果，不保存凭证。
- `data/finance-news-sources.json`：声明匿名可读取的财经快讯来源和固定的 OpenCLI 读取命令。
- `data/crypto-feeds.json`：声明匿名可读取的加密与链上 RSS 来源。
- `package.json`：提供本机服务和同步命令。
- `CONTEXT.md`：记录当前交付阶段和关键决定。

`index.html` 加载 `styles.css`、`work-plan.js`、`daily-brief.js` 和 `app.js`。`app.js` 将浏览器本地任务与同步的只读飞书任务统一为各个任务视图的数据源，并从 `server.mjs` 读取上下文、资讯和上海天气；它使用 `daily-brief.js` 的结果渲染首页，并只在用户确认后将消息写入浏览器本地任务。成功的资讯响应会保存到浏览器，新的刷新失败不会清空旧版内容。`design-demos.html` 单独加载 `design-demos.css` 和 `design-demos.js`，用于切换设计主题，不会读取或写入正式任务数据。`work-plan.js` 保留直接分配的任务和 EOD 范围的 Project 任务来进行优先级计算。`metrics.mjs` 还按模型和会话中最强的已记录 skill 信号汇总 Token，后者用于测试与验收、产品规划、界面与浏览、Skill 建设和其他工作等使用场景。`sync.mjs` 调用 `workteam-morning-report` 的本地只读 Project 帮助程序，以及已授权的本机 Lark CLI；它将任务、Project 需求、工作流进度、排期、日程、分页文档标题/链接、截断后的消息预览和安全 Codex 会话摘要写入 `data/context.json`。建议任务必须同时通过 Jessie/实时-EOD 关键词和明确行动指令两层筛选，关键词可在 `sync.config.json` 调整。`server.mjs` 分别请求 AI HOT、Follow Builders、World Monitor、财经快讯和加密 RSS，单个来源失败不会影响其余来源；它为每条资讯保留原文和中文字段，并只向前端返回简洁的翻译状态。财经来源通过配置中限定的只读命令执行，加密来源直接读取公开 RSS。私有的 Codex/飞书内容只能通过 `data/context.json` 快照进入页面。

项目保持前端和同步服务分离，原因是浏览器不能安全保存飞书授权，也可能受到跨域限制。所有外部内容都显示原文链接和来源名称。World Monitor 本地模式不需要 API Key；Ollama 或本机翻译暂不可用时保留原文，来源栏仅显示读者可理解的语言状态。托管 MCP 模式仍会在没有 API Key 时显示不可用状态。

每日简报将空白日压缩为一个确认状态，避免四个同等权重的空面板分散注意力。手绘提示仅在首次同步、最高优先级和首个风险出现时显示；普通 HTML 状态文字始终保留，移动端隐藏箭头，避免其脱离正常布局后遮挡内容。
