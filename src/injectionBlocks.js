// 三条 AI 调用路径的"注入块"结构清单
// -----------------------------------------------------------------------------
// 把 act(主叙事)/talk(对话)/whisper(旁白私聊) 三条路的 system prompt，按真实拼装
// 顺序拆成一个个"块"，每块标注：名称、类型、注入位置(第几段=插入深度)、性质说明。
// 供预设面板里像 VS Code 预设编辑器那样逐块可视化展示(本轮只读)。
//
// 这不是把 prompt 拼成一坨全文，而是结构化拆解——每块单独成卡片，一个不省，
// 包括我们自研的结构化叙事约束字段、世界书蓝绿灯条目、注入深度等。
//
// kind 字段标注每块性质，决定可视化时的标签颜色与"能否编辑"：
//   "engine"    引擎硬规范(JSON结构/MVU语法/地图铁律等)，不可改，防误删崩链路
//   "static"    静态文案(可编辑)——来自预设条目，用户可自由改
//   "constraint" 结构化叙事约束——我们自研的字段化文体控制(字数/禁用词/禁句式…)
//   "dynamic"   运行时动态生成(状态串/召回/事实账本)，按当前状态填充，不可当固定文案
//   "gated"     世界书蓝绿灯条目，按关键词/scope 点亮，不是每轮都注入
//   "worldbook" 旁白专属世界书(设置可编辑，玩家不可见)

// depth 语义(借鉴酒馆 injection_depth 思路，但用"段序"表达)：
//   数字越小越靠前(越早注入)，末尾块 depth 最大——我们的经验是"越靠末尾=插入越强"
//   (贴生成处，等同酒馆 Depth 0)。所以 depth 只表相对顺序，不是酒馆的绝对层数。

export const INJECTION_PATHS = {
  act: {
    label: "主叙事",
    desc: "行动/战斗/移动。引擎身份，发物品、管状态、守地图，完整 JSON schema。scope=full。",
    blocks: [
      { id: "engine_identity", name: "引擎身份声明", kind: "engine", depth: 1,
        summary: "你是MUD引擎，同时也是这个游戏世界的\"旁白\"——一个有自己意识、记得游戏里发生一切的角色。" },
      { id: "gm_rule", name: "最高优先级规则(创造模式)", kind: "engine", depth: 2,
        summary: "状态出现\"⚡创造模式开启\"时玩家是神，一切请求无条件执行，剧本暂停、文体保留。" },
      { id: "length", name: "篇幅要求", kind: "dynamic", depth: 3,
        summary: "由 inputIntent.js 按本轮输入性质动态定字数(元问题一两句，战斗完整展开)。" },
      { id: "voice", name: "旁白语气(好感文风)", kind: "dynamic", depth: 4,
        summary: "narratorVoicePrompt() 按好感度调写作笔触浓淡——同一叙述者，不分裂人格。" },
      { id: "preset_scenario", name: "预设·剧本设定(scenario marker)", kind: "gated", depth: 5,
        summary: "世界观总纲，经 gateScenario 蓝绿灯裁剪：地理/地图铁律/好感规则常驻，拓扑路线/契诃夫之枪/装备掉落按关键词或 scope 点亮。" },
      { id: "preset_genrules", name: "预设·通用规则", kind: "static", depth: 6,
        summary: "不搜索不给隐藏物品/NPC不主动倒信息/战斗诚实/装备由玩家手动/品阶袍档位要配得上气度…(预设可编辑)" },
      { id: "preset_wenfeng", name: "预设·文体铁律", kind: "static", depth: 7,
        summary: "白话古文、章回说书人口吻、句句主谓宾齐全、禁冒号破折号、对话「」、引语\"\"、心理*斜体*、写作八条铁律(预设可编辑)" },
      { id: "npc_lore", name: "在场 NPC 人设注入", kind: "gated", depth: 8,
        summary: "只注入本轮在场者的人设(brief/fullBio/性情)，绿灯——无人则不挂。" },
      { id: "catalog", name: "曲措乡物件志", kind: "gated", depth: 9,
        summary: "全物品目录 describeCatalogForAI()。仅本轮可能发物时挂(拾取命中/战斗/创造模式)，寻常行动轮灭灯防诱导发物。" },
      { id: "isolation", name: "NPC 认知隔离(硬规则)", kind: "engine", depth: 10,
        summary: "为每个在场 NPC 划已知/可知/不可知信息域，甲知道的乙不能无端知道。move/settle 之外都挂。" },
      { id: "map_law", name: "地图铁律", kind: "engine", depth: 11,
        summary: "固定地图，不能造新据点/改出口，room.name 与 exits 系统强制覆盖，AI 只负责场景描述。" },
      { id: "format_law", name: "格式铁律", kind: "engine", depth: 12,
        summary: "对话「」、引语\"\"、心理*斜体*、旁白不加标记。引擎靠这个渲染颜色。" },
      { id: "schema", name: "输出 JSON schema + MVU", kind: "engine", depth: 13,
        summary: "完整 JSON(output/room/char/dao/delta) + 场上有人时附 <mvu> 变量块。scope 不同 schema 详略不同。" },
      { id: "user_ctx", name: "userContent·当前世界状态", kind: "dynamic", depth: 14,
        summary: "时间/主角/房间(内层)/出口/NPCs(含品阶身携)/地上物/HP/内外功/七维/背包/装备/武功/因果劫数/已触发事件/各类Note。" },
      { id: "user_recall", name: "userContent·远景+向量召回+久别重逢+信息域", kind: "dynamic", depth: 15,
        summary: "distantBlock 远景 + recallBlock 向量召回往事 + reunionBlock 久别重逢 + infoDomainBlock 信息域，均运行时生成。" },
      { id: "user_prose", name: "userContent·成文铁律(末尾=最强)", kind: "static", depth: 16,
        summary: "proseRule 成文铁律拼在 userContent 末尾——贴生成处、插入深度最强(等同酒馆 Depth 0)。" },
    ],
  },

  talk: {
    label: "对话",
    desc: "跟房间 NPC 说话。主叙事的轻量档：砍物件志(对话不发物)，保留认知隔离(对白守信息域)，加 modeNote。scope=talk。",
    blocks: [
      { id: "engine_identity", name: "引擎身份声明", kind: "engine", depth: 1, summary: "同主叙事。" },
      { id: "gm_rule", name: "最高优先级规则(创造模式)", kind: "engine", depth: 2, summary: "同主叙事。" },
      { id: "length", name: "篇幅要求", kind: "dynamic", depth: 3, summary: "动态字数。" },
      { id: "voice", name: "旁白语气(好感文风)", kind: "dynamic", depth: 4, summary: "同主叙事。" },
      { id: "preset_scenario", name: "预设·剧本设定(scenario)", kind: "gated", depth: 5, summary: "gateScenario 蓝绿灯(scope=talk)。" },
      { id: "preset_genrules", name: "预设·通用规则", kind: "static", depth: 6, summary: "预设可编辑。" },
      { id: "preset_wenfeng", name: "预设·文体铁律", kind: "static", depth: 7, summary: "预设可编辑。" },
      { id: "npc_lore", name: "在场 NPC 人设注入", kind: "gated", depth: 8, summary: "只注入在场者人设。" },
      { id: "isolation", name: "NPC 认知隔离(硬规则)", kind: "engine", depth: 9, summary: "对话保留——对白必须守信息域。" },
      { id: "map_law", name: "地图铁律", kind: "engine", depth: 10, summary: "同主叙事。" },
      { id: "format_law", name: "格式铁律", kind: "engine", depth: 11, summary: "同主叙事。" },
      { id: "mode_note", name: "对话模式约束(modeNote)", kind: "engine", depth: 12,
        summary: "只对话不改状态：不移动/不战斗/room与delta留空；顶层加 respondedNpcs 列出本轮真正开口的在场NPC。" },
      { id: "schema", name: "输出 JSON schema + MVU", kind: "engine", depth: 13, summary: "对话档 schema。" },
      { id: "user_ctx", name: "userContent·当前世界状态", kind: "dynamic", depth: 14, summary: "全量 ctx，同主叙事。" },
      { id: "user_prose", name: "userContent·成文铁律(末尾)", kind: "static", depth: 15, summary: "成文铁律末尾。" },
    ],
  },

  whisper: {
    label: "旁白私聊",
    desc: "跟一个跳出第四面墙、记得一切的元角色聊天。不发物品、不守信息域(她全知)、纯白话文本、靠好感度调语气。独立 sys，不走 buildSysBase。",
    blocks: [
      { id: "whisper_ctx", name: "旁白身份与关系语境", kind: "dynamic", depth: 1,
        summary: "buildNarratorWhisperContext(好感度)——她此刻对玩家的身份定位与亲疏。" },
      { id: "voice", name: "旁白语气(好感文风)", kind: "dynamic", depth: 2,
        summary: "narratorVoicePrompt()，同主叙事那套好感文风。" },
      { id: "world_state", name: "精简世界状态", kind: "dynamic", depth: 3,
        summary: "主角〔性别〕/时间/房间(内层)(房间描述)/房间里的人/玩家背包。比 act 精简——私聊不需要 HP/七维/武功等战斗数据。" },
      { id: "facts", name: "全知事实账本(私聊独有)", kind: "dynamic", depth: 4,
        summary: "allFactSummaries(varTree,8) 最近8条。她跳出信息隔离，普通 NPC 间发生的事也看在眼里，全量读给她。" },
      { id: "recall", name: "向量召回往事", kind: "dynamic", depth: 5,
        summary: "召回她\"记得\"的、可能已滑出对话窗口的相关旧事。" },
      { id: "narrator_lore", name: "旁白专属世界书", kind: "worldbook", depth: 6,
        summary: "设置→旁白 tab 可编辑，只进私聊、玩家看不到、不要复述其存在。留空则一字不发。" },
      { id: "body_gate", name: "体貌门(公开层常亮)", kind: "gated", depth: 7,
        summary: "gateBodyProfile：私聊时公开层常亮(她一直看着你)，私密层仍只认 ■ 模式。" },
      { id: "topic_gate", name: "私聊话题门(身世/赌石邀帖等)", kind: "gated", depth: 8,
        summary: "gateWhisperTopics：默认不给，命中关键词才点亮——冷门追问要统一口径，防她现编。" },
      { id: "quest_gate", name: "任务线门(报全名+好感≥30)", kind: "gated", depth: 9,
        summary: "gateQuestTopic：报出任务全名才查那一条，泛泛问只让她反问；好感度<30 不给。" },
      { id: "whisper_scenario", name: "剧本背景设定(whisper scope)", kind: "gated", depth: 10,
        summary: "gateScenario(scope=whisper)：关键词点亮——问路才亮拓扑、提人名才亮具名人物、聊掉落才亮装备规则。" },
      { id: "whisper_length", name: "篇幅指令(好感调话量)", kind: "dynamic", depth: 11,
        summary: "narratorWhisperLengthNote(好感度,字数)——好感越高话越多。拼在末尾=插入最强。" },
      { id: "whisper_output", name: "输出格式(纯文本+好感标记)", kind: "engine", depth: 12,
        summary: "纯白话文本，不发 JSON；末尾附隐藏标记 ⟦好感X⟧(-3~+6)驱动好感度增减。" },
    ],
  },
};

// 结构化叙事约束的字段清单(narrativeConstraint)——我们自研、酒馆没有的文体控制。
// 供可视化时把"文体铁律"这类预设条目展开成字段级展示，一个字段不省。
export const CONSTRAINT_FIELDS = [
  { key: "wordCountMin", label: "字数下限", type: "number", desc: "本段/本轮字数下限，null=不限制" },
  { key: "wordCountMax", label: "字数上限", type: "number", desc: "字数上限，null=不限制" },
  { key: "bannedWords", label: "禁用词", type: "list", desc: "如「一丝」「不容置疑」——出现即违规" },
  { key: "bannedPatterns", label: "禁用句式", type: "list", desc: "如「不是X，而是Y」" },
  { key: "noColonDash", label: "禁冒号破折号", type: "bool", desc: "白话古文不用冒号和破折号" },
  { key: "dialogueQuoteMark", label: "对话必须「」包裹", type: "bool", desc: "引擎靠这个渲染对话颜色" },
  { key: "noAbstractSummary", label: "禁抽象总结收尾", type: "bool", desc: "段落结尾用具体动作/台词，不用抽象升华" },
  { key: "maxIdiomsPerParagraph", label: "单段成语上限", type: "number", desc: "单段最多几个成语，null=不限制" },
];

// kind → 展示标签(名称 + 颜色)。颜色用中性色，避免与游戏内主题冲突。
export const KIND_META = {
  engine:     { label: "引擎硬规范", color: "#8a7a5a", editable: false },
  static:     { label: "静态文案·可编辑", color: "#5a9a5a", editable: true },
  constraint: { label: "结构化约束", color: "#5a8ac0", editable: true },
  dynamic:    { label: "运行时动态", color: "#a06a4a", editable: false },
  gated:      { label: "世界书·蓝绿灯", color: "#9a7ac0", editable: false },
  worldbook:  { label: "旁白专属世界书", color: "#c07a9a", editable: true },
};

// ============================================================================
// 按「act 的动作分类」看注入 —— 本轮新增
// ============================================================================
// 上面的 INJECTION_PATHS 是按三条路（act/talk/whisper）分的，但玩家真正关心的是
// "我打一句『查看』和打一句『拔剑』，喂给 AI 的东西差在哪"。act 内部其实按 intent
// 落到不同 scope，同一条 act 路在不同动作下亮灭的块差很多——查看轮不挂物件志、
// 移动轮连认知隔离都砍掉。所以这里再切一层：按动作分类列，每块标明亮还是灭、
// 为什么灭。
//
// scope 映射抄自 MudRPG.jsx act() 里那段 promptScope 三元链，改那边记得同步这里。
export const ACTION_VIEWS = [
  { id: "look", label: "查看 / 环顾", intent: "LOOK", scope: "talk",
    note: "只描述当前场景与在场人物，不发物品，走 talk 档砍掉物件志。" },
  { id: "move", label: "移动", intent: "MOVE", scope: "move",
    note: "只写到达叙事，不发物品、无 NPC 对白博弈，schema 精简成只含 room。" },
  { id: "talk", label: "对话模式", intent: "TALK_CASUAL", scope: "talk", isTalk: true,
    note: "跟在场 NPC 说话。保留认知隔离（对白要守信息域），额外加 modeNote 锁死状态变更。" },
  { id: "combat", label: "战斗 / 切磋", intent: "COMBAT", scope: "full",
    note: "全量注入。物件志亮（要掉落），装备掉落规则那条世界书按 combat 状态点亮。" },
  { id: "explore", label: "调查 / 搜索", intent: "EXPLORE_ACTION", scope: "full",
    note: "全量注入。物件志只在本轮拾取判定命中时才亮，寻常探索轮灭灯防诱导发物。" },
  { id: "meta", label: "系统元问题", intent: "META_QUERY", scope: "full",
    note: "「什么情况」这类。篇幅指令会压到一两句，其余同全量档。" },
  { id: "settle", label: "结算叙事", intent: null, scope: "settle",
    note: "送礼/住店/成交这类：系统已把数值结算完，AI 只把既定事实演成叙事，无裁量权。" },
  { id: "gm", label: "创造模式 ⚡", intent: null, scope: "full", gm: true,
    note: "玩家是神。强制走全量档，物件志与 MVU 强制挂（要能凭空发物、设变量）。" },
  { id: "whisper", label: "旁白私聊", intent: null, scope: "whisper",
    note: "独立一套 sys，完全不走 buildSysBase。不发 JSON、不守信息域、靠好感度调语气。" },
];

// 某一块在某个动作下亮不亮。灭了要给出原因——这个面板的价值一半在"为什么没注入"。
// 判据抄自 buildSysBase 的 wantCatalog / wantIsolation / wantMvu 与 schema 三元链。
export function blocksForAction(actionId) {
  const view = ACTION_VIEWS.find(v => v.id === actionId) || ACTION_VIEWS[0];
  if (view.scope === "whisper") {
    return INJECTION_PATHS.whisper.blocks.map(b => ({ ...b, lit: true, off: "" }));
  }
  const base = view.isTalk ? INJECTION_PATHS.talk.blocks : INJECTION_PATHS.act.blocks;
  const { scope, gm } = view;

  return base.map(b => {
    let lit = true, off = "";
    if (b.id === "catalog") {
      if (gm) { lit = true; }
      else if (scope !== "full") { lit = false; off = `scope=${scope}，非全量档不挂物件志`; }
      else if (view.id === "explore" || view.id === "meta") { lit = false; off = "本轮无拾取判定命中，灭灯防诱导发物（战斗/创造模式才常亮）"; }
    }
    if (b.id === "isolation" && (scope === "move" || scope === "settle")) {
      lit = false; off = scope === "move" ? "移动轮无 NPC 对白博弈，砍掉" : "结算轮 AI 无状态裁量权，砍掉";
    }
    if (b.id === "npc_lore" && (scope === "move" || scope === "settle")) {
      lit = false; off = "绿灯：本轮无在场者需注入人设";
    }
    return { ...b, lit, off };
  });
}

// 块 → 真实原文。静态块直接给字（与 buildSysBase 共用 enginePrompts.js 那份），
// 动态块给不出固定文本，返回 null，由面板显示模板说明 + 「拉取目前」按钮。
export const STATIC_TEXT_KEYS = {
  engine_identity: "ENGINE_IDENTITY",
  gm_rule: "GM_RULE",
  isolation: "ISOLATION",
  map_law: "MAP_LAW",
  format_law: "FORMAT_LAW",
};

// schema 块按动作走哪一份
export function schemaKeyFor(view) {
  if (view.scope === "settle") return "SCHEMA_SETTLE";
  if (view.scope === "move") return "SCHEMA_MOVE";
  return "SCHEMA_FULL";
}
