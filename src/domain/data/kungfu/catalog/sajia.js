// 武学目录·萨迦（花门 · 丹霞城金轮武馆，5 门）
import { SKILL_TYPE } from "../skillType.js";

export const sajia = [
  {
    id: "kf_sajia_bianjian", name: "班智达辩剑", type: SKILL_TYPE.MOVE, quality: "绿", price: 70,
    moveType: "攻击",
    nextAttackBonus: 0.18,
    unlock: { faction: "萨迦世家", rep: 0, member: false, note: "萨迦世家声誉 ≥ 0（外客可在金轮武馆请教）" },
    desc: "萨迦子弟「先论理、后论剑」的入门剑法。出剑前左手击右掌啪的一响，剑路如因明推论环环相扣，对手若在招理上先输半筹，三剑必失先机。",
  },
  {
    id: "kf_sajia_wulun", name: "五轮大转法", type: SKILL_TYPE.MOVE, quality: "蓝", price: 165,
    moveType: "攻击",
    ignoreDefenseRatio: 0.28,
    unlock: { faction: "萨迦世家", rep: 15, member: false, note: "萨迦世家声誉 ≥ 15（颇具善缘）" },
    desc: "大轮法王卓玛嘉独步西域的飞轮绝技。以内劲御使金、银、铜、铁、铅五轮，绕着院中石柱弧线回旋，正砸胸膛、背削后心，风雷激荡防不胜防。",
  },
  {
    id: "kf_sajia_jingangqiang", name: "三色金刚墙", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 180,
    moveType: "防御",
    passiveBonus: { maxHp: 24 },
    immuneControl: true,
    unlock: { faction: "萨迦世家", rep: 40, member: false, note: "萨迦世家声誉 ≥ 40（门墙之交）" },
    desc: "将丹霞城三色花墙与三十六根巨石方柱的沉厚气象化入呼吸，下盘稳若磐石，万钧掌力撞上亦如泥牛入海。",
  },
  {
    id: "kf_sajia_longxiang", name: "龙象十叠劲", type: SKILL_TYPE.MOVE, quality: "紫", price: 320,
    moveType: "攻击",
    forceCrit: { multiplier: 1.65 },
    unlock: { faction: "萨迦世家", rep: 80, member: true, note: "需拜入萨迦世家且声誉 ≥ 80" },
    desc: "每练一层便增一龙一象之力，十层叠满后一掌推出毫无花巧，纯粹以排山倒海的十叠巨力正面轰碎敌方兵刃与护体罡气。",
  },
  {
    id: "kf_sajia_daoguo", name: "道果大威德功", type: SKILL_TYPE.NEIGONG, quality: "橙", price: 540,
    moveType: "防御",
    passiveBonus: { maxHp: 48, speedBonus: 1 },
    unlock: { faction: "萨迦世家", rep: 100, member: true, note: "需拜入萨迦世家且声誉 ≥ 100（昆氏镇城绝学）" },
    desc: "昆氏叔侄单传的镇城绝学。入门首日便将武道终点的「大威德果位」全图倾囊相授，因从起手第一息就知晓终点所在，真气运转一步即达化境。",
  },
];
