# 交接文档 · 赌石卡牌 UI 重构（2026-07-23）

> 本轮把赌石界面从「chibi 围圈」重做为「**塔罗牌卡牌 · 凹半圆围台**」，
> 并接通了「谈价 → 价格变 → 结算」的勾连闭环。本文交接**当前状态、素材清单、
> 未完成项、落地时的坑**，供下一位（或下次的自己）接手。

---

## 一、当前进度总览

| 模块 | 状态 |
|---|---|
| 系统裁决层 `gambleStone.js`（出生固化/开刀/竞价/委托） | ✅ 完成，未动核心 |
| 谈价勾连闭环（走 act 管线 + `<deal>` 轻量注入） | ✅ 已接通并 build 通过 |
| 开刀动画（刀光→碎末→开口→裂→露肉→揭晓） | ✅ 静态 HTML 调好手感，**未落 React** |
| 素材：背景/台/石/刀口/裂/气泡/卡框 | ✅ 全部真透明、归位 |
| 竞价者卡面立绘 | ✅ 8/8 全部集齐 |
| 卡牌凹半圆围台布局 | 🟡 HTML demo 已确认方向，**未落 React** |
| React 正式组件套用新布局 | ❌ 待办（当前组件还是 chibi 围圈那版） |

---

## 二、最终确定的设计决策（重要，别推翻）

1. **布局 = 卡牌凹半圆围台**：
   - 赌台 + 石头在**画面中上部**当主角（石头坐独脚台桌面，可放大）
   - 八张塔罗牌卡沿**凹半圆（⌣，中间靠下、两侧向上抱）**围在下方，不遮挡赌台
   - **报价气泡放每张卡的下方**（不是头顶），用 `ui/bub_gold1.png` 统一款
   - **点选放大**：点某张卡 → 放大居中提到最前 + 背景变暗，再点空白收回
2. **石头坐台定位**：独脚台是透视图，**放弃"桌板中点"算法**，改**目视定位**——石头底坐在桌面圆盘上（桌面在台图 y≈0.20 处）。
3. **卡牌 = 立绘 + 卡框合成**：写实唯美风竖构图立绘（才旦那种）填入 9:16/9:21 华丽卡框。
4. **谈价走 act 主管线**（不自造 harness），注入要轻（仿 inspectItem）。

---

## 三、竞价者名单（**有人员替换，落地时须改代码**）

原 `gambleStone.js` 的 8 个 key → 本轮替换后的实际角色：

| 位置 | 最终角色 | 卡文件 | 原 key（代码里待改） | kind | 备注 |
|---|---|---|---|---|---|
| 1 | 雪山弟子 | `card_xueshan.png` | xueshan | barter | 以物易物 |
| 2 | **苏宛** | `card_suwan.png` | ~~muming~~→suwan | — | **替换跟风牧民** |
| 3 | **才旦** | `card_caidan.png` | ~~xiaofan~~→caidan | — | **替换石料小商贩** |
| 4 | 温掌柜 | `card_wen.png` | wen | boss | 庄家·保底回收（性转女掌柜版） |
| 5 | **李若由** | `card_liruoyou.png` | ~~fushang~~→liruoyou | cash/top | **替换天都富商**·高价 |
| 6 | 兰姐 | `card_lanjie.png` | lanjie | condition | 带条件 |
| 7 | 锦官差役 | `card_chaiyi.png` | chaiyi | cash | onlyWeapon |
| 8 | 黑风寨采买 | `card_heifeng.png` | heifeng | favor | 人情债·带黑风令 |

> ⚠️ **落地时须同步改 `gambleStone.js` 的 BIDDER_TYPES**：把 fushang→liruoyou、
> muming→suwan、xiaofan→caidan（名字、mult、cash、kind、bio、carry 一并调整）。
> 苏宛/才旦/李若由原是主线角色，拉进赌桌当买家——人设上需圆过去（她们碰巧来料场淘石/当买家）。

---

## 四、素材清单（全部真透明，`public/stones/`）

**背景**（1672×941）：
- `bg_hall_day.png` 白天·天窗天光（明亮通透，无点灯）
- `bg_hall_night.png` 夜·月光烛火（幽暗）
- `bg_hall.png` = 默认（当前指向 day）。**落地建议按游戏昼夜切换 day/night**

**赌台**：`table.png` —— **藏式独脚高台**（紫檀描金·镶绿松红珊瑚·莲台底座），已抠白底透明。桌面圆盘在图 y0.08~0.28。

**石头**（512²，真透明，婆婆提供的干净版）：
`skin_wusha/huangsha/yansha/laoxiang/tiexiu/songhua.png`（黑乌砂/黄沙皮/盐沙/老象皮/铁锈/松花）

**刀口蒙版**（6 个随机形状，白色实心，做开刀窗口 mask）：`cut_1.png`~`cut_6.png`
- 出生固化：`gambleStone.js` 里每个 slot 已加 `cutShape`(1-6) 字段

**裂纹**（按暗度抠，只留暗线）：`crack_top/mid/bot.png`

**卡框**（`frames/`，均已抠透明、内框可填立绘）：
- `frame_lux.png` —— **主力框**（大尺寸华丽·内框 567×1232≈9:21，立绘填入清晰不糊）
- `frame_gold/gold2/wood/wood2/copper/stone.png` —— 早期六品阶框（已九宫格截成内框 9:16，较小，备用）

**竞价者卡**（`cards/`，立绘×frame_lux 合成，941×1672 高清不糊）：
`card_xueshan/suwan/caidan/liruoyou/lanjie/chaiyi/heifeng.png`（7 张，**差 card_wen 温掌柜**）

**UI 部件**（`ui/`）：
- 气泡 `bub_gold1~4/wood1~2/paper/stone.png`（统一用 gold1）
- 按钮底 `bar_wood.png`（开刀）/`bar_paper.png`（卖出·据为己有）
- 图标 `btn_arrow/close/plus`、`coin/ingot/hammer/star/burst/cloud/eye` 等

---

## 五、开刀动画规格（静态 HTML 已调好，待落 React）

一套约 1.2 秒，**屏息揭晓**节奏（赌石"一刀天堂一刀地狱"感）：
1. **刀光**：白金光沿刀口角度划过 + 石头轻震（0s，.38s）
2. **碎末**：14 颗石屑往上崩溅，颜色随品相（纯青绿/白米灰/杂褐，0.25s 触发）
3. **屏息一顿**（~0.3s）
4. **开口**：刀口蒙版从 scale0 弹性放大到位（0.55s）
5. **露肉**：玉肉从过曝渐显到正常（jadeReveal）
6. **裂**（若 crack）：`crack_{pos}.png` 蔓延
7. **揭晓大字**：品相大字上浮飘散（纯绿/白灰/杂橙；裂显红"X·裂!"）

> 动画 CSS/JS 见 `/home/claude/wuxia-mud/make_preview2.py` 生成的 HTML（keyframes: slash/shatter/openUp/jadeReveal/crackGrow/flashLabel/stoneShake）。落 React 时把这套 DOM 操作改成 React state 驱动。

---

## 六、谈价勾连闭环（已在 MudRPG.jsx 接通，build ✓）

**数据流**：
1. 赌桌双击竞价者 → 组件 `setMinimized(true)`（**不 unmount**，保住石头 state）→ `handleGambleTalk(name, content, ctx)`
2. `gambleTalkCtx.current = ctx`（`{bidderName, stoneId, baseOffer, cash, carry}`）→ `act(content)` 进主叙事
3. talk 模式拼 prompt 时若 `gambleTalkCtx.current` 有值 → 追加一段 `<deal>` 规则（轻量，仅这轮）
4. 玩家在主叙事砍价，AI 演对白 + 末尾 `<deal>{"priceMult":x,"addItem":y}</deal>`
5. `parseMainResponse` 抠出 `<deal>`（**显示时剥掉标签**，像剥 thinking）
6. `gambleSettleNegotiation` clamp[0.8,1.5]/校验 carry 赠物 → 写 `gambleNegotiation[stoneId][name]` → addLog「🤝 谈妥了…」→ 清 `gambleTalkCtx`
7. 展开赌桌 → 竞价者报价读 `negotiation` 覆盖（显示"✓谈妥"）→ 按新价结算

**改动位置**（MudRPG.jsx）：
- 顶层：`gambleTalkCtx`(useRef) + `gambleNegotiation`(useState)
- import `settleNegotiation as gambleSettleNegotiation`
- `handleGambleTalk` 挂 ctx
- buildSysBase 后若 isTalk && gambleTalkCtx 追加 `<deal>` 规则
- `parseMainResponse` 抠 dealResult；流式 narrativeOnly 显示时剥 `<deal>`
- mvu 处理后：dealResult → settleNegotiation → 写 gambleNegotiation
- 挂载 GambleStoneScreen 传 `negotiation={gambleNegotiation}`

---

## 七、未完成 / 待办（2026-07-24 更新：主体已落地）

1. ~~缺温掌柜立绘~~ ✅ 已补齐（用户新供旗袍立绘，`bidders/full/温掌柜.png`）。**八张全齐。**
2. ~~落 React 正式组件~~ ✅ 已落地（2026-07-24）：`GambleStoneScreen.jsx` 已重写为**卡牌凹半圆围台**——
   - 立绘+frame_lux 分层合成（内窗实测 x19.9% y17.3% w60.2% h69.7%），不再用预合成 cards/
   - hover 放大1.42+rotateY180 翻背面信息面；点选放大居中+「接受报价/谈价」抉择
   - 石头目视定位坐独脚台（台 top33%、石 top1% w23%、pixelated）；背景按游戏时辰昼夜切
   - 动态卡数凹弧（rare/onlyWeapon 过滤后 3~8 张自适应）；气泡 bub_gold1 在卡下方
   - ⚠️ 3D 翻面两条血泪已写进组件注释：filter 不能放 preserve-3d 元素上；放大与翻转必须同元素同 transform 过渡
   - 组件调试台：`/debug-gamble.html`（mock 八人在场，不必进游戏走流程）
3. ~~改 `gambleStone.js` 竞价者名单~~ ✅ fushang→liruoyou、muming→suwan、xiaofan→caidan，
   另新增 **wen（温掌柜）boss 位**：必出、见裂不折、兜底价≥石头进价六成（「从不让人空手出门」落地）。
   npcPool 三分身同步换人（李若由/才旦与 residentNpcs 驻场同名不同据点，好感度按名合一）；
   residentNpcs 温掌柜已性转改写（温绾，短发金环黑蕾丝旗袍，苏宛的干姑母）。
   MudRPG 挂载过滤已加温掌柜。
4. ~~CHIBI_BY_NAME → CARD_BY_NAME~~ ✅ 改为 `PORTRAIT_BY_NAME` 读 `bidders/full/*.png` 无框立绘。
5. 旧 chibi 立绘（`bidders/chibi/`）与预合成 `cards/card_*.png` 赌桌均不再用，留作它用。
6. ~~开刀动画~~ ✅ 已落 React（2026-07-24 二轮）：§五规格全套 state 驱动——
   刀光(fx_cut_light 沿刀口角度扫过)→石震(gsShake)→碎末(12粒、颜色随品相：纯青绿/白米灰/杂褐 + fx_dust 尘团)
   →屏息→开口弹出(gsOpen 蒙版 scale0→1 弹性)→露肉过曝渐显(gsReveal)→裂纹蔓延(gsCrackG)
   →揭晓大字上浮飘散(涨·纯绿/平·米白/垮·土橙/裂!·红)，一套约1.45s，动画期间锁刀；
   报价用 useMemo 依赖 tick，延迟到揭晓才随新信息重骰（动画中不剧透新价）。
7. **相石（看皮）已接入**（原 §2.3 readSkinClue 一直没接 UI）：赌桌「相石·看皮」按钮 →
   readSkinClue 按悟性裁决线索（AI 读不到种水真相）→ 走 inspectItem 式轻量单发演相石口诀
   → 赌桌弹层显示 + 主日志留档 + 算1回合 + 公共小纸条；同一块石头缓存、重看免费（handleGambleInspect）。
8. **谈价挂载已减负**（借世界书蓝灯/绿灯思路，谈价轮重量条目全灭灯）：谈价这轮原走全量 talk 档
   （预设全文+在场全员lore+任务+认知隔离+远景/召回/重逢/信息域+20条历史+MVU 全套），现整体替换为
   轻量挂载：说书人文风+该竞价者人设（组件经 gambleTalkCtx.persona/scene 带入）+石头局面+<deal>
   结算规则+近8条对话，schema 缩成 {output,memory}。S2 convo/S3 小纸条/S4 账本照旧落，记忆链不断。
   行动日志「Prompt注入」级别显示「谈价·轻量」可核对。普通对话/行动完全不受影响。

---

## 八、关键坑（血泪，务必读）

- **卡牌"糊"的根因**：把小卡框 LANCZOS 放大数倍 → 像素画糊。**正解**：用大尺寸框（frame_lux）+ 立绘近原分辨率填入，界面里再 CSS 缩小（缩小不糊、放大才糊）。
- **抠图去假透明**：所有 AI 生成素材几乎都是**灰白棋盘格假透明**（alpha 全 255）。人物立绘抠图见 `docs/赌石完整制作方案_美术UI谈价立绘.md §G`（框范围+只取最大连通块，别全局抠、别碰框外白色）。桌子/框/背景可全局抠或边缘 flood。
- **封闭空当**（叉腰/脚间/桌腿间）边缘 flood 进不去，用"框定 + 只抠最大连通块"。
- **裂纹素材**按暗度抠（只留暗线），不是抠白底。
- **透视台不能用中点算法**定位石头，目视。
- 谈价 `<deal>` 标签务必在**所有显示路径**（流式/非流式/提取模式）都剥掉，别露给玩家。
