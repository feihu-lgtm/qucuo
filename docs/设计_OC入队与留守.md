# OC 冒险者入队 + 留守设计稿

> 依据用户口径：入了队就在队里、在上下文里；可以让对方在任意地方/任意内房间等着；不能和角色接任务撞车。
> 全部建在现有伙伴系统上，不另起炉灶。

## 一、现状基座（不改的部分）

- `companionState` 单出战位互斥：2v2 引擎只有"玩家+1队友"，active 唯一，其余留守——OC 入队共用此位。
- `inviteCompanion`（features/npc）已支持 imported 伙伴：`unlockImportedCompanion` 按 `imported_<名字>` 动态挂槽，数值走人类均衡档，入队即把该 NPC 从 `room.npcs` 移除。
- `COMPANION_LORE`/`buildCompanionLore` 把人设注入 AI 上下文；`duelAlly` 决定切磋时队友上不上。
- `TeamModule` 面板已能列出/切换 unlockedCompanions。

## 二、OC 入队（复用 imported 通道，四条路不钉死）

**入队条件不写死单人单路**——同一 OC 四条路都通，玩家怎么谈都行，AI 对话自然议价，系统只做兜底判定：

1. **雇佣**：对话里出价谈钱，OC 按其 tradeStyle 还价（认赌不认价的、不收钱只收"债"的、卖人情十金的——价格弹性跟性格走，不是死标价）。付够即入队。
2. **前置任务**：谈不拢钱就谈事——帮他取一物/还一情/打一场，完成即入队。轻量走现有 quest 通道，不建主线。
3. **好感度邀请**：favor 攒够（建议 ≥60）直接邀，分文不取——聊得来、救过他、并肩下过地宫都算积累，AI 叙述推动，favor 数值兜底。
4. **开局青梅竹马**（保底）：角色创建可选"青梅竹马同行"，生成一位同乡固定 OC（不占 12 人池，名可改），零门槛随行——新档第一晚就有人搭话，也当随行/留守/切磋的教程演示。

**通道**：四路殊途同归 `unlockImportedCompanion(companionState, npc)`——`imported_<name>` 槽位，beast:false，招式用其 kungfu.moves 经 deriveSignatureMoveset 派生，数值按 levelCap。解锁条件只是四座桥，桥那头是同一个函数。

**入队即离队可逆**：OC 入队后 `getWorldAdventurers` 世界游放跳过该 id（不再随机刷新，否则两地分身）。雇佣的可解雇遣回世界池；任务/好感入队的属情谊绑定不可解雇（最多留守）；青梅竹马默认终身绑定。
4. **撞车防护（接任务不冲突）**：
   - OC 是动态生成的散人，本就不在任何 quest 文件/`questProgress` 的 giver 表里 → 天然无任务撞车。
   - 守卫兜底：inviteCompanion 前置检查"该 NPC 是否出现在进行中任务链的 giver/objective 名单"（扫 questProgress 未完成项 + content/quest/*.js 的 npc 字段），命中则拒绝并提示"此人有事在身"。OC 永远通不过这条拒绝线，但导入的其他 NPC 会。
   - 入队后 OC 的商店交互不变（见到仍可开店），偷盗/切磋照旧——只是切磋时 duelAlly 判定同名不上 2v2 已有。

## 三、留守（wait at any place / 每个内房间）

1. **状态**：companionState 条目加 `stationed: null | { district, roomId, roomName }`。null=随行（跟随玩家移动，注入上下文）；有值=留守。
2. **指令入口**：对话/面板给每个非 active 队友一条「在此等候」——把 stationed 设为当前房间；以及「跟上我」清空 stationed。
   - active 出战队友不设留守（出战位只有一个，留守=切换 active）。普通队友（未出战）才是留守主体。
   - 指令走确定性系统裁决（同邀请入队），AI 只演正文，不判定成败。
3. **落地表现**：留守队友写入对应房间的 npcs 列表（`room.npcs`/`worldState` 房间驻留层），玩家在**任何据点任意内房间**都能见到它、对话、唤回。实现上常驻在 worldState 的 per-room npc 池，而非内存态，跨房间持久。
4. **上下文注入**：
   - 随行队友：buildCompanionLore 注入"此刻随行"人设（kungfu/follower/persona 摘要）。
   - 留守队友：注入"谁在哪个房间等你"清单（一行一个：名字@据点·房间），让 AI 别写错人位置。
   - 留守房间的 NPC 列表注入时把留守队友标 `[队友·留守]`。
5. **跨天/存档**：companionState 进存档已有（buildSnapshot），stationed 字段随档走；老存档无此字段默认 null 即随行。

## 四、OC 随从（兽/人/机关/剑灵）挂法

- 随从作为 OC 数值包的一部分：`follower` 字段入 kungfu 派生——战斗中 OC 上场时其随从以"助战影子"出现（描述层；若做 3v3 另立项，先不实装第二单位）。
- OC 入队后随从跟 OC 一起：留守=一人一从驻守该房间；随行=一起随行。不单独占出战位。
- 四类注入文案：兽=不通人言只动作、人=正常对话、机关人偶=模仿腔拟声、剑灵=只在特定条件显形（月圆/见血）。

## 五、改造清单

| 文件 | 改动 |
|---|---|
| adventurers.js | 每条目加 follower/kungfu/persona/shop/stealables（设定稿 v4 字段） |
| NpcActionMenu.jsx | `adventurer` 也显示邀请入队按钮 |
| inviteCompanion.js | adventurer 走 unlockImportedCompanion；加任务 giver 撞车守卫 |
| companionState/companion.js | 条目加 stationed 字段；留守/跟上 setter |
| worldState/房间npc | 留守队友落到所在房间 npcs，唤回即移除 |
| roundNotes/buildCompanionLore | 注入随行/留守清单与 OC persona |
| TeamModule.jsx | 列出 OC 队友+留守状态+「在此等候/跟上我」 |
| getWorldAdventurers | 入队 OC 跳过世界刷新 |

## 六、待拍板

- 邀请门槛：好感度 ≥60？还是先并肩打过一次地宫？（建议先无门槛放开，试了再收）
- 随行上限：出战位本来就 1 人，随行（叙事层跟队）要不要也限制 1-2 人？（建议随行不限，出战仍单槽）
- 留守房间粒度：写死只能留"据点内房间"，还是野外/地宫也能丢？（建议先限据点内房间，地宫留守不安全）
