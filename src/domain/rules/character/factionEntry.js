// 拜入门派（合稿各派「拜入与叛出规则」）：本派声誉 ≥ minRep、威望 ≥ 0、过本派试炼（trial 可空）、未拜他派。
// 入门立加本派声誉 repBonus，发信物 token 与 gifts。雪山派走 sectEntry.js 的老流程。
import { factionRepOf } from "../economy/factionRep.js";
import { SECT_ENTRY } from "./sectEntry.js";

export const FACTION_ENTRIES = {
  青城派: {
    sect: "青城派", master: "一清道长", buildingId: "sect_entry_yajiang",
    minRep: 40, repBonus: 20, flag: "青城派弟子",
    token: "青城玄门竹牌", gifts: ["三清松风铁剑", "青城道袍"],
    trial: { flag: "qingcheng_spar_first", label: "剑坪试剑：堂堂正正胜过青玄或松鹤道长", hint: "去剑坪堂堂正正胜青玄或松鹤道长一场，不许用毒。" },
    intro: "牌坊下摆着登记名册与一筐竹制腰牌。持堂道人说，欲入玄门，先在此明志试心，再由一清道长点头。",
    joinLabel: "明志试心，拜入青城派",
  },
  峨眉派: {
    sect: "峨眉派", master: "玄尘师太", buildingId: "sect_entry_emei",
    minRep: 40, repBonus: 20, flag: "峨眉派弟子",
    token: "峨眉青玉弟子令", gifts: ["素铁峨眉刺", "青布道袍"],
    trial: null,
    maleRite: {
      flag: "emei_chaojing_done",
      label: "男弟子入门礼：抄经堂静心抄经三日",
      hint: "去听竹轩东边的抄经堂，分三日各静心抄一回经。",
    },
    intro: "听竹轩正厅案上供着青玉弟子令与一卷《峨眉清规》。玄尘师太问你三句心性话，答得出，便收。",
    joinLabel: "问心受戒，拜入峨眉派",
  },
  唐门: {
    sect: "唐门", master: "唐老太", buildingId: "sect_entry_tangmen",
    minRep: 40, repBonus: 20, flag: "唐门弟子",
    token: "玄竹弟子令", gifts: [],
    trial: null,
    intro: "宗祠门前横着一块磨凹了的入堂石。唐老太拄着竹杖站在石后，笑眯眯地说：跪下，滴血，立誓；从今往后唐家的规矩就是你的规矩。",
    joinLabel: "入堂石前立血誓，拜入唐门",
  },
};

export const SECT_MEMBER_FLAGS = {
  雪山派: SECT_ENTRY.flag,
  ...Object.fromEntries(Object.values(FACTION_ENTRIES).map((entry) => [entry.sect, entry.flag])),
};

// 叛出 / 逐出（合稿「拜入与叛出规则」）：本派声誉重置，门墙永闭，本门高阶武学不再突破。
export const DEFECT_REP = { defect: -40, expel: -70 };
export const defectedFlag = (sect) => `叛出:${sect}`;
export const hasDefected = (flags, sect) => (flags || []).includes(defectedFlag(sect));
export const currentSectOf = (flags = []) => Object.entries(SECT_MEMBER_FLAGS).find(([, flag]) => (flags || []).includes(flag))?.[0] ?? null;
export const sectTokenOf = (sect) => (sect === SECT_ENTRY.sect ? SECT_ENTRY.keyName : FACTION_ENTRIES[sect]?.token);
export const sectMasterOf = (sect) => (sect === SECT_ENTRY.sect ? SECT_ENTRY.master : FACTION_ENTRIES[sect]?.master);

export const factionEntryForBuilding = (buildingId) =>
  Object.values(FACTION_ENTRIES).find((entry) => entry.buildingId === buildingId) || null;

export function checkFactionEntry(entry, { varTree, flags = [], char } = {}) {
  const rep = factionRepOf(varTree, entry.sect);
  const prestige = Number(varTree?.世界?.威望) || 0;
  const other = Object.entries(SECT_MEMBER_FLAGS).find(([sect, flag]) => sect !== entry.sect && flags.includes(flag));
  const trialOk = !entry.trial || flags.includes(entry.trial.flag);
  const riteNeeded = !!entry.maleRite && (char?.gender || "男") === "男";
  const riteOk = !riteNeeded || flags.includes(entry.maleRite.flag);
  const reqs = [
    { key: "rep", label: `${entry.sect}声誉 ≥ ${entry.minRep}（门墙之交）`, have: rep, ok: rep >= entry.minRep },
    { key: "prestige", label: "威望 ≥ 0（不收恶名昭彰之徒）", have: prestige, ok: prestige >= 0 },
    ...(entry.trial ? [{ key: "trial", label: entry.trial.label, have: trialOk ? "已过" : "未过", ok: trialOk }] : []),
    ...(riteNeeded ? [{ key: "rite", label: entry.maleRite.label, have: riteOk ? "已成" : "未成", ok: riteOk }] : []),
    { key: "single", label: "未拜入他派", have: other ? other[0] : "无", ok: !other },
    ...(hasDefected(flags, entry.sect) ? [{ key: "defected", label: "未曾叛出本派", have: "曾叛出", ok: false }] : []),
  ];
  const already = flags.includes(entry.flag);
  return { already, rep, reqs, eligible: !already && reqs.every((r) => r.ok), missing: reqs.filter((r) => !r.ok).map((r) => r.key) };
}
