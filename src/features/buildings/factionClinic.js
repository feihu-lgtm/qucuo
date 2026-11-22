// 势力医馆的日常善举（合稿各派「声誉·加分行为」）：每游戏日一次，涨本派声誉与威望。
// 峨眉慈济佛堂：布施 20 两救济曲措逃民 +5、威望 +2；声誉 ≥ 15 免诊金。
// 青城药圃：随玉真子采药义诊（耗两个时辰）+8、威望 +3。
// 鱼定村歇马居：托鱼定大娘给寒户捐 20 两粮药，鱼定村 +5、威望 +1（合稿「鱼定村·七、7.1」加分行为 3）。
// 唐门试毒药庐：采毒草、送修机括的日常委托（耗两个时辰）+5；声誉 ≥ 40 免诊金。
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
  hospital_yuquan: {
    faction: "玉泉寨", cost: 0, hours: 2, rep: 6, prestige: 2, freeRep: 15, refuseRep: -20,
    dayFlag: "yuquan_clinic_day_", label: "帮巴登阿妈晒药捣药（两个时辰）", done: "今日已帮过工",
    deed: "帮巴登阿妈在草药棚晒药、捣药两个时辰",
    settle: "在巴登草药棚晒了两时辰药草、捣了一臼藏红花，巴登阿妈往你手里塞了一小包跌打膏",
    refuse: "巴登阿妈把药棚门帘一撂：「你这样的人，喝了我的药要出事。」",
  },
  hospital_qingcheng_yaopu: {
    faction: "青城派", cost: 0, hours: 2, rep: 8, prestige: 3, freeRep: null, refuseRep: -20,
    dayFlag: "qingcheng_clinic_day_", label: "随玉真子采药义诊（两个时辰）", done: "今日已义诊",
    deed: "随玉真子上山采药，替染瘴百姓义诊",
    settle: "随玉真子上后山采了一篓草药，又在药圃替雅江染瘴的百姓义诊了两个时辰",
    refuse: "玉真子把篱笆门一掩：「青城药圃不医你这样的人。」",
  },
  inn_yiding: {
    faction: "鱼定村", cost: 20, hours: 0, rep: 5, prestige: 1, freeRep: null, refuseRep: -20,
    dayFlag: "yuding_alms_day_", label: "托大娘给寒户捐20两粮药", done: "今日已捐",
    deed: "托鱼定大娘给村里寒户捐了20两粮药",
    settle: "在歇马居把20两银子交给鱼定大娘，托她换成青稞和药，挨家送到交不起税的寒户手里",
    refuse: "鱼定大娘把银子推回来：「你的东西，村里人不敢收。」",
  },
  hospital_tangmen: {
    faction: "唐门", cost: 0, hours: 2, rep: 5, prestige: 0, freeRep: 40, refuseRep: -20,
    dayFlag: "tangmen_errand_day_", label: "接药庐日常委托（两个时辰）", done: "今日已交差",
    deed: "替药庐采川南毒草、送修机括",
    settle: "接了试毒药庐的日常委托，进竹海采回一篓川南毒草，又把两具崩了簧的机括送去外姓竹坞修好",
    refuse: "药庐的伙计把门帘一放：「唐家的药，不给仇家用。」",
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
