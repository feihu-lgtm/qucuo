// 体貌信息（主角的身体档案）
// ============================================================================
// 定位：这是"主角长什么样"的唯一数据源。此前 AI 手上只有名字、性别和七维数字，
// 写到"他伸手""她抬头"这类具体动作时全靠现编，同一个人这轮是精瘦少年、下轮
// 变成魁梧大汉。玩家在面板里写一次，之后动作描写、NSFW、旁白私聊都吃同一份。
//
// 【为什么要分层点灯】参考 char_card_1 的 <UserInfo> 写法：每个属性给「定义 +
// 当前描述」，且只发当前命中的那一档，不把整张表倒给模型。这里更进一步——体貌
// 分两层，按场合分别点灯：
//   · 公开层（PUBLIC）——身高体型这类外人一眼可见的。战斗/对话/查看这类近距离
//     互动轮亮，赶路/结算轮灭（没人看你长什么样）。旁白私聊常亮（她一直看着你）。
//   · 私密层（INTIMATE）——体味、疤痕、敏感处、癖好这类。**只在 ■ 模式开启时亮**，
//     这是硬条件，不受关键词或场合影响。关着就一个字不发。
// 灭灯不是省事，是防串味：赶路轮塞一段私处描写，模型真的会往那个方向写。
// ============================================================================

export const BODY_LAYER = { PUBLIC: "public", INTIMATE: "intimate" };

// 字段表。label 是面板里的标题，hint 是输入框占位提示（同时也是给玩家的写法示范），
// def 是发给模型时附在字段名后的「定义」——照搬参考卡的做法，让模型知道这一栏
// 到底在描述什么，而不是只丢一个名词过去。
export const BODY_FIELDS = [
  { key: "height",   label: "身量",     layer: BODY_LAYER.PUBLIC,
    def: "身高与整体比例，别人第一眼的高矮印象",
    hint: "七尺出头，比寻常汉子高半个头，肩宽腿长" },
  { key: "build",    label: "体型",     layer: BODY_LAYER.PUBLIC,
    def: "肌肉、骨架与胖瘦，决定动作起来是灵便还是沉稳",
    hint: "常年赶路练出来的精瘦，肩背有肉但不壮，腰腹紧" },
  { key: "face",     label: "面容",     layer: BODY_LAYER.PUBLIC,
    def: "五官轮廓与神情底色，别人记得住的那几笔",
    hint: "眉压得低，眼尾偏长，笑起来右边有个浅酒窝" },
  { key: "skin",     label: "肤色",     layer: BODY_LAYER.PUBLIC,
    def: "肤色深浅与质感，含晒痕、冻疮这类长期痕迹",
    hint: "高原晒出来的蜜色，颧骨两侧有淡淡的红" },
  { key: "hair",     label: "发式",     layer: BODY_LAYER.PUBLIC,
    def: "头发的长度、束法与颜色",
    hint: "半长，用一根旧牛皮绳随手扎在脑后，鬓角碎发压不住" },
  { key: "voice",    label: "声音",     layer: BODY_LAYER.PUBLIC,
    def: "音色、语速与说话的习惯口吻",
    hint: "偏低，说话慢，尾音会不自觉往下沉" },
  { key: "clothing", label: "惯常穿着", layer: BODY_LAYER.PUBLIC,
    def: "日常衣物的形制、新旧与穿法习惯",
    hint: "深青短打，袖口挽到小臂，腰带上永远别着那张邀帖" },

  { key: "scars",    label: "疤痕印记", layer: BODY_LAYER.INTIMATE,
    def: "衣物遮住的伤疤、胎记、刺青，以及它们的来历",
    hint: "左肋一道旧刀疤，是在锦官城挨的" },
  { key: "scent",    label: "体味",     layer: BODY_LAYER.INTIMATE,
    def: "凑近了才闻得到的气息",
    hint: "汗味里混着松脂和一点铁锈味" },
  { key: "intimate", label: "身体细节", layer: BODY_LAYER.INTIMATE,
    def: "衣物之下的身体状态与尺寸细节",
    hint: "" },
  { key: "sensitive", label: "敏感处",  layer: BODY_LAYER.INTIMATE,
    def: "被碰到会有明显反应的部位，以及反应是什么样",
    hint: "后颈、腰侧" },
  { key: "habit",    label: "习惯癖好", layer: BODY_LAYER.INTIMATE,
    def: "亲密时的倾向、忌讳与下意识的小动作",
    hint: "" },
];

export const PUBLIC_FIELDS = BODY_FIELDS.filter(f => f.layer === BODY_LAYER.PUBLIC);
export const INTIMATE_FIELDS = BODY_FIELDS.filter(f => f.layer === BODY_LAYER.INTIMATE);

export const emptyBodyProfile = () =>
  BODY_FIELDS.reduce((acc, f) => { acc[f.key] = ""; return acc; }, {});

// 玩家到底填了多少——面板上显示进度，也用来决定要不要提示"还没写"。
export function bodyProfileFilled(profile) {
  if (!profile) return { public: 0, intimate: 0, total: 0 };
  const cnt = (fields) => fields.filter(f => (profile[f.key] || "").trim()).length;
  return { public: cnt(PUBLIC_FIELDS), intimate: cnt(INTIMATE_FIELDS), total: cnt(BODY_FIELDS) };
}

// 面板里的折叠预览：不完整显示，只露前 n 个字，剩下的用 … 收掉。
// 私密层默认整条打码，要点一下才展开——这个面板是会在别人面前打开的。
export function previewText(text, n = 14) {
  const s = String(text || "").trim();
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}
export function maskText(text) {
  const s = String(text || "").trim();
  return s ? "•".repeat(Math.min(12, Math.max(4, Math.ceil(s.length / 2)))) : "";
}

// 关键词通道：玩家这句话明显在提身体/衣着/相貌时，即便场合本来是灭灯的也点亮。
const PUBLIC_KEYS = [
  "长什么样", "长得", "相貌", "样貌", "外貌", "体貌", "身材", "身量", "个子", "高矮",
  "打量", "端详", "看我", "瞧我", "照镜", "镜子", "衣服", "衣着", "穿着", "换衣",
  "头发", "脸", "笑起来", "声音",
];

/**
 * 体貌信息的蓝绿灯。
 * @param {object} profile   char.bodyProfile
 * @param {object} ctx       { scope, nsfw, scanText, whisper }
 *   scope   —— 主叙事的挂载档（full/talk/move/settle），私聊传 "whisper"
 *   nsfw    —— ■ 模式是否开启。私密层的唯一开关，硬条件。
 *   scanText—— 玩家这句话 + 上一条回复，走关键词通道
 *   whisper —— 是否私聊旁白（她一直看着你，公开层常亮）
 * @returns {{ text: string, lit: string[], dark: string[] }}
 */
export function gateBodyProfile(profile, ctx = {}) {
  if (!profile) return { text: "", lit: [], dark: [] };
  const { scope, nsfw, scanText = "", whisper = false } = ctx;

  const lit = [], dark = [];
  const written = (fields) => fields.filter(f => (profile[f.key] || "").trim());

  // 公开层：近距离互动的场合亮（战斗/对话/查看/创造，以及私聊），赶路与结算轮灭。
  // 另开关键词通道：玩家主动提相貌衣着时，哪怕在赶路轮也亮。
  const hitKey = PUBLIC_KEYS.find(k => scanText.includes(k));
  const publicByScope = whisper || scope === "full" || scope === "talk";
  const publicOn = publicByScope || !!hitKey;
  const publicWritten = written(PUBLIC_FIELDS);

  // 私密层：只认 ■ 模式，关着就灭——关键词点不亮，场合也点不亮。
  const intimateWritten = written(INTIMATE_FIELDS);
  const intimateOn = !!nsfw;

  const blocks = [];
  if (publicWritten.length && publicOn) {
    lit.push(`体貌·公开层${hitKey && !publicByScope ? `⟨词:${hitKey}⟩` : "⟨态⟩"}`);
    blocks.push(publicWritten.map(f => `  ${f.label}（${f.def}）: ${profile[f.key].trim()}`).join("\n"));
  } else if (publicWritten.length) {
    dark.push("体貌·公开层");
  }

  if (intimateWritten.length && intimateOn) {
    lit.push("体貌·私密层⟨■⟩");
    blocks.push(intimateWritten.map(f => `  ${f.label}（${f.def}）: ${profile[f.key].trim()}`).join("\n"));
  } else if (intimateWritten.length) {
    dark.push("体貌·私密层");
  }

  if (!blocks.length) return { text: "", lit, dark };

  return {
    text: `\n\n<主角体貌>\n以下是主角身体与相貌的既定设定。写到动作、姿态、贴身互动时按这份写，不要另编一套；`
      + `没有列出的部分照常自由发挥，但不得与已列出的相矛盾。这是设定不是台词，不要整段复述给玩家听。\n`
      + blocks.join("\n") + `\n</主角体貌>`,
    lit, dark,
  };
}

// ============================================================================
// 按体貌荐装：给 AI 的请求构造
// ============================================================================
// 只让 AI 做"挑哪三件"这一件事——名字必须从给定清单里选，数值一概不由它给。
// 这是本项目一贯的分工（见 catalog.js 顶部："AI 只能引用/描述，不能篡改数值"）：
// 挑完之后由调用方拿名字回 CATALOG_INDEX 查真实数值，AI 说了不算。
export function buildOutfitRequest(profile, poolEntries) {
  const written = BODY_FIELDS.filter(f => (profile?.[f.key] || "").trim());
  const body = written.map(f => `  ${f.label}: ${profile[f.key].trim()}`).join("\n");

  const list = poolEntries
    .map(e => `· ${e.name}｜${CAT_LABEL[e.category] || e.category}｜${e.quality}档｜${(e.desc || "").slice(0, 40)}`)
    .join("\n");

  const system = "你是曲措乡这个武侠世界的掌柜，替客人从现有货架上挑趁手的行头。只挑，不编——货架上没有的东西一律不许提。";
  const user = `【客人的体貌】
${body || "（客人没说，按寻常江湖客处理）"}

【货架清单】（只能从这里面挑）
${list}

请从上面的清单里挑 **三件** 最配这位客人身量、体型与气质的行头，尽量兵器/衣甲/饰品各一件（清单里某类没有合适的可以不强凑）。
只回 JSON，不要任何解释文字、不要 markdown 代码块：
{"picks":[{"name":"清单里的原名","reason":"为什么配这位客人的身体，一句话，扣住他的体型/身量/习惯来说，别泛泛而谈"}]}
name 必须与清单里的名字**一字不差**。reason 三十字以内。`;

  return { system, user };
}

const CAT_LABEL = { weapon: "兵器", armor: "衣甲", accessory: "饰品", misc: "杂货" };
