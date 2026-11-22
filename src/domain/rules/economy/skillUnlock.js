// 武学门槛（合稿附录三 unlock）。声誉读 世界.势力声誉.<unlock.faction>（AI 单回合每势力最多 ±10）。
// member 条目：本门弟子（SECT_MEMBER_FLAGS）达到 rep 即可，外客只能走 guestRep。
// favor：{ npc, min } 另要某人好感（角色.<npc>.好感度，缺省 10）达标。
// bypassFlag：持有这个 flag（任务真传）就跳过声誉与好感门槛。
import { SECT_MEMBER_FLAGS, hasDefected } from "../character/factionEntry.js";
import { factionRepOf } from "./factionRep.js";

// 本门高阶武学：限本门弟子，或声誉门槛 ≥ 40。叛出后不得再学、再突破。
function isHighTierSectSkill(unlock) {
  return !!unlock?.faction && (!!unlock.member || (unlock.rep ?? 0) >= 40);
}

function repOk(state, unlock) {
  const needsRep = unlock.member || unlock.rep != null || unlock.guestRep != null;
  if (!needsRep) return true;
  if (!unlock.faction) return false;
  if (hasDefected(state.flags, unlock.faction) && isHighTierSectSkill(unlock)) return false;
  const rep = factionRepOf(state.varTree, unlock.faction);
  if (unlock.member) {
    const isMember = (state.flags || []).includes(SECT_MEMBER_FLAGS[unlock.faction]);
    return (isMember && rep >= (unlock.rep || 0)) || (unlock.guestRep != null && rep >= unlock.guestRep);
  }
  return rep >= (unlock.rep || 0);
}

function favorOk(state, favor) {
  if (!favor) return true;
  const have = Number(state.varTree?.角色?.[favor.npc]?.好感度 ?? 10);
  return have >= favor.min;
}

export function skillUnlockStatus(state, skill) {
  const unlock = skill?.unlock;
  if (!unlock) return { ok: true };
  const bypass = !!unlock.bypassFlag && (state.flags || []).includes(unlock.bypassFlag);
  if (!bypass && !repOk(state, unlock)) return { ok: false, reason: unlock.note };
  if (!bypass && !favorOk(state, unlock.favor)) return { ok: false, reason: unlock.note };
  if (unlock.prestige != null && (Number(state.varTree?.世界?.威望) || 0) < unlock.prestige) return { ok: false, reason: unlock.note };
  if (unlock.flag && !(state.flags || []).includes(unlock.flag)) return { ok: false, reason: unlock.note };
  if (unlock.quest?.some((id) => state.questProgress?.[id]?.status !== "completed")) {
    return { ok: false, reason: unlock.note };
  }
  return { ok: true };
}

// 叛出/逐出后保留已学火候，但本门高阶武学不再突破。skill 是玩家身上的招式，unlock 从武学表按 id/名字认回。
export function isSkillBreakthroughLocked(state, skill, catalog = []) {
  const unlock = skill?.unlock || catalog.find((entry) => entry.id === skill?.id || entry.name === skill?.name)?.unlock;
  if (!isHighTierSectSkill(unlock) || !hasDefected(state.flags, unlock.faction)) return { locked: false };
  return { locked: true, faction: unlock.faction };
}
