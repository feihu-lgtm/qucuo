// WO-16D PR-D2 影子对账展示格式化纯函数——UI 与复制文本共用，零状态零依赖。
// verdict 形状对齐 shadowCompare：{ verdict, single, judge }——single/judge 为
// 各类目原始数据（inv/npcs={add,rm}、flags=[…]、affection={npc:delta}）。

export const VERDICT_LABEL = {
  match: "一致",
  single_only: "判官漏判",
  judge_only: "判官会判",
  both_diff: "两边都偏",
  excluded: "盲区(排除)",
};

const fmtList = (arr) => (arr && arr.length ? arr.join("、") : "无");
const fmtPair = (pair) => {
  if (!pair) return "无";
  if (Array.isArray(pair)) return fmtList(pair); // flags 只有 add 语义
  return `+${fmtList(pair.add)}/-${fmtList(pair.rm)}`;
};
const fmtAff = (obj) => {
  const entries = Object.entries(obj || {});
  return entries.length ? entries.map(([n, v]) => `${n}${v > 0 ? "+" : ""}${v}`).join("、") : "无";
};

export function formatVerdictLine(cat, v) {
  const label = VERDICT_LABEL[v?.verdict] || v?.verdict || "?";
  if (v?.verdict === "excluded" || v?.verdict === "match") return `${cat}：${label}`;
  const detail = cat === "affection"
    ? `实际${fmtAff(v.single)} 判官${fmtAff(v.judge)}`
    : `实际${fmtPair(v.single)} 判官${fmtPair(v.judge)}`;
  return `${cat}：${label}（${detail}）`;
}

// 回合级 verdicts → 可读行数组（excluded 也列出，盲区明示不伪装覆盖）
export function formatShadowVerdicts(verdicts = {}) {
  return Object.entries(verdicts).map(([cat, v]) => formatVerdictLine(cat, v));
}

// epoch 聚合 → 文本行数组；空/零回合返回 null（UI 不制造噪音）
export function formatAggregate(agg) {
  if (!agg || !agg.turns) return null;
  const lines = [
    `共 ${agg.turns} 回合 · 全一致 ${agg.match} · 判官漏判回合 ${agg.gaps} · 判官多判回合 ${agg.judgeExtra}`,
  ];
  for (const [cat, c] of Object.entries(agg.byCategory || {})) {
    lines.push(`${cat}：漏判 ${c.single_only || 0} · 会判 ${c.judge_only || 0} · 两边都偏 ${c.both_diff || 0}`);
  }
  const ex = Object.entries(agg.excluded || {});
  if (ex.length) lines.push(`盲区(不计入覆盖)：${ex.map(([cat, n]) => `${cat}×${n}`).join("、")}`);
  return lines;
}
