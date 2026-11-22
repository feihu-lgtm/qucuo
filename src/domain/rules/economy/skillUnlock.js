// 武学门槛（合稿附录三 unlock）。声誉读 世界.势力声誉.<unlock.faction>（AI 单回合每势力最多 ±10）。
// 拜入判定读 flags 中的 `<势力>弟子`（单主门派），叛出后锁死该门派高阶武学的学习与后续突破。
import { SKILL_CATALOG } from "../../data/kungfu/qucuoKungfu.js";
import { hasDefectedSect, isPlayerInSect } from "../character/sectEntry.js";
import { factionRepOf } from "./factionRep.js";

const ALL_CATALOG_SKILLS = Object.values(SKILL_CATALOG).flat();

function isHighTierSectSkill(unlock) {
  return !!unlock?.faction && (!!unlock.member || (unlock.rep ?? 0) >= 40);
}

function repOk(state, unlock) {
  const needsRep = unlock.member || unlock.rep != null || unlock.guestRep != null;
  if (!needsRep) return true;
  if (!unlock.faction) return false;
  if (hasDefectedSect(state.flags, unlock.faction) && isHighTierSectSkill(unlock)) return false;
  const rep = factionRepOf(state.varTree, unlock.faction);
  const member = isPlayerInSect(state.flags, unlock.faction);
  if (unlock.member) {
    if (member) return rep >= (unlock.rep || 0);
    return unlock.guestRep != null && rep >= unlock.guestRep;
  }
  return member || rep >= (unlock.rep || 0);
}

export function skillUnlockStatus(state, skill) {
  const unlock = skill?.unlock;
  if (!unlock) return { ok: true };
  if (!repOk(state, unlock)) return { ok: false, reason: unlock.note };
  if (unlock.prestige != null) {
    const prestige = Number(state.varTree?.世界?.威望) || 0;
    if (prestige < unlock.prestige) return { ok: false, reason: unlock.note };
  }
  if (unlock.favor?.npc) {
    const favor = Number(state.varTree?.角色?.[unlock.favor.npc]?.好感度) || 0;
    if (favor < (unlock.favor.min ?? 0)) return { ok: false, reason: unlock.note };
  }
  if (unlock.flag && !(state.flags || []).includes(unlock.flag)) return { ok: false, reason: unlock.note };
  if (unlock.quest?.some((id) => state.questProgress?.[id]?.status !== "completed")) {
    return { ok: false, reason: unlock.note };
  }
  return { ok: true };
}

// 叛出/逐出后：保留已学会的招式，但锁死该门派高阶武学（member 或 rep ≥ 40）的后续境界突破。
export function isSkillBreakthroughLocked(state, skill) {
  if (!skill) return { locked: false };
  const catalog = ALL_CATALOG_SKILLS.find((entry) => entry.id === skill.id || entry.name === skill.name);
  const unlock = catalog?.unlock;
  if (!isHighTierSectSkill(unlock)) return { locked: false };
  if (!hasDefectedSect(state.flags, unlock.faction)) return { locked: false };
  return { locked: true, faction: unlock.faction };
}
