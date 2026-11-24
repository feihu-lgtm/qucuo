# 设计：NPC 随身交易（所见即所得）

> 口径：和一个 NPC 交易 = 翻他身上的东西。装备、行囊、挂载就是他的货架——
> 所见即所得，买走他就真没了；有些挚爱之物不卖，给再多钱也摇头。
> 现实约束照旧：系统裁决价格与归属，AI 只写话术，不认帐。

## 0. 现状（已经有的骨架）

- `ensureNpcCombatData`：NPC 出场固化时，`carry` 声明 → `carriedItems`，没声明走 `rollNpcCarry` 兜底抽 catalog 真货。**掉落=可偷=这份清单**，`stolen` 位记被偷。
- `tradeWithNpc`：商店走独立货架（rollShopStock/buildShopInventory/#391 的 buildOcShopInventory），跟身上背的是两套数据——本次要并轨。
- 好感度：`varTree.角色[名字].好感度`，npcAwareness 给初见裁决初值。
- 挂载：followers.js（兽/人/机关人偶/剑灵，如铁伯）、坐骑（珍珠）。

## 1. 数据模型

### 1.1 carry 条目扩展（三字段）

```js
carry: [
  { name: "元宝金冠襦装", category: "armor", quality: "橙",
    sellable: true,          // 卖不卖；缺省按规则推
    price: 888,              // 底价 override；缺省走 catalog 价
    cherish: 95,             // 钟爱度 0-100；缺省 0
    slot: "equipment" },     // equipment 装备在身上 / bag 行囊 / mount 挂载
]
```

- `slot` 三档：**equipment**（穿着）、**bag**（行囊）、**mount**（挂载：坐骑/随从物件/随身活物的归属标记）。
- 三档在交易屏分区展示；挂载默认 `sellable:false`（铁伯不卖——机器爷爷是家人不是货）。

### 1.2 默认值推导（数据没标的兜底）

| 条件 | sellable | cherish | 价格 |
|---|---|---|---|
| 杂物 misc | true | 0 | catalog sellPrice 双倍（NPC 不会贱卖） |
| 武器/护甲/饰品 | true | 品阶×15（白0/绿15/蓝30/紫45/橙60/红75） | catalog buyPrice |
| 信物/任务凭证（ROLE_TROPHY 系） | false | 90 | — |
| 挂载 mount | false | 100 | — |
| 专属武学书/签名武器（name 含 npc 名号或 school 归属） | false | 80 | — |

### 1.3 钟爱度的意义

- `cherish ≥ 80` → 默认不卖，话术拒答（AI 写拒词，系统先判）。
- `cherish 50-79` → 可卖但加价 `price × (1 + cherish/50)`，并且卖出后 NPC 好感 -15、可能结怨（走现有 angry 通路）。
- `cherish < 50` → 正常买卖。
- **让渡口子**：玩家与该 NPC 好感 ≥ 60 且物品 cherish ≥ 80 → 出现「割爱」选项，按原价成交、好感 +10（对方忍痛割爱念情分）。好感 ≥ 80 → 偶发主动赠礼，不走交易。

## 2. 交易通路改造

### 2.1 货架换源

`tradeWithNpc` 的货架从「铺子 catalog」换成「`ensureNpcCombatData(npc).carriedItems` 按 slot 分区 + 卖价判定」：

```js
{
  shopName: "元朵朵的万事屋",
  sections: {
    equipment: [...],   // 穿着的
    bag: [...],         // 行囊
    mount: [...],       // 挂载（多标"不卖"）
  },
  sellCoef: 1.5,        // NPC 收玩家货的价格系数，见 §3
}
```

- 有铺子名义的（元朵朵万事屋、商号掌柜）保留店名做 UI 标题，货仍是身上货。
- 驻场/游走 NPC 同理开交易；没货的说"身无长物"（走现有摆摆手话术）。

### 2.2 买（玩家掏钱）

- 命中 `sellable:false` → 按钮灰显「不卖」，点击弹一句拒词（AI 侧写）。
- 命中 `cherish` 加价曲线算成交价；结算写两处：
  1. 玩家 `inv` 入件、`char.money` 扣价；
  2. **NPC 侧记卖出**：`npcState.trade.sold[itemName]=true`（见 §4 持久化），该件此后不参与掉落/偷窃/再卖。
- 装备档成交后对方进入"失去装备"态（战力结算已走 carriedItems，天然生效）。

### 2.3 卖（玩家出货）

- 玩家行囊每件 `sellPrice × sellCoef` 结算。`sellCoef` 按人定：
  - 元朵朵 **2.5**（冤种溢价——她觉得占了大便宜）；
  - 普通店主 1.0；奸商型 0.7；挚爱玩家（好感≥80）+0.3。
- 卖出的货**记入对方行囊**（`npcState.trade.bought`），此后可被看见、可被偷回——货随人走闭环。
- NPC 拒收：武器卖给平民/庙宇类不接（role 判）；被挂 `fencing=false` 的赃物敏感店拒收。

### 2.4 与偷窃/掉落并轨

- 同一份 `carriedItems`：买走的标 `sold`，偷走的标 `stolen`，打死的随机掉剩余——三态互斥，一件货只有一个归宿。
- 朵朵这身橙档襦装：偷要过 stealBias 0.9，买要掏 cherish 加价后的天价，好感 60 才能割爱——三条路三种戏。

### 2.5 送装备（反向往返）

- 「赠送」通路升级：`giveNpcItem` 成交后装备类物品不再只是好感事件——**当场穿上**：写进对方 `equipment` 槽位（比身上好的自动换装，换下的旧件退回行囊）。
- 武器/护甲/饰品判定可穿；杂物按现有 gift 通路只涨好感。
- 送挚爱档新装（品质≥对方现穿一档以上）好感加成翻倍；穿不下/不合身（如男装送女侠）AI 话术婉拒。

## 2.6 换装同步链（脱了要真脱）

NPC 身上装备发生变化（买走/偷走/掉落/赠送换装）→ **外貌字段即时重算**：

1. **外貌字段**：`npc.appearance`（brief/personality 里的衣装描述）由 `deriveAppearance(npc)` 按当前 equipment+挂载 实时派生——穿橙档襦装的朵朵和只剩抹胸的朵朵，描述就是两个人。
2. **log 外显**：变化瞬间系统 log 一笔（"元朵朵摘下了元宝金冠襦装，只剩贴身抹胸，抱着铁伯直发抖"——词由 AI 写，事件由系统发）。
3. **上下文注入**：外貌段**每次都照常全量发**进对话/偷看/战斗的 prompt（取 deriveAppearance 最新值，不是开关制）；当衣装缺失露出私密部位时，**额外多插一条强调段**——「当前衣不蔽体/私密外露」明示 AI 重点着墨，nsfw 私密外貌原文在该状态下转外显。
4. **面板外显**：NPC 详情卡/look 输出的衣着行同上，所见即所得。

数据层 `appearance`/`nsfw` 原文保留做底稿：derive 按装备在位情况覆写衣装句段，身材/脸蛋/神态锚点不动；脱到私密外露时强调段把 nsfw 段顶出来。朵朵脱了襦装还是娇小爆炸那位，只是衣不蔽体、上下全透。

## 3. 持久化

- `npcState.trade`（新增域，存 save）：`{ sold: {itemId:true}, bought: [item快照] }` 按 NPC id 记。
- `ensureNpcCombatData` 出场固化时叠加 trade delta：删 sold、补 bought——游走/驻场/复活都认帐。
- serialize/deserialize 白名单加 `trade`；老档无字段按空集。

## 4. UI

- TradingScreen 三分区标题「身上装备 / 行囊 / 挂载」，每件一行：名、品阶色、价、不卖灰标或钟爱徽记（♥ 高钟爱）。
- 买入弹确认行显示钟爱加价明细（"她想了想，咬咬牙：这价……行吧"由 AI 写）。
- 卖出侧显示该 NPC 的收购系数与拒收名单。

## 5. AI 侧

- 交易屏头部给 AI 一段「对方带货清单+钟爱度+好感」上下文，讨价还价/拒卖/割爱话术全由 AI 现写；成交判定只在系统。
- 拒卖话术模板三档：挚爱不售/高钟爱肉疼/平价。

## 6. 拆单（工人并发）

| 单 | 内容 | 文件量 |
|---|---|---|
| A | 数据模型：carry 三字段+slot schema + 默认推导 + OC/驻场逐条标（朵朵全标） | 3-4 |
| B | 持久化 npcState.trade + ensureNpcCombatData 叠加 + 存档白名单 | 3 |
| C | tradeWithNpc 换源：sections 货架 + cherish 价格曲线 + 拒卖判定 + 卖入/送装记账 | 3-4 |
| D | UI 三分区 + 徽记 + 确认弹；AI 上下文注入 | 3-4 |
| E | 换装同步链：deriveAppearance + log 外显 + prompt 注入改派生值 + 送装换装 | 3-4 |

依赖：B/C/E 依赖 A 的 schema；D 依赖 C；E 依赖 B。先 A+B 并发，再 C+D+E 并发。

## 7. 验收

- 元朵朵在鱼定村开交易：襦装挂 ♥ 高价、碎银荷包平价、铁伯标"不卖"。
- 买走核桃糕→她身上没了，偷/掉都没了；再开一局读档仍没了。
- 卖她一把白品刀→得 2.5 倍价→刀进了她行囊→下回能偷回来。
- 买/偷走她的襦装→log 写脱了→之后 look/对话/战斗里她都是新外貌。
- 送她一件蓝档护甲→她当场换上→外貌/log/上下文同步变。
- 好感 60 后对挚爱物出「割爱」选项。
