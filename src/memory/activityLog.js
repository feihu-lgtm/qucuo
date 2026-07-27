// 日内行止账 · 无AI动作的确定性记账（纯函数）
// ============================================================================
// 【要解决什么】
// 记忆链原本只有一个入口：p.memory（AI 写的）。凡是不经过 AI 的动作，在记忆里
// 就是一片空白——打坐、修炼、装备、内层走动、在心灵之海陪她这些，事后回想全查不到。
// 玩家问旁白"我今天都干了什么"，她只能答出经过 AI 的那几件。
//
// 【为什么不是"每个动作也 jotNote 一张"】
// 因为高频重复动作会把向量库喂坏。打坐可以每回合按一次——玩家打坐 30 次，
// 向量库里就有 30 份几乎一字不差的"打坐调息一回，气血回转了些"，
// 之后任何关于休息/气血/调息的召回都会被这 30 份自我复制的噪声淹掉，
// 真正相关的那条反而挤不进 topK。这是向量检索最典型的中毒方式。
//
// 【所以怎么做】
// 计数，不写纸条。按「时辰」分桶（每时辰 2 回合，一天 12 桶），
// 记「某时辰做了某动作几次」。跨天时把整本账压成**一行**汇总文本，
// 交给日总结的原料池（dayMaterialRef）——一天一行，而不是一天五十条。
//
// 于是两条链各管一段，互不污染：
//   AI 那条（p.memory → 向量纸条 / 事实账本）管"发生了什么值得记的事"
//   这条（行止账 → 一行汇总 → 日总结）      管"这一天都在忙些什么"

const SHICHEN = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

// 动作分类表。label 用于汇总文本；unit 是量词；group 决定汇总时的归并顺序。
// 只登记**不经过 AI**或**高频重复**的动作——经 act() 产 p.memory 的那些不要重复记。
export const ACTIVITY = {
  // 修行类（高频，原本每次都写一张几乎一样的向量纸条）
  meditate:    { label: "打坐调息", unit: "次", group: "修行" },
  trainNei:    { label: "运气练内功", unit: "次", group: "修行" },
  trainWai:    { label: "拆招练外功", unit: "次", group: "修行" },
  skillUp:     { label: "修炼武学", unit: "次", group: "修行" },
  // 察看类（高频）
  inspect:     { label: "端详物件", unit: "次", group: "察看" },
  // 买卖类
  buy:         { label: "买入", unit: "件", group: "买卖" },
  sell:        { label: "卖出", unit: "件", group: "买卖" },
  bid:         { label: "拍卖出价", unit: "次", group: "买卖" },
  // 起居类（此前完全无记录）
  equip:       { label: "换穿装备", unit: "次", group: "起居" },
  innerMove:   { label: "走动", unit: "处", group: "起居" },
  eat:         { label: "用饭", unit: "次", group: "起居" },
  // 心灵之海陪伴（此前完全无记录，而这恰恰是最该被记住的一段）
  comfortVerbal:{ label: "说话", unit: "次", group: "陪她" },
  comfortFood:  { label: "拿吃的", unit: "次", group: "陪她" },
  comfortMed:   { label: "喂药", unit: "次", group: "陪她" },
  comfortHug:   { label: "抱", unit: "次", group: "陪她" },
  comfortKiss:  { label: "亲", unit: "次", group: "陪她" },
  // 队伍
  switchMate:  { label: "换随行的人", unit: "次", group: "起居" },
};

const GROUP_ORDER = ["修行", "察看", "买卖", "起居", "陪她"];

export const emptyLedger = () => ({ day: 0, buckets: {} });

export function shichenOf(time) {
  const idx = ((Number(time) || 0) % 24 + 24) % 24;
  return SHICHEN[Math.min(11, Math.floor(idx / 2))];
}
export function dayOf(time) {
  return Math.floor((Number(time) || 0) / 24);
}

// 记一笔。返回新账本（纯函数，不就地改）。
// 跨天自动重置——调用方不必自己判天（少一处忘了判就串天的机会）。
// place 记下来是为了汇总时能说"在鱼定商号买了3件"而不是干巴巴的"买入3件"。
export function record(ledger, { action, time, place = "", n = 1 } = {}) {
  if (!ACTIVITY[action]) return ledger;
  const day = dayOf(time);
  const base = (ledger?.day === day && ledger?.buckets) ? ledger : emptyLedger();
  const shi = shichenOf(time);
  const key = `${shi}|${action}|${place}`;
  return {
    day,
    buckets: { ...base.buckets, [key]: (base.buckets[key] || 0) + (Number(n) || 1) },
  };
}

// 把一本账压成一行人话。
// 输出形如：
//   第3日行止：辰时打坐调息4次；午时于鱼定商号买入3件、卖出1件；申时在心灵之海陪她（说话5次、抱2次）。
// 空账返回 ""（调用方据此决定要不要写进原料池）。
export function flattenLedger(ledger) {
  const buckets = ledger?.buckets || {};
  const keys = Object.keys(buckets);
  if (!keys.length) return "";

  // 先按 时辰 → 分组 → 动作 聚拢
  const byShi = new Map();
  for (const k of keys) {
    const [shi, action, place] = k.split("|");
    const spec = ACTIVITY[action];
    if (!spec) continue;
    if (!byShi.has(shi)) byShi.set(shi, new Map());
    const g = byShi.get(shi);
    if (!g.has(spec.group)) g.set(spec.group, []);
    g.get(spec.group).push({ spec, place, n: buckets[k] });
  }

  const segs = [];
  for (const shi of SHICHEN) {              // 按时辰顺序输出，不按 Object key 顺序
    const groups = byShi.get(shi);
    if (!groups) continue;
    const parts = [];
    for (const gname of GROUP_ORDER) {
      const items = groups.get(gname);
      if (!items) continue;
      // 同组内按次数多的排前面——一天里做得最多的事该先被看见
      items.sort((a, b) => b.n - a.n);
      const placeTag = items.find(i => i.place)?.place || "";
      const body = items.map(i => `${i.spec.label}${i.n}${i.spec.unit}`).join("、");
      if (gname === "陪她") parts.push(`在心灵之海陪她（${body}）`);
      else if (placeTag) parts.push(`于${placeTag}${body}`);
      else parts.push(body);
    }
    if (parts.length) segs.push(`${shi}时${parts.join("，")}`);
  }
  if (!segs.length) return "";
  return `第${(ledger.day || 0) + 1}日行止：${segs.join("；")}。`;
}

// 这一天到底忙没忙（用于决定是否值得写一行）
export function ledgerTotal(ledger) {
  return Object.values(ledger?.buckets || {}).reduce((a, b) => a + (Number(b) || 0), 0);
}
