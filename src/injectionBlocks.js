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
      { id: "length", name: "篇幅要求", kind: "dynamic", depth: 2,
        summary: "由 inputIntent.js 按本轮输入性质动态定字数(元问题一两句，战斗完整展开)。" },
      { id: "voice", name: "旁白语气(好感文风)", kind: "dynamic", depth: 3,
        summary: "narratorVoicePrompt() 按好感度调写作笔触浓淡——同一叙述者，不分裂人格。" },
      { id: "preset_scenario", name: "预设·剧本设定(scenario marker)", kind: "gated", depth: 4,
        summary: "世界观总纲，经 gateScenario 蓝绿灯裁剪：地理/地图铁律/好感规则常驻，拓扑路线/契诃夫之枪/装备掉落按关键词或 scope 点亮。" },
      { id: "preset_genrules", name: "预设·通用规则", kind: "static", depth: 5,
        summary: "不搜索不给隐藏物品/NPC不主动倒信息/战斗诚实/装备由玩家手动/品阶档位要配得上气度…(预设可编辑)" },
      { id: "preset_wenfeng", name: "预设·文体铁律", kind: "static", depth: 6,
        summary: "白话古文、章回说书人口吻、句句主谓宾齐全、禁冒号破折号、对话「」、引语\"\"、心理*斜体*、写作八条铁律(预设可编辑)" },
      { id: "npc_lore", name: "在场 NPC 人设注入", kind: "gated", depth: 7,
        summary: "只注入本轮在场者的人设(brief/fullBio/性情)，绿灯——无人则不挂。" },
      { id: "catalog", name: "曲措乡物件志", kind: "gated", depth: 8,
        summary: "全物品目录 describeCatalogForAI()。仅本轮可能发物时挂(拾取命中/战斗/创造模式)，寻常行动轮灭灯防诱导发物。" },
      { id: "isolation", name: "NPC 认知隔离(硬规则)", kind: "engine", depth: 9,
        summary: "为每个在场 NPC 划已知/可知/不可知信息域，甲知道的乙不能无端知道。move/settle 之外都挂。" },
      { id: "map_law", name: "地图铁律", kind: "engine", depth: 10,
        summary: "固定地图，不能造新据点/改出口，room.name 与 exits 系统强制覆盖，AI 只负责场景描述。" },
      { id: "schema", name: "输出 JSON schema + MVU", kind: "engine", depth: 11,
        summary: "完整 JSON(output/room/char/dao/delta) + 场上有人时附 <mvu> 变量块。scope 不同 schema 详略不同。" },
      { id: "user_ctx", name: "userContent·当前世界状态", kind: "dynamic", depth: 12,
        summary: "时间/主角/房间(内层)/出口/NPCs(含品阶身携)/地上物/HP/内外功/七维/背包/装备/武功/因果劫数/已触发事件/各类Note。" },
      { id: "user_recall", name: "userContent·远景+向量召回+久别重逢+信息域", kind: "dynamic", depth: 13,
        summary: "distantBlock 远景 + recallBlock 向量召回往事 + reunionBlock 久别重逢 + infoDomainBlock 信息域，均运行时生成。" },
      { id: "user_prose", name: "userContent·成文铁律(末尾=最强)", kind: "static", depth: 14,
        summary: "proseRule 成文铁律拼在 userContent 末尾——贴生成处、插入深度最强(等同酒馆 Depth 0)。" },
      { id: "nsfw_rules", name: "NSFW 写作规则(■模式)", kind: "engine", depth: 15,
        summary: "■模式开启时注入 PHI 最底部。性爱体位/性器官/粗俗直白叙述等写作规则，贴生成处=最强。" },
      { id: "gm_rule", name: "创造模式规则(⚡模式)", kind: "engine", depth: 16,
        summary: "状态出现\"⚡创造模式开启\"时玩家是神，一切请求无条件执行。注入 PHI 最底部，NSFW 之后。" },
    ],
  },

  talk: {
    label: "对话",
    desc: "跟房间 NPC 说话。主叙事的轻量档：砍物件志(对话不发物)，保留认知隔离(对白守信息域)，加 modeNote。scope=talk。",
    blocks: [
      { id: "engine_identity", name: "引擎身份声明", kind: "engine", depth: 1, summary: "同主叙事。" },
      { id: "length", name: "篇幅要求", kind: "dynamic", depth: 2, summary: "动态字数。" },
      { id: "voice", name: "旁白语气(好感文风)", kind: "dynamic", depth: 3, summary: "同主叙事。" },
      { id: "preset_scenario", name: "预设·剧本设定(scenario)", kind: "gated", depth: 4, summary: "gateScenario 蓝绿灯(scope=talk)。" },
      { id: "preset_genrules", name: "预设·通用规则", kind: "static", depth: 5, summary: "预设可编辑。" },
      { id: "preset_wenfeng", name: "预设·文体铁律", kind: "static", depth: 6, summary: "预设可编辑。" },
      { id: "npc_lore", name: "在场 NPC 人设注入", kind: "gated", depth: 7, summary: "只注入在场者人设。" },
      { id: "isolation", name: "NPC 认知隔离(硬规则)", kind: "engine", depth: 8, summary: "对话保留——对白必须守信息域。" },
      { id: "map_law", name: "地图铁律", kind: "engine", depth: 9, summary: "同主叙事。" },
      { id: "mode_note", name: "对话模式约束(modeNote)", kind: "engine", depth: 10,
        summary: "只对话不改状态：不移动/不战斗/room与delta留空；顶层加 respondedNpcs 列出本轮真正开口的在场NPC。" },
      { id: "schema", name: "输出 JSON schema + MVU", kind: "engine", depth: 11, summary: "对话档 schema。" },
      { id: "user_ctx", name: "userContent·当前世界状态", kind: "dynamic", depth: 12, summary: "全量 ctx，同主叙事。" },
      { id: "user_prose", name: "userContent·成文铁律(末尾)", kind: "static", depth: 13, summary: "成文铁律末尾。" },
      { id: "nsfw_rules", name: "NSFW 写作规则(■模式)", kind: "engine", depth: 14, summary: "同主叙事，PHI 最底部。" },
      { id: "gm_rule", name: "创造模式规则(⚡模式)", kind: "engine", depth: 15, summary: "同主叙事，PHI 最底部。" },
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
  { id: "settle", label: "结算叙事(其余)", intent: null, scope: "settle",
    note: "住店/求医/买卖/拜师/成交这类：系统已把数值结算完，AI 只把既定事实演成叙事，无裁量权。" },
  { id: "gift", label: "🎁 送礼", intent: "TALK_CASUAL", scope: "settle", settleKind: "gift",
    note: "送礼走 settle 结算档 + settleKind:\"gift\" 专属铁律——系统已扣物品，AI/提取层必须把这一轮好感度判成正向，且按礼物品阶/描述给出有依据的幅度，不接受推辞/拒收类写法。" },
  { id: "gm", label: "创造模式 ⚡", intent: null, scope: "full", gm: true,
    note: "玩家是神。强制走全量档，物件志与 MVU 强制挂（要能凭空发物、设变量）。" },
  { id: "whisper", label: "旁白私聊", intent: null, scope: "whisper",
    note: "独立一套 sys，完全不走 buildSysBase。不发 JSON、不守信息域、靠好感度调语气。" },
];

// 某一块在某个动作下亮不亮。灭了要给出原因——这个面板的价值一半在"为什么没注入"。
// 判据抄自 buildSysBase 的 wantCatalog / wantIsolation / wantMvu 与 schema 三元链。
// mode: "single"(单调用，主模型一次产出JSON+MVU) | "dual"(双调用，主模型只写散文，
// 状态判定转交 extractionEngine.js 的提取层)——这两种模式下同一个动作分类喂给AI的
// 东西结构完全不同（尤其送礼场景：单调用靠 buildSysBase 的 isSettle 分支产铁律+MVU，
// 双调用靠 narrativeOnly 分支的铁律管住主叙事文风、再靠 extractionEngine.js 的
// GIFT 专属 spec 管住好感度判定），面板必须分开展示，不能用一套块清单硬套两种模式。
export function blocksForAction(actionId, mode = "single") {
  const view = ACTION_VIEWS.find(v => v.id === actionId) || ACTION_VIEWS[0];
  if (view.scope === "whisper") {
    return INJECTION_PATHS.whisper.blocks.map(b => ({ ...b, lit: true, off: "" }));
  }

  // 双调用模式：主模型只出散文，不产JSON/MVU/schema，这几块在双调用下从结构上就
  // 不存在（narrativeOnly分支直接跳过它们），此时不该沿用单调用那份 act.blocks
  // 硬把 schema/isolation 标成"灭灯"——那会让人误以为"这局本可以有MVU只是被灭了"，
  // 而事实是双调用架构下主叙事这一步压根没有MVU这个环节，好感度判定整体挪到了
  // 提取层（另一次独立的AI调用，见 extractionEngine.js）。所以双调用模式返回一份
  // 结构不同的清单：保留叙事相关的块，砍掉JSON/MVU相关块，额外加一块"提取层调用"
  // 说明这一轮状态判定实际去了哪。
  if (mode === "dual") {
    const dualBase = (view.isTalk ? INJECTION_PATHS.talk.blocks : INJECTION_PATHS.act.blocks)
      .filter(b => !["schema", "isolation"].includes(b.id)); // 双调用主叙事不产JSON/MVU，这两块结构上不存在
    const blocks = dualBase.map(b => {
      let lit = true, off = "";
      if (b.id === "catalog") {
        lit = false; off = "双调用主叙事只写散文，物件志(发物判定)在提取层处理，这一步不需要";
      }
      return { ...b, lit, off };
    });
    // 追加"送礼世界观铁律(双调用版)"块——对应 buildSysBase 的 narrativeOnly 分支里
    // settleKind==="gift" 那段，只在送礼场景展示
    if (view.settleKind === "gift") {
      blocks.push({
        id: "gift_narrative_law", name: "送礼世界观铁律(管住主叙事文风)", kind: "engine", depth: 90,
        summary: "narrativeOnly分支专属：强制主叙事把这一轮写成对方欣然收下，不许写推辞/质疑/婉拒——防止AI把送礼写成拒收剧情。",
        lit: true, off: "",
      });
    }
    blocks.push({
      id: "extraction_call", name: "→ 提取层调用(独立的第二次AI调用)", kind: "dynamic", depth: 91,
      summary: view.settleKind === "gift"
        ? "本轮好感度判定实际发生在这里，不在主叙事里。extractionEngine.js 命中 settleKind:\"gift\" 后切到 GIFT 专属spec：不做\"读心\"式判断，直接钉死\"好感度只能上升、不得为0或负数\"，并把礼物品阶/类别/描述喂给提取模型做幅度参考。"
        : "主叙事写完散文后，另发一次独立AI调用（可指定更小/更快的模型），按当前意图对应的 EXTRACTION_SPECS 从散文里提取状态变化(好感度/物品/HP等)。",
      lit: true, off: "",
    });
    return blocks;
  }

  const base = view.isTalk ? INJECTION_PATHS.talk.blocks : INJECTION_PATHS.act.blocks;
  const { scope, gm } = view;

  const blocks = base.map(b => {
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
    // 送礼场景：schema块要特别说明这里内嵌了送礼铁律+MVU强制正向指令
    if (b.id === "schema" && view.settleKind === "gift") {
      off = ""; lit = true;
    }
    return { ...b, lit, off };
  });

  // 单调用模式下，送礼场景把"送礼世界观铁律"从schema块里单独拆一块展示，
  // 对应 buildSysBase 的 isSettle 分支里 settleKind==="gift" 那段（品阶/描述/
  // 建议幅度都在这里），不必展开整个schema字符串去找这段话。
  if (view.settleKind === "gift") {
    const schemaIdx = blocks.findIndex(b => b.id === "schema");
    const giftBlock = {
      id: "gift_settle_law", name: "送礼世界观铁律(单调用·管住MVU好感判定)", kind: "engine", depth: 13.5,
      summary: "buildSysBase 的 isSettle+settleKind:\"gift\" 分支：强制本轮必须输出正向 <mvu> 好感度指令(不得为0或负数)，并把礼物的品阶/类别/描述摆给AI看，建议幅度按六品阶区间(白2~4/绿4~6/蓝6~9/紫9~12/橙11~14/红13~15)给出参考，取代泛泛的\"如果好感有变化\"式提示。",
      lit: true, off: "",
    };
    if (schemaIdx >= 0) blocks.splice(schemaIdx, 0, giftBlock);
    else blocks.push(giftBlock);
  }

  return blocks;
}

// 块 → 真实原文。静态块直接给字（与 buildSysBase 共用 enginePrompts.js 那份），
// 动态块给不出固定文本，返回 null，由面板显示模板说明 + 「拉取目前」按钮。
export const STATIC_TEXT_KEYS = {
  engine_identity: "ENGINE_IDENTITY",
  gm_rule: "GM_RULE",
  isolation: "ISOLATION",
  map_law: "MAP_LAW",
};

// schema 块按动作走哪一份
export function schemaKeyFor(view) {
  if (view.scope === "settle") return "SCHEMA_SETTLE";
  if (view.scope === "move") return "SCHEMA_MOVE";
  return "SCHEMA_FULL";
}

// ============================================================================
// 送礼铁律示例文本 —— 用一件示例礼物(青锋剑·绿档)演示实际渲染出的prompt片段，
// 供预设面板"送礼"分类在没有拉取当前局真值时也能看到具体样例，而不是只有一句
// summary说明。跟 MudRPG.jsx buildSysBase 与 extractionEngine.js EXTRACTION_SPECS.GIFT
// 里的真实拼装逻辑保持同构，仅供展示用途，不参与实际游戏逻辑。
// ============================================================================
const GIFT_EXAMPLE = { itemName: "无主的青锋剑", quality: "绿", categoryLabel: "武器",
  desc: "村口土里半掩着的一把青锋剑，剑身还算齐整，不知是哪位过路侠客遗落的。",
  range: [4, 6], suggestedDelta: 5 };
const GIFT_EXAMPLE_NPC = "才旦";

export function giftSettleLawExample() {
  const g = GIFT_EXAMPLE, npc = GIFT_EXAMPLE_NPC;
  return `【送礼世界观铁律】曲措乡这方水土人情厚重，收礼从不是件让人为难或起疑的事——不管东西贵重与否，只要是当面郑重递到手上的心意，对方都会真心生出一份惊喜与暖意；纵是相熟不深，出于最起码的礼貌、江湖上讲究的信义，或纯是那一刻的好心情，也断没有板起脸不领情、把这份情谊晾在一边的道理。所以这一轮${npc}收下「${g.itemName}」时，对玩家的观感只能是变好、绝不会不变或变差——下面这条 <mvu> 块本轮必须给出，且必须是正向增量。
这件礼物的实际来历（好感幅度请依此掂量分量，越贵重、越用心，情谊越重）：品阶【${g.quality}】，类别「${g.categoryLabel}」。物件描述：${g.desc}

依上面这件礼物的品阶与来历，本轮好感度增量建议落在 +${g.range[0]}~+${g.range[1]} 这个区间内自行斟酌（品阶越高、描述越贵重可取区间上沿，寻常物件取下沿），不得为 0 或负数。示例写法：
_.add('角色.${npc}.好感度', ${g.suggestedDelta});

（以上以「${g.itemName}」（绿档）赠${npc}为例演示，实际游戏中礼物名称/品阶/描述/NPC均按当次送礼真实替换。）`;
}

export function giftNarrativeLawExample() {
  const g = GIFT_EXAMPLE, npc = GIFT_EXAMPLE_NPC;
  return `【送礼世界观铁律】曲措乡这方水土人情厚重，收礼从不是件让人为难或起疑的事——不管东西贵重与否，只要是当面郑重递到手上的心意，对方都会真心生出一份惊喜与暖意；纵是相熟不深，出于最起码的礼貌、江湖上讲究的信义，或纯是那一刻的好心情，也断没有板起脸不领情、把这份情谊晾在一边的道理。这一轮${npc}面对「${g.itemName}」（${g.desc}），务必写成她欣然收下、态度转暖，不许写成推辞、质疑来意或婉拒不受——这是本轮叙事唯一的走向，不接受其他写法。

（以上以「${g.itemName}」赠${npc}为例演示。这段只管住"主叙事怎么写"，本身不产生MVU——双调用模式下好感度判定另在下面「提取层调用」那一块完成。）`;
}

export function giftExtractionSpecExample() {
  const g = GIFT_EXAMPLE, npc = GIFT_EXAMPLE_NPC;
  return `${npc}刚收到玩家赠送的礼物：「${g.itemName}」，品阶【${g.quality}】，类别「${g.categoryLabel}」。物件描述：${g.desc}

叙事内容：
（此处是主叙事这一步实际写出的散文正文，此处从略）

【铁律】不管叙事写得含蓄还是热络，送礼这一轮${npc}对玩家的好感度只能上升、不得为 0 或负数——按这件礼物的品阶与来历，建议幅度落在 +${g.range[0]}~+${g.range[1]} 之间（品阶越高、描述越贵重取上沿，寻常物件取下沿）。物品交换写进 delta（礼物已由系统扣除，此处不需要重复处理 items_rm）。
输出 JSON（mvu 字段必须是一条正向 _.add 好感度指令）：
{"mvu":"_.add('角色.${npc}.好感度', ${g.suggestedDelta});\\n","delta":{"items_add":[],"flags_add":[]}}

（这是 extractionEngine.js 里 EXTRACTION_SPECS.GIFT 的真实模板，只在 settleKind:"gift" 命中时替代通用的 TALK_CASUAL 提取逻辑——不做"从叙事读心"式判断，直接钉死好感度必须为正。）`;
}
