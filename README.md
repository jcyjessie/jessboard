# Jessboard

Jessboard 是一个中文个人工作台，用来集中查看任务、项目排期、Codex 会话进度和资讯。它保留本机优先的任务体验，同时通过本机服务读取公开资讯和后续的飞书同步快照。

## 当前能力

- 中文总览、我的任务、项目排期、专注和资讯页。
- 全站采用白色工作面、深色优先级/统计面板和黄色工具栏；桌面端将全局导航固定在右侧，小屏幕自动改为底部导航。
- 我的任务支持卡片、按到期桶分组的时间轴和高任务量表格三种展示方式，支持搜索、真实时间范围、状态/优先级筛选和分页；本地任务按产品、开发、沟通、研究和行政分类。总览显示完成情况、任务类型和真实记录的活动趋势。
- 项目排期以工作流、下个里程碑、交付阶段、风险数量和已完成工作收纳呈现，不再以空状态列和历史完成项作为主要视图。
- 专注页支持 25、50、90 分钟时长、跳过当前任务和五项高优候选任务；新建任务表单将项目、工作类型和状态收纳为“更多选项”。
- 顶部“专注模式”会隐藏总览中的次要模块，保留当天工作和紧急任务，不再提供会破坏混合视觉层级的全局深浅色切换。
- 独立设计预览页：打开 `/design-demos.html` 可在四种顶部导航和数据看板风格之间切换，用于确认改版方向，不会改变正式工作台。
- 项目进度按同步任务的实际工作主题归类，并将 100% 进度纳入已完成统计，避免把全部事项笼统归为 `cam`。
- 开发分析页首次进入时会读取本机 Codex 会话 Token、模型和使用场景占比、skill/工具调用、公开 GitHub 事件和跨本机仓库提交；加载、无数据与可用数据都有明确状态，两类提交来源会明确分开，且每条记录显示提交时间。
- 首次加载时清除旧版示例任务，之后的个人任务保存在当前浏览器。
- 资讯页合并 AI HOT、Follow Builders、本地 World Monitor RSS、公开财经快讯和公开加密 RSS；统一去重后按 AI 与开发、产品与公司、市场/政策/安全、金融与加密五类阅读，并保留合并来源与原文链接。最近一次成功刷新会保存在当前浏览器，重新打开页面时立即显示，再在后台更新。
- Codex 会话和飞书数据使用统一的 `data/context.json` 快照格式，页面不接触私有凭证。
- 总览会自动将飞书 Project 工作流截止时间、完成进度、最近更新和日历安排整理为当天优先级与日程；它只读取数据，不会修改飞书任务。
- 总览首页以每日工作简报呈现今日必做、会议准备、待确认消息、风险和日终闭环；消息只有由用户确认后才会加入浏览器本地任务。
- 工作上下文按页面上的手动刷新按钮更新；开发统计首次进入开发页时读取，并可通过手动刷新再次更新。在发现紧急截止时间或数据源失败时提示后续处理。
- 开发分析只读取 `~/.codex/sessions` 与公开 GitHub Events/Compare 接口的聚合结果；Codex 账户额度、账单和会话正文不会展示。
- 参考 Task Manager Dashboard 与 Tasks Manager 的时间轴、深色任务栏和信息密度；全站使用 Manrope 与 Noto Sans SC，并以黄色、珊瑚、紫色、青色和绿色表达有意义的状态。

## 本地运行

```bash
npm start
```

然后打开 <http://127.0.0.1:4173>。这是包含资讯和本机同步接口的完整服务；仅当 4173 已被占用时，才使用 `PORT=4174 npm start`。服务以前台进程运行，关闭对应终端后服务会停止；直接打开 `index.html` 只能查看静态页面。

同步快照命令：

```bash
npm run sync
```

`sync.config.json` 默认读取相邻 `workteam-morning-report` 项目的私有 `.env`，同步当前配置用户的最新 50 个飞书项目需求及其工作流排期，并通过本机已授权的 Lark CLI 同步所有未完成的“我负责的”飞书任务。它还同步未来 7 天日程、最多 100 份分页读取的文档元数据和 100 条近期消息预览。同步也会读取所有本机 Codex 会话的安全摘要（会话 ID、工作目录、模型、状态和时间），不会保留正文或凭证。凭证不会复制到 Jessboard，也不会发送给浏览器。

## 资讯配置

AI HOT 的匿名 v1 资讯接口和 Follow Builders 不需要用户 API Key。World Monitor 的公开 MCP 工具需要只读 API Key，可在启动时配置：

```bash
WORLD_MONITOR_API_KEY=your_read_only_key npm start
```

默认模式不访问托管 MCP，而是读取 World Monitor 官方 feed 清单中的精选公开 RSS，并使用本机 Ollama 优先处理头条的中文标题和摘要，因此不需要 `WORLD_MONITOR_API_KEY`。其余文章保留原文和链接，避免刷新时等待过久。启动完整的本地环境：

```bash
brew services start ollama
ollama pull qwen3:0.6b
PORT=4174 npm start
```

本地模式使用 `OLLAMA_MODEL` 切换模型；Ollama 尚未连接时会保留英文原文。每次资讯刷新会将最多 12 条最新的外文重点资讯合并交给本机 Codex 翻译，默认最多等待 45 秒，可用 `NEWS_TRANSLATE_TIMEOUT_MS` 调整；剩余文章保留原文，避免翻译阻塞完整刷新。关闭本机翻译可以使用 `NEWS_TRANSLATE=off`。只有需要 World Monitor 托管 MCP 的完整情报结果时，才使用 `WORLD_MONITOR_MODE=hosted WORLD_MONITOR_API_KEY=your_read_only_key npm start`。Jessboard 只保留官方公开 feed 地址，不复制 World Monitor 的 AGPL 源码。

传统金融快讯通过只读 OpenCLI 获取东方财富和新浪财经的公开内容，配置位于 `data/finance-news-sources.json`。服务会优先读取 `OPENCLI_BIN`，否则自动定位 npm 全局安装目录中的 OpenCLI。加密与链上资讯读取 CoinDesk、Decrypt、Blockworks、Ethereum Foundation 和 Bitcoin Magazine 的公开 RSS，配置位于 `data/crypto-feeds.json`。所有这些来源均无需 API Key、付费订阅或钱包授权；部分财经快讯没有单篇 URL 时，页面会链接至该来源的公开快讯页。

## 飞书连接

官方 Lark/Feishu CLI 已安装，版本为 `1.0.76`。它能覆盖任务、云文档、消息、日历和会议能力。Jessboard 的飞书项目任务使用现有 `workteam-morning-report/.env` 的 Project API 连接，普通飞书数据使用已授权的 CLI OAuth：

```bash
export PATH="$(npm prefix -g)/bin:$PATH"
lark-cli doctor
lark-cli config init --new
```

CLI 的只读输出会转换为 `data/context.json` 中的 `feishu.tasks`、`feishu.schedule`、`feishu.notes` 和 `feishu.messages`。会议纪要和消息只有同时命中 Jessie 或实时/EOD 业务关键词，并包含明确行动指令时，才会变成建议任务；可在 `sync.config.json` 的 `lark.actionability` 中调整关键词。Jessboard 不会把 OAuth 凭证写入前端。

### 语言与翻译

AI HOT 固定提供中文 AI 资讯。其余来源保留原始文章链接和原文；翻译成功时显示中文标题与摘要，未翻译的文章直接展示英文原文。来源栏只显示已翻译条数或“英文原文”，不会把本机服务的错误信息展示给读者。

## 测试

- `node --check app.js`、`node --check server.mjs`、`node --check sync.mjs`
- `git diff --check`
- 启动服务后检查导航、空白任务状态、任务表单、项目排期和咨询页手动刷新。

## 搜索记录

- [Task Manager Dashboard UI](https://dribbble.com/shots/23648549-Task-Manager-Dashboard-UI)：确认是当前截图的原始单页任务管理概念；其视觉语言已整理为 `DESIGN.md`，用于后续界面更新，保留真实内容与可用控件。
- [Tasks Manager](https://dribbble.com/shots/21516421-Tasks-Manager)：补充确认周时间轴、Card/Block/Table 视图切换、底部工具条和右侧紧急任务流的交互细节，已同步进 `DESIGN.md`。
- [Ontrack 参考页面](https://dribbble.com/shots/27489289-Ontrack-Task-Management-Dashboard)：采用其侧边导航、信息密度和项目进度组织方式。
- [World Monitor](https://github.com/koala73/worldmonitor)：采用只读 MCP 新闻工具，不复制 AGPL 源码。
- [Follow Builders](https://github.com/zarazhangrui/follow-builders)：使用其公开中心化 feed，并保留原文链接。
- [AI HOT Skill](https://raw.githubusercontent.com/KKKKhazix/khazix-skills/main/aihot/SKILL.md)：已按 v1.3.0 的匿名只读 v1 API 更新接入，使用精选流、站内阅读链接和来源署名规则，不再访问旧兼容层或执行版本检查。
- [OpenCLI Reader](https://github.com/jackwener/opencli)：已安装为只读来源读取能力；验证东方财富和新浪财经快讯命令可匿名读取，不需要浏览器登录或 API Key。
- [CoinDesk RSS](https://www.coindesk.com/arc/outboundfeeds/rss)、[Decrypt RSS](https://decrypt.co/feed)、[Blockworks RSS](https://blockworks.com/feed)、[Ethereum Foundation RSS](https://blog.ethereum.org/en/feed.xml) 与 [Bitcoin Magazine RSS](https://bitcoinmagazine.com/feed)：均验证为公开可读取的加密与链上资讯来源。
- [cryptocurrency.cv OpenAPI](https://cryptocurrency.cv/openapi.json)：当前新闻接口要求 x402 USDC 微支付，因此不作为免费来源接入。
- [官方 Lark CLI](https://github.com/larksuite/cli)：确认它覆盖文档、消息、任务和会议等飞书数据，但等待用户授权后接入。
- [Follow Builders 翻译提示](https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/prompts/translate.md)：保留技术词、人名和 URL，并生成自然简体中文。
- [GitHub REST 提交接口](https://docs.github.com/en/rest/commits/commits)：确认 Compare/Commit 可返回提交和文件改动统计，因此开发分析使用公开 Events + Compare + Commit 数据组合。
- [Tokdash](https://github.com/JingbiaoMei/Tokdash) 与 [TokenAnalytics](https://www.tokenanalytics.app/)：说明 Token 仪表盘通常依赖本机 agent 日志；Jessboard 因此直接读取 Codex 本机 JSONL 会话记录，不上传会话正文。

## 已完成

- 中文化和整体 UI 重做。
- 清空旧版本地示例数据。
- News Feed 五类来源的统一页面、手动刷新入口、双语切换和报纸分页布局。
- 传统金融公开快讯与五个免费加密/链上 RSS 来源，按主题筛选并和现有资讯统一去重。
- 本机静态服务、资讯 API 和上下文快照格式。
- 飞书 Project 需求和工作流排期的只读同步，使用既有本地私有配置且不暴露凭证。
- 飞书日程、文档元数据和近期消息预览的本机只读同步。
- 自动工作计划：按工作流截止时间、进度和最近更新时间排列 Project 任务，并显示接下来的日程和活跃 Codex 会话数。
- 每日工作简报：筛除图片式和长期未更新的历史任务，展示会议准备与可人工确认的消息提示，并保留飞书原始入口。
- 工作上下文和开发统计的手动刷新，以及文档/消息分页同步。
- 飞书“我负责的”任务同步、共享任务视图、模型用量和最高 Token 会话摘要。
- 逾期和近期截止的任务优先级、失效历史分配过滤、专注任务分页，以及覆盖本机多个仓库的提交统计。
- 项目主题分组、侧边栏悬停页名提示、可伸缩侧边栏控制，以及基于会话和提交聚合数据的开发工作画像。
- 每日简报的安静空状态、风险专用红色语义、移动端可用的语言/主题/新建任务入口，以及仅针对同步、最高优先级和风险的手绘提示。
- Follow Builders 中文翻译适配器。
- 报纸式资讯流：动态三列排版、市场/主题/重要度标注、底部来源栏，以及上海天气、湿度和农历日期。
- 四种可切换的顶部导航设计预览：安静指挥台、编辑部看板、AI Studio 和轻量自适应。
- 资讯刷新缓存、五类阅读筛选、来源栏自适应布局，以及 Songti SC + Georgia 的固定全站字体。
- 高任务量任务工作台、真实范围筛选、分页表格、按到期桶分组的时间轴、交付工作流、专注时长控制、开发分析加载状态和渐进式任务表单。

## 待完成

- 扩充本地 World Monitor 的精选 RSS 范围，并按需要提高外文资讯的中文翻译覆盖；如需完整托管情报，再配置 World Monitor API Key。
