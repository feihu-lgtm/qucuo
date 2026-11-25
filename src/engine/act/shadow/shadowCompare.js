// WO-16D 影子对账·对比判定（纯函数）
// 逐类目集合对比：
//   match        两边完全一致（含双空）
//   single_only  单调用实际生效有、判官 facts 无——判官漏判，替代覆盖缺口
//   judge_only   判官 facts 有、单调用 diff 无——判官会判但单调用没落/模型没写，
//                多半不算 bug，记覆盖率信息
//   both_diff    两边都非空但不一致
//   excluded     类目本轮不可对比（如移动回合 npcs）
import { SHADOW_CATEGORIES } from "./shadowTaxonomy.js";

const sorted = (arr) => [...(arr || [])].sort();
const sameList = (a, b) => {
  const x = sorted(a), y = sorted(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};
const emptyListCat = (c) => !c?.add?.length && !c?.rm?.length;

function compareListPair(diffPair, projPair) {
  const dEmpty = emptyListCat(diffPair), pEmpty = emptyListCat(projPair);
  if (dEmpty && pEmpty) return "match";
  if (sameList(diffPair?.add, projPair?.add) && sameList(diffPair?.rm, projPair?.rm)) return "match";
  if (pEmpty) return "single_only";
  if (dEmpty) return "judge_only";
  return "both_diff";
}

export function compareCategories(diffOut, proj) {
  const excluded = new Set(diffOut?.excluded || []);
  const d = diffOut?.categories || {};
  const verdicts = {};
  for (const cat of SHADOW_CATEGORIES) {
    if (excluded.has(cat)) {
      verdicts[cat] = { verdict: "excluded" };
      continue;
    }
    if (cat === "affection") {
      const dKeys = Object.keys(d.affection || {});
      const pKeys = Object.keys(proj.affection || {});
      if (!dKeys.length && !pKeys.length) {
        verdicts[cat] = { verdict: "match" };
      } else {
        const allKeys = new Set([...dKeys, ...pKeys]);
        let same = true;
        for (const k of allKeys) {
          if ((d.affection?.[k] || 0) !== (proj.affection?.[k] || 0)) { same = false; break; }
        }
        verdicts[cat] = same
          ? { verdict: "match" }
          : { verdict: !pKeys.length ? "single_only" : !dKeys.length ? "judge_only" : "both_diff", single: d.affection, judge: proj.affection };
      }
      continue;
    }
    // 数值类目（vitals.hp/money、cultivation.exp/pot）：零值语义一致——两边皆零 match，
    // 单边非零 single_only/judge_only，都非零不等 both_diff。
    if (cat === "vitals" || cat === "cultivation") {
      const dNum = d[cat] || {}, pNum = proj[cat] || {};
      const keys = cat === "vitals" ? ["hp", "money"] : ["exp", "pot"];
      const sub = {}; let anySingle = false, anyJudge = false, anyDiff = false, anyActive = false;
      for (const k of keys) {
        const dv = dNum[k] || 0, pv = pNum[k] || 0;
        if (dv === 0 && pv === 0) continue;
        anyActive = true;
        if (dv === pv) { sub[k] = { single: dv, judge: pv, verdict: "match" }; continue; }
        // WO-16D-M2：每个数值 sub 各自记方向——同回合 hp both_diff + money single_only
        // 不再被一级 verdict 优先级坍缩掩盖，报告/聚合并存 sub 明细。
        const subVerdict = pv === 0 ? "single_only" : dv === 0 ? "judge_only" : "both_diff";
        if (pv === 0) anySingle = true;
        else if (dv === 0) anyJudge = true;
        else anyDiff = true;
        sub[k] = { single: dv, judge: pv, verdict: subVerdict };
      }
      // 全部子项相等（含非零相等）才算 match；有差异才按方向归类。
      // 一级 verdict 继续作摘要（single_only>both_diff>judge_only 优先级），
      // 但混合方向必须读 sub——formatVerdictLine/聚合报告同口径。
      const anyMismatch = anySingle || anyJudge || anyDiff;
      verdicts[cat] = (!anyActive || !anyMismatch)
        ? { verdict: "match" }
        : { verdict: anySingle ? "single_only" : anyDiff ? "both_diff" : "judge_only", single: dNum, judge: pNum, sub };
      continue;
    }
    if (cat === "quest") {
      const dPair = { add: d.quest?.advance, rm: [] };
      const pPair = { add: proj.quest?.advance, rm: [] };
      verdicts[cat] = { verdict: compareListPair(dPair, pPair), single: d.quest?.advance, judge: proj.quest?.advance };
      continue;
    }
    if (cat === "flags") {
      const dPair = { add: d.flags?.add, rm: [] };
      const pPair = { add: proj.flags?.add, rm: [] };
      verdicts[cat] = { verdict: compareListPair(dPair, pPair), single: d.flags?.add, judge: proj.flags?.add };
      continue;
    }
    verdicts[cat] = { verdict: compareListPair(d[cat], proj[cat]), single: d[cat], judge: proj[cat] };
  }
  // WO-16D-M2：quest 类目 reference-only——questProgress 状态驱动推进可能非本回合
  // 判官签发（flags/收集件经其他通道先齐），系统归因不可靠，不计入 gaps 缺口汇总；
  // verdicts 仍照常产出供 UI/Markdown 展示，人工甄别。
  const active = Object.entries(verdicts)
    .filter(([cat, v]) => cat !== "quest" && v.verdict !== "excluded" && v.verdict !== "match")
    .map(([, v]) => v);
  const questV = verdicts.quest;
  return {
    verdicts,
    hasGap: active.some((v) => v.verdict === "single_only" || v.verdict === "both_diff"),
    judgeExtra: active.some((v) => v.verdict === "judge_only")
      || !!(questV && questV.verdict === "judge_only"),
  };
}
