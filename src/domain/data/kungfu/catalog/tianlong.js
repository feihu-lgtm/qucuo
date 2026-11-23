// 武学目录·天龙（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const tianlong = [
    {
      id: "kf_tl_xifengbu", name: "西风踏沙步", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 85,
      moveType: "状态",
      passiveBonus: { speedBonus: 1 },
      desc: "西风隘的孩子五岁就学这个：沙地上一错步，人借着风势滑出去半丈。厉苍龙说这不是轻功，是「不给风添麻烦」。",
      unlock: { faction: "天龙教", rep: 0, member: false, note: "非敌对即可在西风演武场学" },
    },
    {
      id: "kf_tl_shahuang", name: "沙暴震岳拳", type: SKILL_TYPE.MOVE, quality: "蓝", price: 160,
      moveType: "攻击",
      forceCrit: { multiplier: 1.35 },
      desc: "玄甲军的正拳。出拳不快，像沙暴先压过来再砸下来——架住的觉得手麻，没架住的觉得地晃。",
      unlock: { faction: "天龙教", rep: 15, member: false, note: "天龙教声誉 ≥ 15" },
    },
    {
      id: "kf_tl_zhigezhang", name: "止戈印", type: SKILL_TYPE.MOVE, quality: "紫", price: 280,
      moveType: "防御",
      energyRestore: 6,
      desc: "白衣旧部传下来的手印：掌心朝外一推，来势在掌前硬生生顿住——不是挡，是让对方自己停下来。天王说止戈为武，旧部说那是天王一个人的武。",
      unlock: { faction: "天龙教", rep: 40, member: false, note: "天龙教声誉 ≥ 40（止戈经帐与天王旧部认可）" },
    },
    {
      id: "kf_tl_longyuan", name: "龙渊霸世劲", type: SKILL_TYPE.MOVE, quality: "橙", price: 520,
      moveType: "攻击",
      forceCrit: { multiplier: 1.5 },
      desc: "厉苍龙压箱底的劲。劲发时人不像在打人，像整条西风隘压下来——盔甲、横练、招架，全都不作数，只作数一件事：你站不站得住。",
      unlock: { faction: "天龙教", rep: 80, member: true, note: "需拜入天龙教且声誉 ≥ 80（门人秘传，外客不可求教）" },
    },
    {
      id: "kf_tl_babujing", name: "八部天龙经", type: SKILL_TYPE.NEIGONG, quality: "红", price: 980,
      moveType: "防御",
      passiveBonus: { maxHp: 70 },
      desc: "天龙教镇教内功，只此一册，在断崖石室的老天王手里。八层关隘层层相扣，练到深处气脉自行周天——教里传说，练成它的人才能真正统合玄甲与白衣两脉。",
      unlock: { faction: "天龙教", rep: 100, member: true, quest: ["tianlong_5_baiqizhige"], note: "需拜入天龙教且声誉 ≥ 100（镇教经卷，还须天5 之局了结后由厉苍天亲传）" },
    },
  ];
