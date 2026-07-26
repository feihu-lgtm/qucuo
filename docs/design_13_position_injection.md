# 13 位置注入设计（SillyTavern 原则）

## 设计目标

把原本「一大坨 system prompt」按 SillyTavern 的 13 位置（Prompt Manager）拆分成多条带位置标签的消息。每条消息带 `tavernBlock` / `tavernLabel`，让 `TraceViewer` 与「Prompt 注入结构」面板能直观定位哪一段内容落在哪个位置，同时保留原有的所有叙事/规则/schema 文本不变。

## 13 位置映射表

| 编号 | key | label | role | 本项目中承载的内容 |
|------|-----|-------|------|------------------|
| 1 | `main` | Main Prompt | system | `ENGINE_IDENTITY` + `GM_RULE` + 篇幅要求 + 旁白声线 |
| 2 | `worldInfoBefore` | World Info — Before Char | system | 预设拼装 `presetContent` + NPC lore 块 |
| 3 | `charDescription` | Character Description | system | 玩家角色名与状态说明（不擅自改状态） |
| 4 | `charPersonality` | Character Personality | system | 旁白/说书人语气由 Main Prompt 声线控制 |
| 5 | `scenario` | Scenario | system | 经蓝绿灯裁剪后的世界观总纲 `gated.text` |
| 6 | `worldInfoAfter` | World Info — After Char | system | 物件志（可选）、认知隔离（可选）、`MAP_LAW` |
| 7 | `persona` | Persona Description | system | 玩家以第一人称「我」扮演，`Gamemaster` 定位 |
| 8 | `authorsNote` | Author's Note | system | 运行时追加：NSFW 规则、体貌蓝绿灯文本 |
| 9 | `exampleStart` | Example Start Marker | system | `<START>` 标记 |
| 9 | `dialogueExamples` | Example Messages | system | NSFW 示例对话（仅 `nsfwOn` 时插入） |
| 10 | `chatHistory` | Chat History | user | 格式化后的近期对话 `hist` |
| 11 | `inChat` | In-Chat Injection | user | 当前场景/远景/召回/重逢/信息域 + 成文铁律 |
| 12 | `latestUser` | User's Latest Message | user | 当前指令：`cmdSuffix + extraNudge` |
| 13 | `phi` | Post-History Instructions | assistant | `FORMAT_LAW` + 当前分支 JSON schema + MVU 指令 |

## 关键实现点

### `buildSysBase`

- 返回 `makeBlock(...)` 数组，不再返回单条字符串。
- 所有旧的规则/schema/MVU 文本被抽到 `schemaBlock` 变量，再挂进 `phi` 块。
- `chatHistory` / `inChat` / `latestUser` 先返回空占位，由 `callMainOnce` 在调用前填充真实内容。

### `callMainOnce`

- 接收 `sysBlocks` 数组。
- 找到 `authorsNote` 块，追加 `NSFW_RULES`（`nsfwOn` 时）与体貌蓝绿灯 `_bodyGate.text`。
- 用 `sysBlocks.reduce((sum, b) => sum + (b.content?.length || 0), 0)` 计算总长度，用于 trace 日志。
- 构造 Tavern 顺序的 `chatMessages`：
  - `nsfwOn` 时插入 `MODE_PRIMER_MESSAGES` 作为 `dialogueExamples`。
  - 然后是 `chatHistory`（`hist`）、`inChat`（上下文+成文铁律）、`latestUser`（当前指令）。
- 赌石谈价分支保持原有轻量 sys 字符串，但包装成 `tavernBlock: "main"` 的单块 system 数组。
- 最终调用 `callModel(effectiveCfg, sysBlocks, chatMessages, ...)`。

### API 适配层（`apiConfig.js`）

- 保持向后兼容：传入字符串时行为与旧代码完全一致。
- 传入数组时：
  - **Anthropic**：把每个块格式化为 `[label]\ncontent` 的文本块数组；若只有一块则退化为 plain string。
  - **OpenAI / Qwen**：把每个块映射成 `{role: "system", content: formatBlock(b)}`，再拼到 `messages` 前部。
  - **Gemini**：把所有块拼成一段文本，按原逻辑 prepend 到第一条 user 消息。
- 所有 provider 都不支持真正的「system 消息与 user 消息交错」，所以位置 13（PHI）实际上也落在请求顶部；标签保留，用于本地调试与可视化。

### Trace 显示（`actionTrace.js`）

- `formatTrace` 检测到 `systemPrompt` 为数组时，按 `[label]\ncontent` 逐块渲染，不再打印 `[object Object]`。

## 注意

- API 限制决定了所有 system 块最终都会被发送到对话顶部；13 位置中的 PHI 在本地数据模型里保留为位置 13，实际请求顺序里会提前。
- 该设计主要服务于「可观测性」：开发者/玩家可以在 TraceViewer 里按 Tavern 位置查看 prompt 结构，排查哪一块被注入、哪一块被省略。
