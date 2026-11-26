// V7c 极轻队友关系账：同伴两两之间的 bonds 配对账。
// 键为按字典序拼接的同伴名（"珍珠|雪豹"），值 { score, tier, lastBeat }，
// score 范围 -50..100，五档：嫌隙/生分/熟络/默契/过命。
// 全部纯函数：进 companionState/varTree 出新高，不落盘不碰 store。

import { createHeartLedgerEntry, capHeartLedgerEntries } from "../memory/npcLedger.js";

export const BOND_MIN = -50;
export const BOND_MAX = 100;

// 档位边界（含端点）：<0 嫌隙 / 0-19 生分 / 20-49 熟络 / 50-79 默契 / 80+ 过命
export function tierOf(score) {
  if (score < 0) return "嫌隙";
  if (score < 20) return "生分";
  if (score < 50) return "熟络";
  if (score < 80) return "默契";
  return "过命";
}

// 配对键：字典序幂等——pairKey("珍珠","雪豹") === pairKey("雪豹","珍珠")
export function pairKey(a, b) {
  return [String(a || ""), String(b || "")].sort((x, y) => x.localeCompare(y, "zh-Hans-CN")).join("|");
}

const clamp = (v) => Math.max(BOND_MIN, Math.min(BOND_MAX, v));

export function readBond(companionState, a, b) {
  const key = pairKey(a, b);
  const raw = companionState?.bonds?.[key];
  const score = Number.isFinite(raw?.score) ? raw.score : 0;
  return { key, score, tier: tierOf(score), lastBeat: raw?.lastBeat || "" };
}

// 写一条 bond 增量：返回新 companionState（不动原对象）。
export function applyBondDelta(companionState, a, b, delta, lastBeat = "") {
  const key = pairKey(a, b);
  if (!key.replace("|", "")) return companionState;
  const prev = companionState?.bonds?.[key] || { score: 0, tier: "生分", lastBeat: "" };
  const score = clamp((Number.isFinite(prev.score) ? prev.score : 0) + (delta || 0));
  return {
    ...(companionState || {}),
    bonds: {
      ...(companionState?.bonds || {}),
      [key]: { score, tier: tierOf(score), lastBeat: lastBeat || prev.lastBeat || "" },
    },
  };
}

// 双人互动结构化结果的硬校验与落账（V7c 图纸）：
//   outcome: { bondDelta?: -5..5, ledgerNote?: string, transfer?: { from, to, itemName } }
// - bondDelta  Clamp 到 ±5 后入账（模型给更大的数也不许暴涨暴降）；
// - ledgerNote 非空则往双方 varTree.角色[name].心账 各落一条「见」类短账；
// - transfer 严格校验：itemName 必须真实存在于 from 槽位 carriedItems 且非绑定装备，
//   缺一条即整笔拒执——绝不允许模型凭空造物。
// 返回 { companionState, varTree, transferApplied|null, transferRejected|null }
export function applyDuoOutcome(companionState, varTree, a, b, outcome = {}, { time = 0, place = "", aKey = "", bKey = "" } = {}) {
  let cs = companionState || {};
  let vt = varTree || {};
  let transferApplied = null;
  let transferRejected = null;

  const delta = Number.isFinite(outcome.bondDelta) ? Math.max(-5, Math.min(5, outcome.bondDelta)) : 0;
  const beat = typeof outcome.lastBeat === "string" ? outcome.lastBeat.slice(0, 30) : "";
  if (delta || beat) cs = applyBondDelta(cs, a, b, delta, beat);

  const note = typeof outcome.ledgerNote === "string" ? outcome.ledgerNote.trim().slice(0, 40) : "";
  if (note) {
    for (const name of [a, b]) {
      const other = name === a ? b : a;
      const entry = createHeartLedgerEntry({ tag: "见", summary: `与${other}：${note}`, turn: time, place });
      if (entry) {
        const cur = Array.isArray(vt?.角色?.[name]?.心账) ? vt.角色[name].心账 : [];
        const next = capHeartLedgerEntries([...cur, entry]);
        vt = { ...vt, 角色: { ...(vt.角色 || {}), [name]: { ...(vt.角色?.[name] || {}), 心账: next } } };
      }
    }
  }

  if (outcome.transfer && typeof outcome.transfer === "object") {
    const { from, to, itemName } = outcome.transfer;
    // Review 修：槽位解析只许在当拍两位参与者里匹配（钥匙优先）——全场按名找槽，
    // 碰上同名进口同伴（如导入的"珍珠"）会把 from/to 解析进同一槽，收件方写覆盖
    // 移除方写，礼物凭空复制。同名到两人都分不清时也硬拦截，宁可不转不可造物。
    const matchSlot = (name) => {
      const keys = [aKey, bKey].filter(Boolean);
      const pool = keys.length
        ? keys.map((k) => [k, cs[k]]).filter(([, c]) => c)
        : Object.entries(cs);
      const hits = pool.filter(([key, c]) => key === name || c?.label === name || c?.data?.name === name).map(([k]) => k);
      return hits.length === 1 ? hits[0] : null;
    };
    const fromSlot = matchSlot(from);
    const toSlot = matchSlot(to);
    const itemNameText = String(itemName || "");
    // Review 修：玩家赠礼的正本在 data.carriedItems（materializeFacts 落此处），
    // 槽位级 carriedItems 是另一本账——读写都必须走 data 正本，否则真实持有的礼被误判不存在。
    const carried = Array.isArray(cs?.[fromSlot]?.data?.carriedItems) ? cs[fromSlot].data.carriedItems : [];
    const idx = carried.findIndex((it) => (typeof it === "string" ? it : it?.name) === itemNameText);
    const item = idx >= 0 ? carried[idx] : null;
    const bound = item && typeof item === "object" && (item.bound || item.equipped || item.已绑定);
    if (!fromSlot || !toSlot || idx < 0) {
      transferRejected = `硬拦截：${from} 身上没有「${itemNameText}」——不许凭空造物`;
    } else if (fromSlot === toSlot) {
      transferRejected = `硬拦截：「${itemNameText}」来去同一人，不予转交`;
    } else if (bound) {
      transferRejected = `硬拦截：「${itemNameText}」是绑定装备，不可转交`;
    } else {
      const nextFrom = carried.filter((_, i) => i !== idx);
      const toCarried = Array.isArray(cs?.[toSlot]?.data?.carriedItems) ? cs[toSlot].data.carriedItems : [];
      cs = {
        ...cs,
        [fromSlot]: { ...cs[fromSlot], data: { ...cs[fromSlot].data, carriedItems: nextFrom } },
        [toSlot]: { ...cs[toSlot], data: { ...cs[toSlot].data, carriedItems: [...toCarried, item] } },
      };
      transferApplied = { from, to, itemName: itemNameText };
    }
  }

  return { companionState: cs, varTree: vt, transferApplied, transferRejected };
}
