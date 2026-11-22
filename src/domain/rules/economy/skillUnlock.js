// 武学门槛（合稿附录三 unlock）。声誉读 世界.势力声誉.<unlock.faction>（AI 单回合每势力最多 ±10）。
// 拜入尚未接入：member 条目只能走 guestRep（外客门槛），没有 guestRep 的一律锁住。
import { factionRepOf } from "./factionRep.js";

function repOk(state, unlock) {
  const needsRep = unlock.member || unlock.rep != null || unlock.guestRep != null;
  if (!needsRep) return true;
  if (!unlock.faction) return false;
  const rep = factionRepOf(state.varTree, unlock.faction);
  if (unlock.member) return unlock.guestRep != null && rep >= unlock.guestRep;
  return rep >= (unlock.rep || 0);
}

export function skillUnlockStatus(state, skill) {
  const unlock = skill?.unlock;
  if (!unlock) return { ok: true };
  if (!repOk(state, unlock)) return { ok: false, reason: unlock.note };
  if (unlock.flag && !(state.flags || []).includes(unlock.flag)) return { ok: false, reason: unlock.note };
  if (unlock.quest?.some((id) => state.questProgress?.[id]?.status !== "completed")) {
    return { ok: false, reason: unlock.note };
  }
  return { ok: true };
}
