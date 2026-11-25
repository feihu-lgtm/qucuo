// 玩家输入意图分类
// 目标：解决"什么情况"这种明显是问系统/旁白的输入，被当成普通游戏行动
// 硬凑出几百字剧情描写的问题。分类本身是纯本地正则匹配，不调用任何 API——
// 这一步的价值就在于"快"，如果分类还要等一次网络请求，就本末倒置了。
//
// 分类给不出明确结果时（UNKNOWN），不额外发起判断请求，而是把"篇幅该多长"
// 这个决策打包进本来就要发的这一次 system prompt，让 LLM 在同一次调用里
// 自己先判断再回答——语义理解交给本来就要用的大模型，不用向量小模型单独跑一次。

export const INTENT = {
  META_QUERY:      { code: "META_QUERY",      wordBudget: [10, 40],   label: "系统元问题" },
  LOOK:            { code: "LOOK",            wordBudget: [60, 150],  label: "查看/环顾" },
  MOVE:            { code: "MOVE",            wordBudget: [80, 200],  label: "移动" },
  TALK_CASUAL:     { code: "TALK_CASUAL",     wordBudget: [150, 350], label: "日常闲聊" },
  INTIMATE:        { code: "INTIMATE",        wordBudget: [200, 500], label: "亲密互动" },
  COMBAT:          { code: "COMBAT",          wordBudget: [400, 900], label: "战斗" },
  EXPLORE_ACTION:  { code: "EXPLORE_ACTION",  wordBudget: [300, 700], label: "调查/搜索/事件行动" },
  UNKNOWN:         { code: "UNKNOWN",         wordBudget: null,       label: "无法判定，交由本次调用自行裁量" },
};

const META_PATTERNS = [
  /^(什么情况|什么状况|咋回事|怎么回事|啥情况)[？?！!。.]*$/,
  /^(你是谁|这是什么游戏|游戏怎么玩|怎么玩|help|帮助|怎么操作)[？?！!。.]*$/,
  /^(我不会玩|不知道怎么办|救命|这啥意思)[？?！!。.]*$/,
  /^(旁白|系统)[，,]?\s*(你|在)/,
  /^(卡住了|没反应|为什么|咋没反应)[？?！!。.]*$/,
  // 纯符号/标点乱码（如"？？？""..."）——不是任何游戏行动，直接给帮助提示，
  // 不必浪费一次 API 调用，也免得 AI 拿它当"茫然的入场感叹"硬凑出一段叙事。
  /^[\s?？.。!！~～·、,，;；:：…—\-*]+$/,
  // 元问题带上追问的尾巴（如"什么情况，谁告诉我""咋回事谁来说说"）——前半是明确的
  // 元问题关键词，后半跟着"谁/告诉/说明/解释/怎么办"这类"求人讲讲规则"的信号才算数，
  // 不会误伤"什么情况都不能退缩"这类把关键词用在句中的角色扮演台词。
  /^(什么情况|什么状况|咋回事|怎么回事|啥情况)[，,、\s]?.{0,12}(谁|告诉|说明|解释|怎么办|咋办|什么意思|讲讲|说说)/,
];

const MOVE_PATTERNS = [
  /^(n|s|e|w|北|南|东|西|上|下)$/i,
  /^(去|往|走向|前往).{1,10}(村|山|寺|庙|镇|寨|海|土司|洞)/,
  // 口语方向：往/向/朝/去 + 东南西北上下（后面可跟"走/去/边/面/方向/面前"或直接结束），
  // 如"往北走""向东""朝南去""往上""去西边"。用方向字锚定，避免误伤"往事""向来"这类。
  /^(往|向|朝|去|走向|前往)\s*(东|南|西|北|上|下)(边|面|方|方向|走|去|行|面前)?[，,。.！!？?]*$/,
];

const BARE_LOOK_PATTERNS = [
  /^(look|l|看看|环顾|环顾四周|环视|环视四周|查看四周|看看四周|这里有什么|此地有什么|四处看看|四下打量|打量四周)[，,。.！!？?]*$/,
];

const LOOK_PATTERNS = [
  ...BARE_LOOK_PATTERNS,
  // 带目标的端详：look <id> / 看 <人> / 打量 <人> / 端详 <人> 也是"查看"，
  // 不应落进 UNKNOWN 走全量上下文让模型自由续写他人事件
  /^(look|l)\s+\S+[，,。.！!？?]*$/,
  // "看"必须空格分隔——"看招""看剑"是出招口令，归 COMBAT 不归 LOOK
  /^(看|看看)\s+\S+[，,。.！!？?]*$/,
  /^(打量|端详|观察|细看|查看)\s*\S+[，,。.！!？?]*$/,
];

// 仅"环顾房间"的裸 look（无目标）——cachedLook 房间预成文本只认这种，
// 带目标的端详要放行到端详路径，不能吃房间缓存
export function isBareLook(rawInput) {
  const s = (rawInput || "").trim();
  return !!s && BARE_LOOK_PATTERNS.some((p) => p.test(s));
}

const COMBAT_PATTERNS = [
  /(攻击|砍|杀|打|战斗|拔剑|出招|对战|挑战|决斗)/,
];

const TALK_PATTERNS = [
  /(聊聊|问问|说说|寒暄|打招呼|唠嗑)/,
];

const EXPLORE_PATTERNS = [
  /(调查|搜索|翻找|查探|检查|探索|搜查)/,
];

const GIFT_PATTERNS = [
  /(送给|赠予|赠送|递给)/,
];

const DUEL_PATTERNS = [
  /(切磋|切搓|比试|比武|过招|较量)/,
];

function isDuelInput(rawInput) {
  const input = (rawInput || "").trim();
  return DUEL_PATTERNS.some((pattern) => pattern.test(input));
}

// 送礼在 classifyIntent 里归 TALK_CASUAL 只是篇幅口径；分流时它是真行动——
// 「递给X一物」得走会落账的 act()，不能当免费搭话吞掉。
export function isGiftInput(rawInput) {
  const input = (rawInput || "").trim();
  if (!GIFT_PATTERNS.some((pattern) => pattern.test(input))) return false;
  // 「是谁/谁送给他的」这类打听来历的问句不是送礼意图。
  return !/(谁|是否|是不是|何人|咋|怎么)[^，。！？]*?(送给|赠予|赠送|递给)/.test(input);
}

// WO-16F-F2c：交易/问价是硬交互意向——「问问老孙价格」带明显交互动词，
// 不能因「问问」二字被当免费纯搭话吞掉（判官链下 turn.intake 根本不跑，
// trade 动作从源头消失）。词面保守：只排明显交互动词，元问题/复杂否定先不做。
const TRADE_RE = /买|卖|交易|问价|价格|价钱|多少钱|开价|拿货看看|什么货|进货|出货/;
export function isTradeInput(rawInput) {
  const input = (rawInput || "").trim();
  if (!TRADE_RE.test(input)) return false;
  // 元问题排除：「价格是什么/什么叫交易」这类概念问答不是交易意向。
  return !/(是什么|什么意思|什么叫)/.test(input);
}

export function classifyIntent(rawInput) {
  const s = (rawInput || "").trim();
  if (!s) return INTENT.UNKNOWN;
  if (INTIMATE_RE.test(s)) return INTENT.INTIMATE;

  for (const p of META_PATTERNS) if (p.test(s)) return INTENT.META_QUERY;
  for (const p of MOVE_PATTERNS) if (p.test(s)) return INTENT.MOVE;
  for (const p of LOOK_PATTERNS) if (p.test(s)) return INTENT.LOOK;
  if (isDuelInput(s)) return INTENT.COMBAT;
  for (const p of COMBAT_PATTERNS) if (p.test(s)) return INTENT.COMBAT;
  for (const p of EXPLORE_PATTERNS) if (p.test(s)) return INTENT.EXPLORE_ACTION;
  for (const p of GIFT_PATTERNS) if (p.test(s)) return INTENT.TALK_CASUAL;
  for (const p of TALK_PATTERNS) if (p.test(s)) return INTENT.TALK_CASUAL;

  return INTENT.UNKNOWN;
}

// 生成插入 system prompt 的篇幅指令文本。
// 分类明确时给出硬性区间；分类不确定时，把判断标准和"默认宁短勿长"的原则
// 直接写给 LLM，让它在这一次调用里自己判断，不产生额外的请求或延迟。
// budgetOverrides: apiCfg.intentBudgets，存各类型的字数上限（只存 max，min 取 max×0.4）
export function buildBudgetInstruction(intent, rawInput, fallbackWordCount, budgetOverrides) {
  if (intent.code !== "UNKNOWN" && intent.wordBudget) {
    if (intent.code === "META_QUERY") {
      return `篇幅要求：这句输入判定为「${intent.label}」，只用1-2句简短说明或婉拒（10-30字），绝不能在其后续写场景描写、NPC反应等正文——回应完本轮 output 到此为止。`;
    }
    const hi = (budgetOverrides && budgetOverrides[intent.code] != null)
      ? budgetOverrides[intent.code]
      : intent.wordBudget[1];
    const lo = Math.round(hi * 0.4);
    return `篇幅要求：这句输入判定为「${intent.label}」，本轮 output 总字数约${lo}-${hi}字（±15%浮动），勿凑数硬拖，勿因内容简单就完全不写细节。`;
  }

  return `篇幅要求：这句输入的性质无法预判，自行判断后决定篇幅：
- 玩家明确在问游戏系统本身（规则、玩法、跳出游戏世界的元问题）时，只用1-2句简短说明（≤30字），不展开叙事；含义不明的短词、口头禅、外文（如「bro」「嗯」「hi」）一律当作角色当场说出口或做出的举动来写，在场的人（尤其玩家选定的互动对象）要有反应，不得用"不接闲话"之类婉拒
- 游戏世界内的日常动作（移动、查看、闲聊）：100-250字
- 明显有戏剧张力的行动（战斗、关键抉择、触发重要事件）：可展开到${fallbackWordCount}字左右
默认宁短勿长，不要拿不准就往长了写。`;
}

// 亲密指令族（搂抱/亲吻/更进一步）——判定独立导出，对话/行动两种模式都要拦。
// 「亲」只算亲吻义：前避父/母/至等尊称复词，后避亲自/亲手/亲信/亲王等日常
// 复词——否则「我亲自去过锦官城」都会误判成亲密请求。
export const INTIMATE_RE = new RegExp(
  "搂|抱一?下|(?<!父|母|至|嫡|庶|乡|探|相)亲(?!自|身|手|口|笔|眼|耳|信|历|命|征|赴|任|和|善|政|权|党|军|民|兵|王|族|友|戚|眷|属|情|事|家|子|生|爹|娘|父|母|舅|姑|叔|伯|姨|婶|哥|姐|弟|妹|旧|故|其|授)"
  + "|(?<!口)吻(?!合)|亲热|亲密|亲昵|温存|云雨|欢好|翻云覆雨|共赴巫山|更进一步|宽衣|解衣|求欢|肌肤之亲|双修|扑倒|推倒",
);
export const isIntimateInput = (cmd = "") => INTIMATE_RE.test(String(cmd));
