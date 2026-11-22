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
  {
    faction: "五仙教",
    npcs: [{ id: "resident_longxiyue", name: "龙汐月" }, { id: "resident_sangqi", name: "桑七" }],
    flag: "wuxian_spar",
    first: 5,
    daily: 2,
    dailyCap: 39,
  },
  {
    faction: "雪山派",
    npcs: [{ id: "resident_luhanzhi", name: "陆寒枝" }, { id: "resident_shenjibai", name: "沈既白" }],
    flag: "xueshan_spar",
    first: 5,
    daily: 2,
    dailyCap: 39,
  },
  {
    faction: "三星派",
    npcs: [
      { id: "resident_qingtong_jia", name: "青铜面人·甲" },
      { id: "resident_qingtong_yi", name: "青铜面人·乙" },
      { id: "resident_qingtong_bing", name: "青铜面人·丙" },
    ],
    flag: "sanxing_spar",
    first: 5,
    daily: 2,
    dailyCap: 39,
  },
  // 天龙教：在点将台/磨刀坪堂堂正正赢教中好手，涨天龙教声誉（合稿「比武服众 +8」）。
  {
    faction: "天龙教",
    npcs: [{ id: "resident_shizhongyue", name: "石重岳" }, { id: "resident_litianxing", name: "厉天行" },
      { id: "resident_xuedao_chuqi", name: "血刀门徒·初七" }, { id: "resident_xuedao_shisan", name: "血刀门徒·十三" },
      { id: "resident_xuedao_niansan", name: "血刀门徒·廿三" }],
    flag: "tianlong_spar",
    first: 8,
    daily: 3,
    dailyCap: 40,
  },
];

// 组队单位 id 取 npc.id || npc.name（teamUnits），玩家恒为 "player"，按 id 认人，不怕重名。
const isNpc = (unit, npc) => !!unit && unit.id === (npc.id || npc.name);

// 单挑战报里对手恒为 B；组队战报按出手方记 A，对手先出手时毒落在 statusAppliedToA。
function poisonedNpc(row, npc) {
  const result = row?.result || {};
  const onNpc = row?.actor && isNpc(row.actor, npc) ? result.statusAppliedToA : result.statusAppliedToB;
  if (row?.actor && !isNpc(row.actor, npc) && !isNpc(row.target, npc)) return false;
  return POISON.has(onNpc);
}

const usedPoison = (battleLog, npc) => (battleLog || []).some((row) => poisonedNpc(row, npc));

// 返回 null 表示与门派声誉无关；poison 表示用毒取胜不算数；delta>0 时 flags 为写回后的完整 flags。
export function sectSparRepGain(state, npc, { outcome, battleLog } = {}) {
  if (outcome !== "win" || !npc) return null;
  const rule = SECT_SPARS.find((entry) => entry.npcs.some((who) => who.id === npc.id || who.name === npc.name));
  if (!rule) return null;
  if (usedPoison(battleLog, npc)) return { faction: rule.faction, delta: 0, poison: true };
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
