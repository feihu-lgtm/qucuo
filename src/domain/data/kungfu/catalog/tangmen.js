// 武学目录·唐门（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const tangmen = [
    {
      id: "kf_tm_cuntie", name: "寸铁点星手", type: SKILL_TYPE.MOVE, quality: "绿", price: 55,
      moveType: "攻击",
      lowHpBonus: 0.25,
      unlock: { faction: "唐门", rep: 0, member: false, note: "无需拜入，唐门声誉 ≥ 0（演武坪可学）" },
      desc: "唐门最不起眼的入门暗器手法，铁莲子、铜钱甚至半枚碎瓷片都能脱手打穴。唐三少说这门功夫不图好看，只图「对手以为你手里空着的时候，他已经少了一口气」。",
    },
    {
      id: "kf_rec_yaoxi", name: "药息", type: SKILL_TYPE.MOVE, quality: "蓝", price: 145,
      moveType: "状态",
      energyRestore: 7, immuneControl: true,
      unlock: { faction: "唐门", rep: 15, member: false, note: "无需拜入，唐门声誉 ≥ 15" },
      desc: "唐门以毒淬体的副产物：运起药息，体表渗出一层微苦的薄汗，人也跟着清醒。旁人的迷香定身之类，到了这层汗跟前就矮了三分。唐老太一边喝茶一边说「这不算功夫，是习惯」。",
    },
    {
      id: "kf_rec_xiazhong", name: "匣中静", type: SKILL_TYPE.MOVE, quality: "紫", price: 215,
      moveType: "状态",
      energyRestore: 9, nextAttackBonus: 0.35,
      unlock: { faction: "唐门", rep: 40, member: false, note: "需正式拜入唐门，或唐门声誉 ≥ 40" },
      desc: "开匣之前的那一息。十二格暗器都在手边，你不看它们，只调匀呼吸——手一稳，出去的东西才准。唐三少说店里最贵的不是暗器，是这一息。",
    },
    { id: "kf_tangmen_anqi", name: "满天星雨", type: SKILL_TYPE.MOVE, quality: "蓝", price: 150,
      moveType: "攻击",
      ignoreDefenseRatio: 0.35, applyMark: { name: "内伤", stacks: 1, max: 5 },
      unlock: { faction: "唐门", rep: 40, member: true, guestRep: 80, note: "需正式拜入唐门且声誉 ≥ 40（或声誉 ≥ 80）" },
      desc: "唐门暗器总诀。袖中同时飞出七枚铁蒺藜，走七条不同弧线，封死对手三个闪避方向。不是快，是密。练到极处一袖出三十六枚，如星雨覆面，无处可躲。" },
    { id: "kf_tangmen_du", name: "百毒不侵体", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 130,
      moveType: "防御",
      desc: "唐门弟子自幼以毒淬体，小剂量百毒日日服，练出一副抗毒的筋骨。运功时体表渗出一层薄汗，带微苦药气——毒物近身先被这层汗化去三分。不是解毒，是毒到了跟前就矮了三分。",
      passiveBonus: { maxHp: 15 },
      unlock: { faction: "唐门", rep: 40, member: true, guestRep: 80, note: "需正式拜入唐门且声誉 ≥ 40（外客须声誉 ≥ 80 方可求教）" } },
    {
      id: "kf_tm_fuguang", name: "浮光掠竹步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 130,
      moveType: "状态",
      passiveBonus: { speedBonus: 1 },
      unlock: { faction: "唐门", rep: 15, member: false, note: "唐门声誉 ≥ 15" },
      desc: "蜀南竹海里踩着暗桩练出的诡谲身法，步幅极碎，忽左忽右，专挑对手视野盲区落脚。练成后衣摆贴腿不扬尘，连吊桥上的九枚警铃都震不响。",
    },
    {
      id: "kf_tm_cuogu", name: "千机错骨针", type: SKILL_TYPE.MOVE, quality: "橙", price: 420,
      moveType: "攻击",
      applyStatus: "剧毒", statusChance: 0.5, ignoreDefenseRatio: 0.2,
      unlock: { faction: "唐门", rep: 80, member: true, note: "需正式拜入唐门且声誉 ≥ 80" },
      desc: "内堂秘传的重手毒针，专打周身关节筋膜。针入皮肉不流血，只觉半边身子渐如灌铅，三息之后气力大减。唐老太严令此针只准对付死敌，绝不许用来欺压市井。",
    },
    {
      id: "kf_tm_tianluo", name: "天罗绣影针", type: SKILL_TYPE.MOVE, quality: "红", price: 680,
      moveType: "攻击",
      forceCrit: { multiplier: 1.65 }, ignoreDefenseRatio: 0.45, applyStatus: "剧毒", statusChance: 0.4,
      unlock: { faction: "唐门", rep: 100, member: true, quest: ["tangmen_5_jiaguichujian"], note: "需正式拜入唐门、完成「唐5·家法断机」且唐门声誉 ≥ 100" },
      desc: "唐老太压箱底的镇派绝学。寻常一根三寸银绣针，在七十岁老手捻动下竟如穿花织锦，针尾牵着肉眼难辨的冰蚕细丝，一去一回皆有后手——外人只道她是在纳鞋底，等看见针影，胸口已缝好了三道血线。",
    },
  ];
