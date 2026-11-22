// 拜入门派（合稿各派「拜入与叛出规则」）：本派声誉 ≥ minRep、威望 ≥ minPrestige（缺省 0；anyPrestige 的邪派不查）、过本派试炼（trial 可空）、未拜他派。
// 入门立加本派声誉 repBonus，发信物 token 与 gifts。雪山派走 sectEntry.js 的老流程。
import { factionRepOf } from "../economy/factionRep.js";
import { SECT_ENTRY } from "./sectEntry.js";

export const FACTION_ENTRIES = {
  五仙教: {
    sect: "五仙教", master: "龙汐月", buildingId: "sect_entry_wuxian",
    minRep: 40, repBonus: 20, flag: "五仙教弟子",
    token: "银蛇弟子牌", gifts: ["清瘴丸", "蛇药粉"],
    quests: ["wuxianjiao_1_zilanwenjing", "wuxianjiao_2_dudianyiying"],
    questsLabel: "完成「蛊1·紫岚问径」与「蛊2·毒典疑影」",
    trial: null,
    intro: "五仙灵坛前银铃低垂。龙汐月隔着面纱看你：「入我五仙，先饮一盏引蛊酒——受得住，才是自己人。」",
    joinLabel: "饮下引蛊酒，拜入五仙教",
  },
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
  欢喜教: {
    sect: "欢喜教", master: "梵衍那", buildingId: "sect_entry_huanxi",
    minRep: 40, repBonus: 20, flag: "欢喜教弟子", anyPrestige: true,
    token: "莲纹铜牌", gifts: [],
    trial: { flag: "huanxijiao_xiang2_passed", quest: "huanxijiao_2_biwuzhaoxian", label: "通过「香2·比武招贤」", hint: "先过罗琦的比武招贤，在内堂听完她的托付。" },
    intro: "偏厅香案上只摆一尊铜钵与三柱无烟红香。向旧神像敬香、饮下罗琦亲斟的坛城茶，便算入了内院门墙。",
    joinLabel: "敬香饮茶，拜入欢喜教",
  },
  锦官城: {
    sect: "锦官城", master: "柳青鸢", buildingId: "sect_entry_guan",
    // 成员旗用专属「锦官城当差」：title_jinguancheng_tequai_xuncha 是官2-A 落的头衔，
    // 任务奖励不经过 checkFactionEntry——若复用做成员旗，别派弟子/叛出者完成任务
    // 会绕过单人一派与门墙永闭拿到成员待遇。
    minRep: 40, repBonus: 20, flag: "锦官城当差",
    token: "巡捕营腰牌", gifts: ["锦官制式软甲", "锦官烧刀子"],
    trial: {
      flag: "guan_cases_cleared",
      quest: "jinguancheng_guan1_xinren",
      label: "当差的本钱：替都事府办妥五桩案子（官1·信任的积累）",
      hint: "柳青鸢不收没办过差的人——先帮她把手里那五桩案子了结。",
    },
    intro: "都事府值房里算盘声没停，柳青鸢抬眼看了你一眼又低回去：「公事公办。想在我手底下当差，先让我看看你办事的样子。」",
    joinLabel: "投效都事府，当差锦官城",
  },
  唐门: {
    sect: "唐门", master: "唐老太", buildingId: "sect_entry_tangmen",
    minRep: 40, repBonus: 20, flag: "唐门弟子",
    token: "玄竹弟子令", gifts: [],
    trial: null,
    intro: "宗祠门前横着一块磨凹了的入堂石。唐老太拄着竹杖站在石后，笑眯眯地说：跪下，滴血，立誓；从今往后唐家的规矩就是你的规矩。",
    joinLabel: "入堂石前立血誓，拜入唐门",
  },
  天龙教: {
    sect: "天龙教", master: "石重岳", buildingId: "sect_entry_tianlong",
    minRep: 40, repBonus: 20, flag: "天龙教弟子",
    token: "天龙弟子令", gifts: ["西域弯刀", "驼绒防风氅"],
    trial: { flag: "tianlong_spar_first", label: "点将台试炼：堂堂正正胜过石重岳或血刀部教头一场", hint: "去玄甲校场或大草甸磨刀坪，堂堂正正胜过石重岳、厉天行或血刀教头一场，不许用毒。" },
    intro: "黑石点将台上牛皮大鼓裂了口，台下插着一圈断刀。石重岳收人不看出身，只看拳头与办差——接得住三招，牌子拿走。",
    joinLabel: "登台试三招，拜入天龙教",
  },
  丐帮三星分舵: {
    sect: "丐帮三星分舵", master: "严九斤", buildingId: "sect_gaibang_entry",
    minRep: 40, repBonus: 20, flag: "丐帮弟子",
    token: "三星青竹袋", gifts: [],
    trial: {
      flag: "quest_gbj_spar",
      label: "聚义堂入门小考：敬严九斤一碗烈酒，竹坪接胡三爷五招不退",
      hint: "去聚义堂向严九斤敬酒，再到竹坪接胡三爷五招，不求胜，只要不逃。",
    },
    intro: "供桌上不烧高香，只摆一坛烈酒。严九斤说，入丐帮不看家世，只看你端不端得起这碗混着雨水的入门酒。",
    joinLabel: "端起入门酒，拜入丐帮三星分舵",
  },
  三星派: {
    sect: "三星派", master: "纵目者", buildingId: "sanxing_mask_hall",
    minRep: 40, repBonus: 20, flag: "三星派弟子", minPrestige: -60,
    token: "青铜纵目令", gifts: [],
    quests: ["sanxingpai_2_sanmianjianzhen"],
    questsLabel: "完成「星2·三面试剑」",
    trial: null,
    intro: "石案上码着一排未开眼的青铜面具，艾草炭火噼啪作响。入墟为徒，先亲手磨亮自己的面具，再向神树递三记问心剑——树顶那双纵目会替你看清自己。",
    joinLabel: "磨亮面具、递三记问心剑，拜入三星派",
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

export function checkFactionEntry(entry, { varTree, flags = [], char, questProgress = {} } = {}) {
  const rep = factionRepOf(varTree, entry.sect);
  const prestige = Number(varTree?.世界?.威望) || 0;
  const minPrestige = entry.minPrestige ?? 0;
  const other = Object.entries(SECT_MEMBER_FLAGS).find(([sect, flag]) => sect !== entry.sect && flags.includes(flag));
  // 试炼 flag 后补的任务（老存档已完成任务但没拿到 flag）按任务完成算过。
  const trialOk = !entry.trial || flags.includes(entry.trial.flag)
    || (!!entry.trial.quest && questProgress?.[entry.trial.quest]?.status === "completed");
  const riteNeeded = !!entry.maleRite && (char?.gender || "男") === "男";
  const riteOk = !riteNeeded || flags.includes(entry.maleRite.flag);
  const questsDone = (entry.quests || []).filter((qid) => questProgress?.[qid]?.status === "completed").length;
  const questsOk = (entry.quests || []).every((qid) => questProgress?.[qid]?.status === "completed");
  const reqs = [
    { key: "rep", label: `${entry.sect}声誉 ≥ ${entry.minRep}（门墙之交）`, have: rep, ok: rep >= entry.minRep },
    ...(entry.anyPrestige ? [] : [{ key: "prestige", label: minPrestige === 0 ? "威望 ≥ 0（不收恶名昭彰之徒）" : `威望 ≥ ${minPrestige}（心魔蒙目者不收）`, have: prestige, ok: prestige >= minPrestige }]),
    ...(entry.quests?.length ? [{ key: "quests", label: entry.questsLabel || "完成本派引荐任务", have: `${questsDone}/${entry.quests.length}`, ok: questsOk }] : []),
    ...(entry.trial ? [{ key: "trial", label: entry.trial.label, have: trialOk ? "已过" : "未过", ok: trialOk }] : []),
    ...(riteNeeded ? [{ key: "rite", label: entry.maleRite.label, have: riteOk ? "已成" : "未成", ok: riteOk }] : []),
    { key: "single", label: "未拜入他派", have: other ? other[0] : "无", ok: !other },
    ...(hasDefected(flags, entry.sect) ? [{ key: "defected", label: "未曾叛出本派", have: "曾叛出", ok: false }] : []),
  ];
  const already = flags.includes(entry.flag);
  return { already, rep, reqs, eligible: !already && reqs.every((r) => r.ok), missing: reqs.filter((r) => !r.ok).map((r) => r.key) };
}
