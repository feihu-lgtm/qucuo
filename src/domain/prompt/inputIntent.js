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

const LOOK_PATTERNS = [
  /^(look|l|看看|环顾|环顾四周|环视|环视四周|查看四周|看看四周|这里有什么|此地有什么|四处看看|四下打量|打量四周)[，,。.！!？?]*$/,
];

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
  /(切磋|比试|过招|较量)/,
];

export function classifyIntent(rawInput) {
  const s = (rawInput || "").trim();
  if (!s) return INTENT.UNKNOWN;

  for (const p of META_PATTERNS) if (p.test(s)) return INTENT.META_QUERY;
  for (const p of MOVE_PATTERNS) if (p.test(s)) return INTENT.MOVE;
  for (const p of LOOK_PATTERNS) if (p.test(s)) return INTENT.LOOK;
  for (const p of DUEL_PATTERNS) if (p.test(s)) return INTENT.COMBAT;
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
      return `篇幅要求：这句输入判定为「${intent.label}」，只用1-2句话简短说明或婉拒，字数控制在10-30字以内。绝对不能在简短回应之后接着写场景描写、NPC反应等正文内容——回应完这1-2句，本轮 output 到此为止。`;
    }
    const hi = (budgetOverrides && budgetOverrides[intent.code] != null)
      ? budgetOverrides[intent.code]
      : intent.wordBudget[1];
    const lo = Math.round(hi * 0.4);
    return `篇幅要求：这句输入判定为「${intent.label}」，本轮 output 总字数应控制在约${lo}-${hi}字（允许±15%浮动），不要为了凑数硬拖长，也不要因为内容简单就完全不写细节。`;
  }

  return `篇幅要求：这句输入的性质无法用规则预判，请你自行判断后再决定篇幅：
- 如果玩家是在问游戏系统本身（规则、玩法、"这是什么游戏"之类跳出游戏世界的元问题），只用1-2句简短说明或用说书人口吻婉拒，不展开叙事，字数控制在30字以内
- 如果是游戏世界内的日常动作（移动、查看、闲聊），控制在100-250字
- 如果是明显有戏剧张力的行动（战斗、关键抉择、触发重要事件），可以展开到${fallbackWordCount}字左右
默认情况下，宁可写短，不要因为拿不准就默认往长了写。`;
}
