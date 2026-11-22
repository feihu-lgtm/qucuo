// 门派切磋声誉：在势力驻地堂堂正正赢下指定的门人，涨该势力声誉。
// 青城派照合稿「青城派·七、声誉」加分行为 3：首胜 +5，此后每日一次 +2，日常切磋最多刷到 39。
import { factionRepOf } from "./factionRep.js";

const POISON = new Set(["淬毒", "剧毒"]);

const SECT_SPARS = [
  {
    faction: "青城派",
    npcs: [{ id: "resident_qingxuan", name: "青玄" }, { id: "resident_songhe", name: "松鹤道长" }],
    flag: "qingcheng_spar",
    first: 5,
    daily: 2,
    dailyCap: 39,
  },
];

const usedPoison = (battleLog) => (battleLog || []).some((row) => POISON.has(row?.result?.statusAppliedToB));

// 返回 null 表示与门派声誉无关；poison 表示用毒取胜不算数；delta>0 时 flags 为写回后的完整 flags。
export function sectSparRepGain(state, npc, { outcome, battleLog } = {}) {
  if (outcome !== "win" || !npc) return null;
  const rule = SECT_SPARS.find((entry) => entry.npcs.some((who) => who.id === npc.id || who.name === npc.name));
  if (!rule) return null;
  if (usedPoison(battleLog)) return { faction: rule.faction, delta: 0, poison: true };
  const flags = state.flags || [];
  const dayFlag = `${rule.flag}_day_${Math.floor((state.time || 0) / 24)}`;
  const firstFlag = `${rule.flag}_first`;
  const keep = flags.filter((flag) => !flag.startsWith(`${rule.flag}_day_`));
  if (!flags.includes(firstFlag)) {
    return { faction: rule.faction, delta: rule.first, flags: [...keep, firstFlag, dayFlag] };
  }
  if (flags.includes(dayFlag)) return null;
  const delta = Math.max(0, Math.min(rule.daily, rule.dailyCap - factionRepOf(state.varTree, rule.faction)));
  if (!delta) return null;
  return { faction: rule.faction, delta, flags: [...keep, dayFlag] };
}
