// ── WO-23C4 宿敌收服资格判定（纯函数，无 AI）────────────────────────────────
// 路线图口径：「位阶 <=2 且心账恩大于怨者允许收服转入 companionState」。
// 权重最小 deterministic 口径（写进 docs/测试）：按条数计数——
// normalizeLedgerEntries 归一化后仅统计 known 五类tag，恩条数 > 怨条数才算恩大于怨；
// 欠/诺/见不计入权重。该 NPC 根本没有心账角色账（无条目）一律不合格。
import { normalizeLedgerEntries } from "../memory/npcLedger.js";

export function nemesisRecruitEligibility(varTree, entry) {
  if (!entry || typeof entry !== "object" || !entry.id || !entry.name) return { ok: false, reason: "shape" };
  if (entry.status !== "active") return { ok: false, reason: "not_active" };
  if (!(Number(entry.tier) <= 2)) return { ok: false, reason: "tier_too_high" };
  const raw = varTree?.角色?.[entry.name]?.心账;
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, reason: "no_ledger" };
  const entries = normalizeLedgerEntries(raw).filter((e) => e.isKnownTag);
  const en = entries.filter((e) => e.tag === "恩").length;
  const yuan = entries.filter((e) => e.tag === "怨").length;
  if (!(en > yuan)) return { ok: false, reason: "grudge_not_outweighed", en, yuan };
  return { ok: true, en, yuan };
}

// 追杀令最小账本形状：varTree.世界.追杀令 = [{faction, entryId, name, turn, note}]
// dedupe 键 entryId——重复收服/连点不重复记。cap 20 防膨胀。
export const HUNTED_ORDER_CAP = 20;

export function appendHuntedOrder(list, order) {
  const arr = Array.isArray(list) ? list.filter((o) => o && typeof o === "object") : [];
  if (!order?.entryId) return arr;
  if (arr.some((o) => o.entryId === order.entryId)) return arr;
  return [...arr, order].slice(-HUNTED_ORDER_CAP);
}
