// 势力医馆的日常善举（合稿各派「声誉·加分行为」）：每游戏日一次，涨本派声誉与威望。
// 峨眉慈济佛堂：布施 20 两救济曲措逃民 +5、威望 +2；声誉 ≥ 15 免诊金。
// 青城药圃：随玉真子采药义诊（耗两个时辰）+8、威望 +3。
// 喇嘛庙山门施药棚：协助根敦诊治冻伤牧民（耗两个时辰）+5、威望 +2；声誉 ≥ 15 免费疗伤回气（合稿「喇嘛庙·七」）。
// 各处声誉 ≤ -20 都拒诊。
import { factionRepOf, formatRepChanges, grantFactionRep } from "../../domain/rules/economy/factionRep.js";

export const FACTION_CLINICS = {
  hospital_emei_fotang: {
    faction: "峨眉派", cost: 20, hours: 0, rep: 5, prestige: 2, freeRep: 15, refuseRep: -20,
    dayFlag: "emei_alms_day_", label: "布施20两救济逃民", done: "今日已布施",
    deed: "布施20两救济曲措逃民",
    settle: "在慈济佛堂布施20两，替了因师太添了几副药、几升米，救济城外的曲措逃民",
    refuse: "了因师太合掌：「施主与峨眉结怨太深，佛堂不便接诊。」",
  },
  hospital_qingcheng_yaopu: {
    faction: "青城派", cost: 0, hours: 2, rep: 8, prestige: 3, freeRep: null, refuseRep: -20,
    dayFlag: "qingcheng_clinic_day_", label: "随玉真子采药义诊（两个时辰）", done: "今日已义诊",
    deed: "随玉真子上山采药，替染瘴百姓义诊",
    settle: "随玉真子上后山采了一篓草药，又在药圃替雅江染瘴的百姓义诊了两个时辰",
    refuse: "玉真子把篱笆门一掩：「青城药圃不医你这样的人。」",
  },
  hospital_lamamiao_yizhen: {
    faction: "喇嘛庙", cost: 0, hours: 2, rep: 5, prestige: 2, freeRep: 15, refuseRep: -20,
    dayFlag: "lama_clinic_day_", label: "协助根敦诊治冻伤牧民（两个时辰）", done: "今日已施药",
    deed: "协助根敦诊治冻伤牧民",
    settle: "在山门施药棚给根敦打下手，替下山路过的冻伤牧民烧水、敷药、正骨，忙了两个时辰",
    refuse: "根敦把药棚的布帘一放：「喇嘛庙的药，不施给你。」",
  },
};

export const clinicOf = (buildingId) => FACTION_CLINICS[buildingId] || null;

const todayFlag = (clinic, time) => `${clinic.dayFlag}${Math.floor((time || 0) / 24)}`;

export function clinicDoneToday(buildingId, { flags = [], time } = {}) {
  const clinic = clinicOf(buildingId);
  return !!clinic && flags.includes(todayFlag(clinic, time));
}

export function clinicCare(varTree, buildingId) {
  const clinic = clinicOf(buildingId);
  if (!clinic) return "paid";
  const rep = factionRepOf(varTree, clinic.faction);
  if (rep <= clinic.refuseRep) return "refuse";
  return clinic.freeRep != null && rep >= clinic.freeRep ? "free" : "paid";
}

export function doClinicService(state, buildingId) {
  const clinic = clinicOf(buildingId);
  if (!clinic) return { logs: [] };
  if (clinicCare(state.varTree, buildingId) === "refuse") return { logs: [{ t: "sys", text: `  ${clinic.refuse}` }] };
  if (clinicDoneToday(buildingId, state)) return { logs: [{ t: "sys", text: "  今日已出过力，明日再来。" }] };
  if ((state.char.money || 0) < clinic.cost) return { logs: [{ t: "sys", text: `  需${clinic.cost}两，银两不够。` }] };
  const gain = { [clinic.faction]: clinic.rep };
  const { applied } = grantFactionRep(state.varTree, gain);
  const prestige = Number(state.varTree?.世界?.威望) || 0;
  const nextPrestige = Math.min(100, prestige + clinic.prestige);
  const flag = todayFlag(clinic, state.time);
  return {
    changes: {
      ...(clinic.cost ? { char: { ...state.char, money: state.char.money - clinic.cost } } : {}),
      // 结算回合自身会再走 1 个时辰，这里只补余下的。
      ...(clinic.hours > 1 ? { time: (state.time || 0) + clinic.hours - 1 } : {}),
      flags: (flags = []) => [...flags.filter((f) => !f.startsWith(clinic.dayFlag)), flag],
      varTree: (prev) => {
        const next = grantFactionRep(prev, gain).varTree;
        return { ...next, 世界: { ...next.世界, 威望: nextPrestige } };
      },
    },
    logs: [{ t: "sys", text: `  （${clinic.deed}，${formatRepChanges(applied) || `${clinic.faction}声誉已满`}，威望 +${nextPrestige - prestige}）` }],
    settle: clinic.settle,
  };
}
