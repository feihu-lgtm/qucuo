// 慈济佛堂（合稿「峨眉派·声誉」）：每日一次布施 20 两救济曲措逃民，峨眉派 +5、威望 +2；
// 峨眉派声誉 ≥ 15 免收诊金，≤ -20 拒诊。
import { factionRepOf } from "../../domain/rules/economy/factionRep.js";

export const FOTANG = {
  id: "hospital_emei_fotang", faction: "峨眉派",
  alms: 20, rep: 5, prestige: 2, freeRep: 15, refuseRep: -20, dayFlag: "emei_alms_day_",
};

const todayFlag = (time) => `${FOTANG.dayFlag}${Math.floor((time || 0) / 24)}`;

export const almsDoneToday = ({ flags = [], time } = {}) => flags.includes(todayFlag(time));

export function fotangCare(varTree, buildingId) {
  if (buildingId !== FOTANG.id) return "paid";
  const rep = factionRepOf(varTree, FOTANG.faction);
  if (rep <= FOTANG.refuseRep) return "refuse";
  return rep >= FOTANG.freeRep ? "free" : "paid";
}

export function donateAlms(state) {
  if (almsDoneToday(state)) return { logs: [{ t: "sys", text: "  今日已布施过，了因师太请你明日再来。" }] };
  if ((state.char.money || 0) < FOTANG.alms) return { logs: [{ t: "sys", text: `  布施需${FOTANG.alms}两，银两不够。` }] };
  const rep = factionRepOf(state.varTree, FOTANG.faction);
  const nextRep = Math.min(100, rep + FOTANG.rep);
  const prestige = Number(state.varTree?.世界?.威望) || 0;
  const nextPrestige = Math.min(100, prestige + FOTANG.prestige);
  const flag = todayFlag(state.time);
  return {
    changes: {
      char: { ...state.char, money: state.char.money - FOTANG.alms },
      flags: (flags = []) => [...flags.filter((f) => !f.startsWith(FOTANG.dayFlag)), flag],
      varTree: (prev) => ({
        ...prev,
        世界: {
          ...prev?.世界,
          威望: nextPrestige,
          势力声誉: { ...prev?.世界?.势力声誉, [FOTANG.faction]: nextRep },
        },
      }),
    },
    logs: [{ t: "sys", text: `  （布施${FOTANG.alms}两救济曲措逃民，峨眉派声誉 +${nextRep - rep}，威望 +${nextPrestige - prestige}）` }],
    settle: `在慈济佛堂布施${FOTANG.alms}两，替了因师太添了几副药、几升米，救济城外的曲措逃民`,
  };
}
