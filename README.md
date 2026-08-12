# Jessboard

Jessboard 是一个支持中文和英文界面的个人工作台，用来集中查看任务、项目排期、Codex 会话进度和资讯。它保留本机优先的任务体验，同时通过本机服务读取公开资讯和后续的飞书同步快照。

## 当前能力

- 支持中文和英文界面的总览、工作收件箱、我的任务、每周复盘、项目工作台、专注、开发分析和资讯页。
- 全站采用白色工作面、深色优先级/统计面板和低饱和灰紫侧边栏；黄色仅用于新建任务与少量紧急提醒。桌面端右侧导航支持展开和收起，小屏幕自动改为底部导航。
- 我的任务支持卡片、按到期桶分组的时间轴和高任务量表格三种展示方式，支持搜索、真实时间范围、状态/优先级筛选和分页；本地任务按产品、开发、沟通、研究和行政分类。总览显示完成情况、任务类型和真实记录的活动趋势。
- 业务目标工作台统计你配置的飞书 Project 业务线工作项（当前为实时&EOD图表、AI Agents / AI 前台），并额外纳入你在飞书 Project 中标记关注的未完成事项；两类重合时按工作项 ID 合并一次，并在页面明确标注“我关注”。已完成事项按飞书实际更新时间收纳为历史，不能因本次同步而重新进入当前工作；工作流已达 100% 时即使上游状态仍旧也会被视为完成。同范围内明确分配给你的近期任务也会纳入。旧快照缺少新的组别或关注标记时不会展示 Project 工作项，直到手动刷新获得可信归属。首页以目标投入组合和交付阶段分布表达当前情况，避免重复目标卡片；详情页只列出待推进的任务，飞书未提供下一步时会如实说明。这是一段时间内的参与事项聚合，不是单个飞书 Project 的官方完成率。
- 可选的 Meegle CLI 补充飞书 Project 的“我的工作”待办、逾期和本周节点，用于标明个人关联和下一步；点击 Project 任务可按需读取其工作流、依赖、关联资料、近期变更、讨论和未来两周排期。Meegle 登录失效时，常规 Project 快照仍可使用，页面不会把标题关键词当作个人关联或完成状态的依据。
- 专注页支持 25、50、90 分钟时长、跳过当前任务和五项高优候选任务；新建任务表单将项目、工作类型和状态收纳为“更多选项”。
- 顶部“专注模式”会隐藏总览中的次要模块，保留当天工作和紧急任务，不再提供会破坏混合视觉层级的全局深浅色切换。
- 独立设计预览页：打开 `/design-demos.html` 可在四种顶部导航和数据看板风格之间切换，用于确认改版方向，不会改变正式工作台。
- 项目进度会在每次刷新后重新按业务语义归纳：已知产品目标保留稳定身份，新出现且重复的工作主题会自动形成候选目标；浏览器仅保留目标身份和变化摘要，用于避免把全部事项笼统归为 `cam` 或把 Codex 会话混入飞书进度。
- 开发分析页默认围绕当前时间范围组织：首屏展示本周期 Token、会话、合并后的代码提交和待提交改动，并将 Token 与上一等长周期比较；缓存输入明确标注为输入 Token 的复用参考，不重复计入消耗。模型、使用场景与高投入会话收纳为可展开详情。GitHub 公开、已授权私有仓库和本机提交合并为同一条可筛选的代码活动流，每条记录保留来源与时间。
- 首次加载时清除旧版示例任务，之后的个人任务保存在当前浏览器。
- 资讯页合并 AI HOT、Follow Builders、本地 World Monitor RSS、公开财经快讯和公开加密 RSS；统一去重后按 AI 与开发、产品与公司、市场/政策/安全、金融与加密五类阅读，并保留合并来源与原文链接。最近一次成功刷新会保存在当前浏览器，重新打开页面时立即显示，再在后台更新。
- Codex 会话和飞书数据使用统一的 `data/context.json` 快照格式，页面不接触私有凭证。
- 总览会自动将飞书 Project 工作流截止时间、完成进度、最近更新和日历安排整理为当天优先级与日程；它只读取数据，不会修改飞书任务。
- 总览首页以每日工作简报呈现今日必做、会议准备、待确认消息、风险和日终闭环；今日必做只采纳截止时间、外部影响加行动请求，或近期人工推进等明确证据，技术优化关键词本身不会触发升级；群消息必须命中当前管理的业务范围且明确提及用户，私聊也可进入待确认列表；所有消息预览会归纳为不超过两行的上下文与行动摘要，完整原文仍可通过飞书链接查看；消息只有由用户确认后才会加入浏览器本地任务。
- 工作上下文按页面上的手动刷新按钮更新；刷新会显示真实阶段，其中 Project 工作流排期显示已读取数量和总数，而非估算等待时间。开发统计首次进入开发页时读取，并可通过手动刷新再次更新。在发现紧急截止时间或数据源失败时提示后续处理。
- 开发分析只读取 `~/.codex/sessions`、公开 GitHub Events/Compare 接口、显式授权的私有仓库提交元数据和当前 `src` 工作区的 Git 历史；Codex 账户额度、账单和会话正文不会展示。
- 参考 Task Manager Dashboard 与 Tasks Manager 的时间轴、深色任务栏和信息密度；全站使用 Manrope 与 Noto Sans SC，并以黄色、珊瑚、紫色、青色和绿色表达有意义的状态。

## 本地运行

```bash
npm start
```

然后打开 <http://127.0.0.1:4173>。这是包含资讯和本机同步接口的完整服务；仅当 4173 已被占用时，才使用 `PORT=4174 npm start`。服务以前台进程运行，关闭对应终端后服务会停止；直接打开 `index.html` 只能查看静态页面。未配置飞书或 Codex 本机环境时，首页和本地任务仍可使用，只是不会显示对应的同步数据。

同步快照命令：

```bash
npm run sync
```

`npm run sync` 是可选能力，需要相邻 `workteam-morning-report` 项目的私有 `.env` 和已授权的本机 Lark CLI。满足前提后，它会同步 `sync.config.json` 中配置的业务线和当前用户关注的飞书项目需求、实际工作流状态和未完成事项的排期，以及所有未完成的“我负责的”飞书任务。同步首先读取每个新建或已变更工作项的真实工作流状态；未变化的结果才会复用，因此已结束事项不会以标题或本机推断来判断。读取按 `workflowConcurrency`（默认 3）分批并行执行，同时读取未来 7 天日程、最多 100 份分页读取的文档元数据和 100 条近期消息预览。若本机安装并登录 Meegle CLI，刷新会额外读取个人 Project 待办；其登录是独立的，失效时只跳过这一层补充，不影响既有 Project 快照。同步也会读取本机 Codex 会话的安全摘要（会话 ID、工作目录、模型、状态和时间），不会保留会话正文或凭证。凭证不会复制到 Jessboard，也不会发送给浏览器。

## 私有 GitHub 提交

默认只显示公开 GitHub Push Events。要展示私有仓库的提交，在启动本机服务前设置一个只读的 fine-grained GitHub token，并明确列出允许读取的仓库：

```bash
export JESSBOARD_GITHUB_TOKEN=github_pat_your_read_only_token
export JESSBOARD_GITHUB_PRIVATE_REPOSITORIES="owner/repository-one,owner/repository-two"
npm start
```

Token 只需对列出的仓库授予 `Contents: Read` 权限。Jessboard 只读取当前 GitHub 账号的提交元数据、时间和新增/删除行统计，不读取代码内容、文件差异或凭证；token 仅由本机服务使用，不会返回浏览器。未配置 token 时，页面会继续显示公开提交，并提示已配置的私有仓库正在等待授权。

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

本地模式使用 `OLLAMA_MODEL` 切换模型；Ollama 尚未连接时会保留英文原文。每次资讯刷新还会通过本机启动的 `codex exec` 处理最多 12 条外文重点资讯，默认最多等待 45 秒，可用 `NEWS_TRANSLATE_TIMEOUT_MS` 调整；传入的仅是公开新闻的标题、摘要与链接，其传输和保留方式遵循当前 Codex 账号或服务设置。剩余文章保留原文，避免翻译阻塞完整刷新。关闭两种翻译可以使用 `NEWS_TRANSLATE=off`。只有需要 World Monitor 托管 MCP 的完整情报结果时，才使用 `WORLD_MONITOR_MODE=hosted WORLD_MONITOR_API_KEY=your_read_only_key npm start`。Jessboard 只保留官方公开 feed 地址，不复制 World Monitor 的 AGPL 源码。

传统金融快讯通过只读 OpenCLI 获取东方财富和新浪财经的公开内容，配置位于 `data/finance-news-sources.json`。服务会优先读取 `OPENCLI_BIN`，否则自动定位 npm 全局安装目录中的 OpenCLI。加密与链上资讯读取 CoinDesk、Decrypt、Blockworks、Ethereum Foundation 和 Bitcoin Magazine 的公开 RSS，配置位于 `data/crypto-feeds.json`。所有这些来源均无需 API Key、付费订阅或钱包授权；部分财经快讯没有单篇 URL 时，页面会链接至该来源的公开快讯页。

## 飞书连接

官方 Lark/Feishu CLI 已安装，版本为 `1.0.76`。它能覆盖任务、云文档、消息、日历和会议能力。Jessboard 的飞书项目任务使用现有 `workteam-morning-report/.env` 的 Project API 连接，普通飞书数据使用已授权的 CLI OAuth：

```bash
export PATH="$(npm prefix -g)/bin:$PATH"
lark-cli doctor
lark-cli config init --new
```

CLI 的只读输出会转换为 `data/context.json` 中的 `feishu.tasks`、`feishu.schedule`、`feishu.notes` 和 `feishu.messages`。会议纪要和消息命中 Jessie 或配置的业务关键词，并包含明确行动指令时，会成为待人工确认的建议任务；可在 `sync.config.json` 的 `lark.actionability` 中调整关键词。每日简报中的群消息筛选更严格，必须同时属于当前管理范围并明确提及 Jessie；私聊按独立规则判断。Jessboard 不会把 OAuth 凭证写入前端。

### 语言与翻译

AI HOT 固定提供中文 AI 资讯。其余来源保留原始文章链接和原文；翻译成功时显示中文标题与摘要，未翻译的文章直接展示英文原文。来源栏只显示已翻译条数或“英文原文”，不会把本机服务的错误信息展示给读者。

## 测试

- `node --check app.js`、`node --check business-goals.js`、`node --check daily-brief.js`、`node --check metrics.mjs`、`node --check meegle-client.mjs`、`node --check server.mjs`、`node --check sync.mjs`
- `git diff --check`
- 启动服务后检查导航、空白任务状态、任务表单、项目工作台、开发分析的来源筛选和资讯页手动刷新。

## 搜索记录

- [Task Manager Dashboard UI](https://dribbble.com/shots/23648549-Task-Manager-Dashboard-UI)：确认是当前截图的原始单页任务管理概念；其视觉语言已整理为 `DESIGN.md`，用于后续界面更新，保留真实内容与可用控件。
- [Tasks Manager](https://dribbble.com/shots/21516421-Tasks-Manager)：补充确认周时间轴、Card/Block/Table 视图切换、底部工具条和右侧紧急任务流的交互细节，已同步进 `DESIGN.md`。
- [Ontrack 参考页面](https://dribbble.com/shots/27489289-Ontrack-Task-Management-Dashboard)：采用其侧边导航、信息密度和项目进度组织方式。
- [Lieflat Charts](https://github.com/larashero3-dotcom/lieflat-charts)：在个人非商业使用范围内参考其“一个图表达一个结论”、按数据形状选择图型、统一色彩系统的原则；Jessboard 未复制其代码或样式，当前采用目标投入组合、交付阶段分布和目标来源关系三种快速判断型表达，避免用装饰图填充面板。
- [World Monitor](https://github.com/koala73/worldmonitor)：采用只读 MCP 新闻工具，不复制 AGPL 源码。
- [Follow Builders](https://github.com/zarazhangrui/follow-builders)：使用其公开中心化 feed，并保留原文链接。
- [AI HOT Skill](https://raw.githubusercontent.com/KKKKhazix/khazix-skills/main/aihot/SKILL.md)：已按 v1.3.0 的匿名只读 v1 API 更新接入，使用精选流、站内阅读链接和来源署名规则，不再访问旧兼容层或执行版本检查。
- [OpenCLI Reader](https://github.com/jackwener/opencli)：已安装为只读来源读取能力；验证东方财富和新浪财经快讯命令可匿名读取，不需要浏览器登录或 API Key。
- [CoinDesk RSS](https://www.coindesk.com/arc/outboundfeeds/rss)、[Decrypt RSS](https://decrypt.co/feed)、[Blockworks RSS](https://blockworks.com/feed)、[Ethereum Foundation RSS](https://blog.ethereum.org/en/feed.xml) 与 [Bitcoin Magazine RSS](https://bitcoinmagazine.com/feed)：均验证为公开可读取的加密与链上资讯来源。
- [cryptocurrency.cv OpenAPI](https://cryptocurrency.cv/openapi.json)：当前新闻接口要求 x402 USDC 微支付，因此不作为免费来源接入。
- [官方 Lark CLI](https://github.com/larksuite/cli)：确认它覆盖文档、消息、任务和会议等飞书数据，但等待用户授权后接入。
- [Follow Builders 翻译提示](https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/prompts/translate.md)：保留技术词、人名和 URL，并生成自然简体中文。
- [GitHub REST 提交接口](https://docs.github.com/en/rest/commits/commits)：确认 Compare/Commit 可返回提交和文件改动统计，因此开发分析使用公开 Events + Compare + Commit 数据组合。
- [GitHub fine-grained token permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)：确认私有仓库的提交读取可限制为显式选择的仓库，并仅授予 `Contents: Read`；Jessboard 因此只在本机服务持有该只读 token。
- [Tokdash](https://github.com/JingbiaoMei/Tokdash) 与 [TokenAnalytics](https://www.tokenanalytics.app/)：说明 Token 仪表盘通常依赖本机 agent 日志；Jessboard 因此直接读取 Codex 本机 JSONL 会话记录，不上传会话正文。

## 公开资料与鸣谢

感谢以下公开项目、文档、设计作品与资讯发布方。Jessboard 仅将它们用于界面研究、只读数据获取或本机展示；每条资讯仍保留原始来源链接，未复制或再发布原文内容。

### 设计参考

- [Task Manager Dashboard UI](https://dribbble.com/shots/23648549-Task-Manager-Dashboard-UI)、[Tasks Manager](https://dribbble.com/shots/21516421-Tasks-Manager) 与 [Ontrack Task Management Dashboard](https://dribbble.com/shots/27489289-Ontrack-Task-Management-Dashboard)：为任务时间轴、优先级面板、导航信息密度和版式层级提供参考。

### 界面与本机能力

- [Google Fonts](https://fonts.google.com/)：提供 Manrope、Noto Sans SC 和 Shantell Sans 字体。
- [Lucide](https://lucide.dev/)：提供界面图标。
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser)：解析公开 RSS 内容。
- [Ollama](https://ollama.com/)：可选的本机资讯中文翻译能力；仅处理公开资讯，Codex 翻译的独立数据边界见“资讯配置”。

### 公开接口、工具与项目

- [GitHub REST API](https://docs.github.com/en/rest)：读取公开事件、提交比较和提交详情，用于开发分析。
- [Open-Meteo](https://open-meteo.com/)：提供上海天气摘要。
- [官方 Lark CLI](https://github.com/larksuite/cli)：在用户本机授权后读取飞书任务、日历、文档和消息快照。
- [World Monitor](https://github.com/koala73/worldmonitor)：提供公开 RSS 清单，以及可选的只读 MCP 新闻能力。
- [Follow Builders](https://github.com/zarazhangrui/follow-builders) 与其[翻译提示](https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/prompts/translate.md)：提供公开创作者资讯源和中文翻译写法参考。
- [AI HOT Skill](https://raw.githubusercontent.com/KKKKhazix/khazix-skills/main/aihot/SKILL.md)：提供匿名只读的 AI 资讯接口接入规范。
- [OpenCLI](https://github.com/jackwener/opencli)：读取公开财经快讯；不需要账号或 API Key。
- [Tokdash](https://github.com/JingbiaoMei/Tokdash)、[TokenAnalytics](https://www.tokenanalytics.app/) 与 [cryptocurrency.cv OpenAPI](https://cryptocurrency.cv/openapi.json)：用于调研 Token 与资讯数据展示方式；后者因需要 x402 微支付，未接入 Jessboard。

### 公开资讯来源

- [BBC World](https://feeds.bbci.co.uk/news/world/rss.xml)、[The Guardian World](https://www.theguardian.com/world/rss)、[NPR World](https://feeds.npr.org/1001/rss.xml) 与 [PBS NewsHour](https://www.pbs.org/newshour/feeds/rss/headlines)：世界资讯。
- [TechCrunch](https://techcrunch.com/feed/)、[The Verge](https://www.theverge.com/rss/index.xml)、[Ars Technica](https://feeds.arstechnica.com/arstechnica/technology-lab)、[Hacker News](https://hnrss.org/frontpage)、[MIT Technology Review](https://www.technologyreview.com/feed/) 与 [VentureBeat AI](https://venturebeat.com/category/ai/feed/)：技术与 AI 资讯。
- [东方财富 7x24](https://kuaixun.eastmoney.com/) 与 [新浪财经 7x24](https://finance.sina.com.cn/7x24/)：传统财经快讯。
- [CoinDesk](https://www.coindesk.com/arc/outboundfeeds/rss)、[Decrypt](https://decrypt.co/feed)、[Blockworks](https://blockworks.com/feed)、[Ethereum Foundation](https://blog.ethereum.org/en/feed.xml) 与 [Bitcoin Magazine](https://bitcoinmagazine.com/feed)：加密与链上资讯。

感谢所有上述资料的维护者与内容发布者。若任何来源调整访问方式、版权标注或使用要求，Jessboard 会相应更新或停止接入。

## 已完成

- 中英文界面和整体 UI 重做。
- 清空旧版本地示例数据。
- News Feed 五类来源的统一页面、手动刷新入口、双语切换和报纸分页布局。
- 传统金融公开快讯与五个免费加密/链上 RSS 来源，按主题筛选并和现有资讯统一去重。
- 本机静态服务、资讯 API 和上下文快照格式。
- 飞书 Project 需求和工作流排期的只读同步，使用既有本地私有配置且不暴露凭证。
- 可选 Meegle CLI 的个人待办补充和按需 Project 上下文，不可用时保留已成功的常规同步快照。
- 飞书日程、文档元数据和近期消息预览的本机只读同步。
- 自动工作计划：按工作流截止时间、进度和最近更新时间排列 Project 任务，并显示接下来的日程和活跃 Codex 会话数。
- 每日工作简报：筛除图片式和长期未更新的历史任务，展示会议准备与可人工确认的消息提示，并保留飞书原始入口。
- 工作上下文和开发统计的手动刷新，以及文档/消息分页同步。
- 飞书“我负责的”任务同步、共享任务视图、模型用量和最高 Token 会话摘要。
- 逾期和近期截止的任务优先级、失效历史分配过滤、专注任务分页，以及覆盖本机多个仓库的提交统计。
- 项目主题分组、侧边栏悬停页名提示、可伸缩侧边栏控制，以及基于会话和提交聚合数据的开发工作画像。
- 动态业务目标归纳、真实飞书 Project 工作流状态和刷新进度、已完成事项收纳、待处理周指标跳转，以及任务卡片直达对应飞书原始记录。
- 显式私有 GitHub 仓库列表的只读提交聚合；未授权时不读取任何私有远端信息。
- 每日简报的安静空状态、风险专用红色语义、移动端可用的语言/主题/新建任务入口，以及仅针对同步、最高优先级和风险的手绘提示。
- Follow Builders 中文翻译适配器。
- 报纸式资讯流：动态三列排版、市场/主题/重要度标注、底部来源栏，以及上海天气、湿度和农历日期。
- 四种可切换的顶部导航设计预览：安静指挥台、编辑部看板、AI Studio 和轻量自适应。
- 资讯刷新缓存、五类阅读筛选、来源栏自适应布局，以及 Songti SC + Georgia 的固定全站字体。
- 高任务量任务工作台、真实范围筛选、分页表格、按到期桶分组的时间轴、交付工作流、专注时长控制、开发分析加载状态和渐进式任务表单。

## 待完成

- 扩充本地 World Monitor 的精选 RSS 范围，并按需要提高外文资讯的中文翻译覆盖；如需完整托管情报，再配置 World Monitor API Key。
