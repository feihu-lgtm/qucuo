// 入册界面的共用零件
// ============================================================================
// CardImportScreen / ReviewNpc / ReviewPlayer 三处共用。抽出来的理由很直接：
// 审改界面要按映射表覆盖全字段，NPC 那边十五项、玩家那边十二项，零件如果各写
// 一份，改一个输入框的样式要改三处。
//
// 视觉素材全部取自 public/stones/（原本给赌石玩法做的）。其中六档玉色
// jade_1_bai 到 jade_6_hong 正好对上品阶白绿蓝紫橙红，品阶徽记直接用玉石图。


// 按层拆到四个文件，这里只做中转导出——各处 import "./widgets.jsx" 的写法不用动。
export * from "./widgetsMeta.js";      // S/TIERS/KIND_META/SEVEN/BODY_*/selStyle
export * from "./widgetsChrome.jsx";   // barFrame/Bar/JadeTier/Step
export * from "./widgetsFields.jsx";   // StatRow/SevenDim/Src/TextField/Stat/Section/Note/Btn/Pills
export * from "./widgetsTerm.jsx";     // TERM_MONO/Terminal/TapSpan
