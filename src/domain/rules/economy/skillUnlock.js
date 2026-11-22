// 武学门槛（合稿附录三 unlock）。分势力声誉和唐门拜入尚未接入：
// 需要声誉或拜入的条目一律锁住，不读 AI 可写的世界变量。
export function skillUnlockStatus(state, skill) {
  const unlock = skill?.unlock;
  if (!unlock) return { ok: true };
  if (unlock.member || unlock.rep > 0 || unlock.guestRep > 0) {
    return { ok: false, reason: unlock.note };
  }
  if (unlock.flag && !(state.flags || []).includes(unlock.flag)) return { ok: false, reason: unlock.note };
  if (unlock.quest?.some((id) => state.questProgress?.[id]?.status !== "completed")) {
    return { ok: false, reason: unlock.note };
  }
  return { ok: true };
}
