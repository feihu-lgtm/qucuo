# 路线丙 · AI 调用排查清单

> 测于 main `969c573`（2026-11-22）。只列现状和建议，**每行的「建议」等小狐定**，定了再动代码。
> 「占回合」指调用发生在 `AI_TURN` / `MOVE` / `LOCAL` 命令里：调度器（`engine/commands/commandScheduler.js`）
> 在它跑完前会把玩家后续的行动、移动、本地操作排进队列。`BACKGROUND` 命令不进队列。

标注：**能套** = 可改成「系统先落事实行，描写后台补」（#136 切磋的做法）；**必须等** = AI 的输出决定结果或就是玩家要看的东西；**已在后台** = 现在就不占回合。

## 一、占回合的调用

### 1. 一次普通回合里的几次调用（打字行动 / 对话 / 结算回合共用）

| 调用 | 在哪 | 建议 | 理由 |
| --- | --- | --- | --- |
| 行动识别（复合/拆分/类别/对象/物品/方向，最多数次） | `app/hooks/useIntentRouter.js` → `engine/intent/aiClassifier.js` | 必须等 | 决定走哪条路（执行/确认/自由行动）；按钮已跳过它 |
| 向量召回 + 重排 | `engine/act/memoryLayer.js` `runRecall`、`ports/rerank.js` | 必须等 | 是主叙事的材料；已和下一行并行 |
| 知识推演「事实摘要」（每回合最多 2 次） | `engine/act/memoryLayer.js` `runKnowledgeTurn` | **能套** | 摘要只用来填【信息域】，失败本来就「留空下回合再试」；可改成回合后台补写。**在 engine/act，要和路线甲对好** |
| 软结算选择题（赔罪/赠礼/邀同行/求教/拜师） | `engine/turn/settleTurn.js` → `ports/softSettle.js` | 必须等 | AI 选的结果决定好感、是否成功，叙事要据此写 |
| 主叙事 | `engine/act/actCall.js` | 必须等 | 就是玩家要看的正文 |
| 双调用提取（状态提取） | `engine/runTurn.js` → `ports/extraction.js` | 必须等 | 提取出的变动要在下一回合前落盘；结算回合已跳过 |
| 记账（小纸条 + 人物旧账） | `engine/turn/finalizeTurn.js` → `ports/bookkeep.js` | 已在后台 | 落盘后异步派发 |

### 2. 系统已经定好结果、只请 AI 写一段的「结算回合」（`actSettle`）

这些操作的钱、物品、数值在系统里已经改完，再发起一整轮 `act` 只是让 AI 写描写；结算回合本来就跳过提取。和切磋是同一种情况。

| 操作 | 发起处 | 建议 |
| --- | --- | --- |
| 钱庄存取、当铺质押/赎回 | `features/bank/logic.js` | **能套** |
| 住店、求医 | `features/buildings/lodging.js` | **能套** |
| 点菜/点酒、祈福 | `features/buildings/venue.js` | **能套** |
| 读书、买书、茶馆听传闻 | `features/buildings/study.js` | **能套**（传闻内容已在系统行里） |
| 买秘籍、墓壁参悟 | `features/buildings/skills.js` | **能套** |
| 拍卖得手 | `features/auction/logic.js` | **能套** |
| 接护镖、接悬赏、交悬赏 | `features/quest/logic.js` | **能套** |
| 赌坊押注、卖玉料 | `features/buildings/gambling.js`、`features/crafting/logic.js` | **能套** |
| 铁匠铺定制、金玉行雕玉 | `features/crafting/logic.js` | **能套**（匠人「几时送来」那句可写进系统行） |
| 拜入雪山派 | `features/sect/logic.js` | 必须等（走软结算 `learn_skill`） |
| 赠礼、赔罪、邀同行、向 NPC 求教 | `features/npc/exchange.js`、`anger.js`、`inviteCompanion.js`、`learn.js` | 必须等（软结算） |

**要小狐定的副作用**：结算回合现在会 ①推进 1 个时辰（`commitRound` 里非对话回合 `setTime(+1)`）②刷新底部选项 ③NPC 可能顺口回话。改成后台补写后，①要由系统行自己推进（或不推进），②③会没有。

### 3. 其他占回合的入口

| 入口 | 发起处 | 建议 | 理由 |
| --- | --- | --- | --- |
| 打字自由行动、对话、赌坊谈价 | `useGameUi.js`、`useCraftingAI.js` `handleGambleTalk` | 必须等 | 正文就是结果 |
| 任务选项 / 强制推进任务 | `useQuestPanel.js`（`forcedEvent`） | 必须等 | 剧情节点，提取要据正文结账 |
| 查看 NPC（`look`） | `useScreenHandlers.js` `handleNpcLook` | 待定 | 可先出系统卡片（名字、境界、装备），外貌描写后台补；但「看」本身就是要读描写 |
| 到达/传送后「环顾四周」 | `useAutoTravel.js` | 待定 | 有缓存时已走本地；无缓存要 AI 写房间。刷级路线上可考虑先出地名和出口 |

## 二、已经不占回合的调用（不用动）

| 调用 | 命令类别 / 方式 |
| --- | --- |
| 切磋战报、邀战 | #136 已改为事实行 + 后台补写（`useDuel.js`） |
| 私聊旁白 | `BACKGROUND`（私聊之间互相排队） |
| 说服交锋 | `BACKGROUND`，在说服界面里等 |
| 查看端详、查看预热、右栏查看 | `BACKGROUND` |
| 赌石相石、锻造/玉石设计 | `BACKGROUND`，在各自界面里等 |
| 日总结、事实摘要（切磋/飞鸽） | `BACKGROUND`（`daySummary`） |
| 地图格子预跑 | 不经调度器，fire-and-forget（`useAutosave.js`） |
| 飞鸽回信 | `BACKGROUND`（`pigeonReply`） |
| 穿搭建议 | `BACKGROUND` |
| 角色卡扫描、导入 NPC 装备规划 | `BACKGROUND` |
| 斗蛐蛐说书、酒馆夜报 | 各自界面内异步，失败落回模板（`ports/battleNarration.js`、`ports/simNarrator.js`） |

## 三、建议的动手顺序（等确认）

1. 先抽公共件（事实行先落、描写按 key 原位插回、回滚即作废），切磋改用它——不改行为，可以先做。
2. 第 2 节「能套」的结算回合按建筑分批改，每批一个 PR；副作用按小狐的决定处理。
3. 知识推演的事实摘要移到后台：涉及 `engine/act`，和路线甲对好再做。
4. 「待定」两项看小狐意见。
