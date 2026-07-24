# Jessboard

Jessboard 是一个中文个人工作台，用来集中查看任务、项目排期、Codex 会话进度和资讯。它保留本机优先的任务体验，同时通过本机服务读取公开资讯和后续的飞书同步快照。

## 当前能力

- 中文总览、我的任务、项目排期、专注和咨询页。
- 开发分析页：每 30 秒刷新本机 Codex 会话 Token、skill/工具调用、GitHub 公开活动和当前仓库改动。
- 首次加载时清除旧版示例任务，之后的个人任务保存在当前浏览器。
- 资讯页手动合并 AI HOT、Follow Builders，以及本地 World Monitor RSS 适配器；默认显示简体中文，也可切换回英文原文。新闻按市场、主题、重要度和时效整合成独立报纸版面，不按 skill 来源分栏。
- Codex 会话和飞书数据使用统一的 `data/context.json` 快照格式，页面不接触私有凭证。
- 总览会自动将飞书 Project 工作流截止时间、完成进度、最近更新和日历安排整理为当天优先级与日程；它只读取数据，不会修改飞书任务。
- 仅在工作日 10:00 至 20:00 每小时自动刷新工作上下文，并在发现紧急截止时间或数据源失败时提示后续处理；总览也提供手动更新。
- 开发分析只读取 `~/.codex/sessions` 与公开 GitHub Events/Compare 接口的聚合结果；Codex 账户额度、账单和会话正文不会展示。
- 参考 Ontrack 的信息密度和侧边导航，配色使用项目提供的绿色、黑色、橙色和蓝灰色方案。

## 本地运行

```bash
npm start
```

然后打开 <http://127.0.0.1:4173>。资讯页和本机同步接口使用完整服务时，请运行 `PORT=4174 npm start` 并打开 <http://127.0.0.1:4174>。服务以前台进程运行，关闭对应终端后服务会停止；直接打开 `index.html` 只能查看静态页面。

同步快照命令：

```bash
npm run sync
```

`sync.config.json` 默认读取相邻 `workteam-morning-report` 项目的私有 `.env`，同步当前配置用户的最新 50 个飞书项目需求及其工作流排期，并通过本机已授权的 Lark CLI 同步所有未完成的“我负责的”飞书任务。它还同步未来 7 天日程、最多 100 份分页读取的文档元数据和 100 条近期消息预览。同步也会读取所有本机 Codex 会话的安全摘要（会话 ID、工作目录、模型、状态和时间），不会保留正文或凭证。凭证不会复制到 Jessboard，也不会发送给浏览器。

## 资讯配置

AI HOT 和 Follow Builders 不需要用户 API Key。World Monitor 的公开 MCP 工具需要只读 API Key，可在启动时配置：

```bash
WORLD_MONITOR_API_KEY=your_read_only_key npm start
```

默认模式不访问托管 MCP，而是读取 World Monitor 官方 feed 清单中的精选公开 RSS，并使用本机 Ollama 优先处理头条的中文标题和摘要，因此不需要 `WORLD_MONITOR_API_KEY`。其余文章保留原文和链接，避免刷新时等待过久。启动完整的本地环境：

```bash
brew services start ollama
ollama pull qwen3:0.6b
PORT=4174 npm start
```

本地模式使用 `OLLAMA_MODEL` 切换模型；Ollama 尚未连接时会保留英文原文，并在来源状态中明确显示。只有需要 World Monitor 托管 MCP 的完整情报结果时，才使用 `WORLD_MONITOR_MODE=hosted WORLD_MONITOR_API_KEY=your_read_only_key npm start`。关闭本机翻译可以使用 `NEWS_TRANSLATE=off`；关闭后，英文来源仍可在资讯页切换查看原文。Jessboard 只保留官方公开 feed 地址，不复制 World Monitor 的 AGPL 源码。

## 飞书连接

官方 Lark/Feishu CLI 已安装，版本为 `1.0.76`。它能覆盖任务、云文档、消息、日历和会议能力。Jessboard 的飞书项目任务使用现有 `workteam-morning-report/.env` 的 Project API 连接，普通飞书数据使用已授权的 CLI OAuth：

```bash
export PATH="$(npm prefix -g)/bin:$PATH"
lark-cli doctor
lark-cli config init --new
```

CLI 的只读输出会转换为 `data/context.json` 中的 `feishu.tasks`、`feishu.schedule`、`feishu.notes` 和 `feishu.messages`。会议纪要和消息只有同时命中 Jessie 或实时/EOD 业务关键词，并包含明确行动指令时，才会变成建议任务；可在 `sync.config.json` 的 `lark.actionability` 中调整关键词。Jessboard 不会把 OAuth 凭证写入前端。

### 语言配置

Follow Builders 的 skill 确实会询问 `en / zh / bilingual`，并将选择保存到 skill 配置；它的原始 feed 本身仍是英文，所以 Jessboard 现在用本机 Codex CLI 执行 `translate.md` 规则后再展示。AI HOT skill 固定提供中文 AI 资讯；World Monitor 的新闻 MCP 工具没有语言参数，Jessboard 会对它的结果使用同一套中文翻译流程。

## 测试

- `node --check app.js`、`node --check server.mjs`、`node --check sync.mjs`
- `git diff --check`
- 启动服务后检查导航、空白任务状态、任务表单、项目排期和咨询页手动刷新。

## 搜索记录

- [Ontrack 参考页面](https://dribbble.com/shots/27489289-Ontrack-Task-Management-Dashboard)：采用其侧边导航、信息密度和项目进度组织方式。
- [World Monitor](https://github.com/koala73/worldmonitor)：采用只读 MCP 新闻工具，不复制 AGPL 源码。
- [Follow Builders](https://github.com/zarazhangrui/follow-builders)：使用其公开中心化 feed，并保留原文链接。
- [AI HOT Skill](https://raw.githubusercontent.com/KKKKhazix/khazix-skills/main/aihot/SKILL.md)：遵循版本检查、非浏览器 User-Agent、公开只读 API 和来源署名规则。
- [官方 Lark CLI](https://github.com/larksuite/cli)：确认它覆盖文档、消息、任务和会议等飞书数据，但等待用户授权后接入。
- [Follow Builders 翻译提示](https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/prompts/translate.md)：保留技术词、人名和 URL，并生成自然简体中文。
- [GitHub REST 提交接口](https://docs.github.com/en/rest/commits/commits)：确认 Compare/Commit 可返回提交和文件改动统计，因此开发分析使用公开 Events + Compare + Commit 数据组合。
- [Tokdash](https://github.com/JingbiaoMei/Tokdash) 与 [TokenAnalytics](https://www.tokenanalytics.app/)：说明 Token 仪表盘通常依赖本机 agent 日志；Jessboard 因此直接读取 Codex 本机 JSONL 会话记录，不上传会话正文。

## 已完成

- 中文化和整体 UI 重做。
- 清空旧版本地示例数据。
- News Feed 三类来源的统一页面、手动刷新入口、双语切换和报纸分页布局。
- 本机静态服务、资讯 API 和上下文快照格式。
- 飞书 Project 需求和工作流排期的只读同步，使用既有本地私有配置且不暴露凭证。
- 飞书日程、文档元数据和近期消息预览的本机只读同步。
- 自动工作计划：按工作流截止时间、进度和最近更新时间排列 Project 任务，并显示接下来的日程和活跃 Codex 会话数。
- 工作日 10:00 至 20:00 的每小时工作上下文刷新，以及文档/消息分页同步。
- 飞书“我负责的”任务同步、共享任务视图、模型用量和最高 Token 会话摘要。
- 逾期和近期截止的任务优先级、失效历史分配过滤、专注任务分页，以及覆盖本机多个仓库的提交统计。
- Follow Builders 中文翻译适配器。
- 报纸式资讯流：动态三列排版、市场/主题/重要度标注、底部来源栏，以及上海天气、湿度和农历日期。

## 待完成

- 扩充本地 World Monitor 的精选 RSS 范围；如需完整托管情报，再配置 World Monitor API Key。
- 为 Follow Builders 英文内容增加可选的中文摘要生成。
