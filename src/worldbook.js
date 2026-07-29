// 世界书引擎（NPC 人设按场景动态注入）
// ------------------------------------------------------------------
// 借鉴姬侠传 worldbook-engine.js 的"名字触发式注入"思路，但结合曲措乡有结构化
// room.npcs 的优势，用三源触发，比纯文本匹配更准：
//   1. 在场：该 NPC 出现在当前 room.npcs 里（最强信号，系统确知谁在场）
//   2. 被提及：其名字/别名出现在玩家本轮输入里
//   3. 上轮提及：其名字/别名出现在上一轮引擎回复里
// 命中才把这个 NPC 的整段人设注入 system prompt，没命中的一个字都不发——
// 解决"每轮都把全部 NPC 的外貌锚点塞进 prompt"造成的 token 浪费与信息干扰。
//
// 人设数据来自预设的 npcLore 字段（见 presets/qucuo.js），保持"剧本内容集中在
// 预设里"的原则；本模块只负责匹配与拼装，不含任何硬编码人设。

// 从 npcLore 里挑出当前场景该注入的条目。
// npcLore: [{ name, aliases?: string[], entry: string }]
// ctx: { roomNpcNames?: string[], userInput?: string, lastReply?: string, includeLastReply?: boolean }
//
// includeLastReply（默认true）：是否让"上一轮AI回复文本"参与"被提及"判定。
// 这个开关的存在是因为实测复现了一个串场bug——玩家上一轮打了场切磋，战报里
// 提到了好几个人名（对手/围观者/路人），下一轮玩家哪怕只是纯粹"端详"一件
// 物品，这些人名照样会命中"被提及"、把完整人设怼进去，于是行脚僧、乞丐老七
// 这类跟"端详"毫不相干的人接连"插一脚"。真正需要"上一轮提到谁"这个信号的
// 场景，只有玩家紧接着追问"他是谁/他在哪"这种对话场景（NPC刚说"我那侄子
// 阿福在磨坊"，玩家追问阿福）——此时"上一轮提到"确实是唯一线索。而端详/
// 移动/战斗/结算这类跟对话无关的动作，不该被上一轮叙事的用词殃及，调用方
// 应传 includeLastReply:false，只留"在场"+"本轮输入自己提到"两条更可靠的信号。
export function matchNpcLore(npcLore, ctx = {}) {
  if (!Array.isArray(npcLore) || !npcLore.length) return [];
  const present = (ctx.roomNpcNames || []).filter(Boolean);
  const includeLastReply = ctx.includeLastReply !== false;
  const scanText = `${ctx.userInput || ""}${includeLastReply ? `\n${ctx.lastReply || ""}` : ""}`;

  const matched = [];
  for (const npc of npcLore) {
    const keys = [npc.name, ...(npc.aliases || [])].filter(Boolean);

    // 在场：room.npcs 里有名字/别名与该 NPC 对得上（双向 includes 容错，
    // 兼容 room 里写"鱼定村口的老猎户"而 key 是"老猎户"这类长短不一的情况）
    const inScene = present.some(rn => keys.some(k => rn === k || rn.includes(k) || k.includes(rn)));

    // 被提及：本轮输入（一定扫描）+ 上轮回复（仅 includeLastReply 时扫描）里出现名字/别名
    const mentioned = keys.some(k => scanText.includes(k));

    if (inScene || mentioned) {
      matched.push({ name: npc.name, entry: npc.entry, reason: inScene ? "在场" : "被提及", isWorld: !!npc.isWorld });
    }
  }
  return matched;
}

// ── 世界观总纲的绿灯分条（本轮新增）──────────────────────────────
// 上面 matchNpcLore 管的是"人"，这里管的是"事与物"：把 preset.scenario 那 2380 字
// 拆成 🔵蓝灯常驻 + 🟢绿灯条目，绿灯按酒馆的本义——**关键词触发**（见类脑 wiki
// 《什么是世界书》§2：以关键词触发内容，蟹堡王那个例子）。
//
// 但纯关键词有两个老毛病（见《酒馆略进阶功能指南》）：
//   ① 剧情要写某事、上文却没恰好出现关键词 → AI 缺资料，已读乱回；
//   ② 关键词反复出现 → 内容越滚越多，剧情推不动。
// 曲措乡有结构化状态（intent / 在场 / flags），所以这里走**双通道取并集**：
//   关键词命中（文本信号）  OR  状态命中（系统确知的强信号）→ 点灯。
// 这正是 matchNpcLore "三源触发比纯文本匹配更准"的同一思路，推广到世界观条目。
//
// keys   —— 绿灯关键词，扫描玩家本轮输入 + 上轮引擎回复（等同酒馆"扫描深度2"）
// scopes —— 状态通道：这些 scope 下无条件点灯（如移动轮必给拓扑，战斗轮必给掉落规则）
// head   —— 用于从 scenario 文本里认出这一段（段落起首匹配）
const SCENARIO_ENTRIES = [
  { head: /^拓扑连通关系/, scopes: ["move"],
    keys: ["鱼定村", "鱼定土司", "喇嘛庙", "白塔", "后山平台", "雪山派", "山洞", "顶峰",
           "天都镇", "大草甸", "玉泉寨", "贡措海", "锦官城", "怎么走", "路线", "在哪", "去哪"] },
  { head: /^契诃夫之枪/, scopes: [],
    keys: ["书信", "信物", "邀帖", "帖子", "赌石", "温掌柜", "身世", "来历", "无名",
           "巡逻队", "三日未归", "虎胆", "狼王", "独眼", "跑马会"] },
  // 具名人物：talk 轮常亮；结算轮若牵涉某人（送礼/拜师/成交）由调用方把该人名塞进
  // userInput 扫描源，这里靠关键词自然点亮，不必另开状态通道。
  { head: /^具名人物/, scopes: ["talk"],
    keys: ["梅朵", "老猎户", "呼延雪", "何雨谢", "才旦", "李若由", "行脚僧", "土司", "苏宛", "兰姐", "温掌柜", "巴桑", "丹增", "罗琦"] },
  { head: /^规则补充/, scopes: ["move"],
    keys: ["熊山", "大草甸", "狼曲", "黑风寨", "遭遇", "路上", "赶路", "山贼", "野兽"] },
  { head: /^装备与掉落规则/, scopes: ["combat"],
    keys: ["掉落", "战利品", "装备", "武器", "护甲", "饰品", "品质", "搜身", "尸体", "缴获"] },
];

// 按"关键词 OR 状态"给 scenario 分段点灯。认不出标题的段落一律保留（🔵蓝灯），
// 保证用户在设置面板里改过 scenario、或换自定义预设，都不会因这层分流丢内容。
// ctx: { scope, userInput, lastReply }
export function gateScenario(scenario, ctx = {}) {
  if (typeof scenario !== "string" || !scenario.trim()) return { text: scenario, lit: [], dark: [] };
  const scanText = `${ctx.userInput || ""}\n${ctx.lastReply || ""}`;
  const lit = [], dark = [];
  const kept = scenario.split(/\n\s*\n/).filter((b) => {
    const head = b.trimStart();
    const e = SCENARIO_ENTRIES.find((x) => x.head.test(head));
    if (!e) return true;                                   // 🔵 蓝灯：常驻
    const byScope = (e.scopes || []).includes(ctx.scope);  // 状态通道
    const hitKey = (e.keys || []).find((k) => scanText.includes(k)); // 关键词通道
    const name = head.slice(0, head.indexOf("\n") > 0 ? head.indexOf("\n") : 10).replace(/[（(：:].*$/, "");
    if (byScope || hitKey) { lit.push(`${name}${hitKey ? `⟨词:${hitKey}⟩` : "⟨态⟩"}`); return true; }
    dark.push(name);
    return false;
  });
  return { text: kept.join("\n\n"), lit, dark };
}

// 把匹配到的人设拼成注入 prompt 的文本块。没命中则返回空串（一个字不发）。
// matched 里每条都带 reason:"在场"|"被提及"——只有"在场"的人此刻真的站在这个
// 房间里，"被提及"只是玩家或上轮回复的文本里提到了这个名字（比如聊起某人、
// 某人托人捎话），系统据此认为"这个人的人设可能派得上用场"才注入，但这**不等于
// 他此刻站在这里**。之前两种一视同仁地拼进同一段【在场／相关人物设定】，AI 分不清
// "这人在我面前"和"这人只是被聊到"，容易把仅被提及的人物凭空写成真的登场
// （行脚僧明明在喇嘛庙歇脚，只因上轮对话提过一句，下一轮就被写到村口来）。
// 这里把两类分段展示、并在"被提及"段落上加一条硬性提示。
export function buildNpcLoreBlock(matched) {
  if (!matched || !matched.length) return "";
  // 先把非人条目分出去。入册的世界观条目（地理／势力／规矩／物件）跟人物共用同一
  // 套关键词点灯——那个判断对地理一样适用——但绝不能共用同一个注入外壳：下面两段
  // 的文案是专门针对人写的，"绝不能让他们凭空出现、开口说话"这种指令套在「锦官城」
  // 头上纯属噪音，甚至可能让说书人真把它当成一个人处理。
  // 实测确认过这个输出：一条地理条目落进"仅被提及的人物设定"段里。
  const world = matched.filter(m => m.isWorld);
  const people = matched.filter(m => !m.isWorld);
  const present = people.filter(m => m.reason === "在场");
  const mentioned = people.filter(m => m.reason !== "在场");
  let out = "";
  if (present.length) {
    out += `\n\n【此刻在场人物设定】（这些人真的站在这个场景里，此刻正对着玩家）\n${present.map(m => m.entry.trim()).join("\n")}`;
  }
  if (mentioned.length) {
    out += `\n\n【仅被提及、并不在场的人物设定】（这些人只是被聊到、被提起，此刻并不在这个场景里——你可以在对话/心理活动里自然提到他们，但绝不能让他们凭空出现在这个场景、开口说话或有任何实际登场的动作，除非玩家真的移动到他们所在之处）\n${mentioned.map(m => m.entry.trim()).join("\n")}`;
  }
  if (world.length) {
    out += `\n\n【相关地理与势力】（这些是本轮提到的地点、门派、规矩或物件，**不是人**，不会说话也不会登场。写到它们时按这份设定写，不要另编）\n${world.map(m => m.entry.trim()).join("\n")}`;
  }
  return out;
}
