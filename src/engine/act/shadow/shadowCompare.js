// WO-16D 影子对账·对比判定（纯函数）
// 逐类目集合对比：
//   match        两边完全一致（含双空）
//   single_only  单调用实际生效有、判官 facts 无——判官漏判，替代覆盖缺口
//   judge_only   判官 facts 有、单调用 diff 无——判官会判但单调用没落/模型没写，
//                多半不算 bug，记覆盖率信息
//   both_diff    两边都非空但不一致
//   caliber_diff 数值类目专有两级判定（S5）：方向一致即覆盖，数额差超 50%
//                另计口径差——单独统计不计缺口（判官定量 vs 模型随写本就会差）
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

export function compareCategories(diffOut, proj, { featureRoutedCats = [] } = {}) {
  const excluded = new Set(diffOut?.excluded || []);
  // S5：feature 路由处理的回合（equip/use_item/take/invite）对应类目不参与比较——
  // 这些动作有系统 deterministic 前路，影子对比只会产噪声。由 shadowJudge 按
  // intake actions kind 映射注入，与 npcs 结构盲区同列 excluded。
  for (const cat of featureRoutedCats) excluded.add(cat);
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
      const sub = {}; let anySingle = false, anyJudge = false, anyDiff = false, anyActive = false, anyCaliber = false;
      for (const k of keys) {
        const dv = dNum[k] || 0, pv = pNum[k] || 0;
        if (dv === 0 && pv === 0) continue;
        anyActive = true;
        if (dv === pv) { sub[k] = { single: dv, judge: pv, verdict: "match" }; continue; }
        // WO-16D-M2：每个数值 sub 各自记方向——同回合 hp both_diff + money single_only
        // 不再被一级 verdict 优先级坍缩掩盖，报告/聚合并存 sub 明细。
        // S5 两级判定：两边都非零且同号——方向一致即覆盖；数额差超 50% 另计
        // caliber_diff（口径差，不计缺口）。只有反号才算 both_diff 真冲突。
        let subVerdict;
        if (pv === 0) subVerdict = "single_only";
        else if (dv === 0) subVerdict = "judge_only";
        else if ((dv > 0) === (pv > 0)) {
          const rel = Math.abs(dv - pv) / Math.max(Math.abs(dv), Math.abs(pv));
          subVerdict = rel > 0.5 ? "caliber_diff" : "match";
        } else subVerdict = "both_diff";
        if (subVerdict === "single_only") anySingle = true;
        else if (subVerdict === "judge_only") anyJudge = true;
        else if (subVerdict === "both_diff") anyDiff = true;
        else if (subVerdict === "caliber_diff") anyCaliber = true;
        sub[k] = { single: dv, judge: pv, verdict: subVerdict };
      }
      // 全部子项相等（含非零相等）才算 match；有差异才按方向归类。
      // 一级 verdict 继续作摘要（single_only>both_diff>judge_only 优先级），
      // 但混合方向必须读 sub——formatVerdictLine/聚合报告同口径。
      const anyMismatch = anySingle || anyJudge || anyDiff || anyCaliber;
      verdicts[cat] = (!anyActive || !anyMismatch)
        ? { verdict: "match" }
        : {
          // 口径差优先级最低——只要有真缺口/真冲突就按真问题归类；
          // 整类目全是口径差时才标 caliber_diff（不计缺口，单独统计）。
          verdict: anySingle ? "single_only" : anyDiff ? "both_diff" : anyJudge ? "judge_only" : "caliber_diff",
          single: dNum, judge: pNum, sub,
        };
      continue;
    }
    if (cat === "world") {
      // S5：varTree.世界 数值 leaf——与 affection 同构按 leaf 精确对比。
      const dKeys = Object.keys(d.world || {});
      const pKeys = Object.keys(proj.world || {});
      if (!dKeys.length && !pKeys.length) {
        verdicts[cat] = { verdict: "match" };
      } else {
        const allKeys = new Set([...dKeys, ...pKeys]);
        let same = true;
        for (const k of allKeys) {
          if ((d.world?.[k] || 0) !== (proj.world?.[k] || 0)) { same = false; break; }
        }
        verdicts[cat] = same
          ? { verdict: "match" }
          : { verdict: !pKeys.length ? "single_only" : !dKeys.length ? "judge_only" : "both_diff", single: d.world, judge: proj.world };
      }
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
