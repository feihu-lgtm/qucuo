import { SKILL_TYPE } from "./qucuoKungfu.js";

export const STARTER_SKILLS = [
  {
    id: "kf_start_yeqiu", name: "野球拳", type: SKILL_TYPE.MOVE, quality: "绿", price: 0,
    moveType: "攻击", lowHpBonus: 0.25,
    desc: "街口混混教的拳法，架势唬人，真打起来倒也不含糊。挨了几下再还手，旁人就笑不出来了。",
  },
  {
    id: "kf_start_taifanshou", name: "讨饭手", type: SKILL_TYPE.MOVE, quality: "绿", price: 0,
    moveType: "防御", dodgeChance: 0.3, stealOnDodge: 0.5,
    desc: "讨饭先看人眼色，练久了连拳脚也能看出破绽。躲开之后顺手一摸，算是行走江湖的添头。",
  },
  {
    id: "kf_start_houtao", name: "猴子偷桃", type: SKILL_TYPE.MOVE, quality: "绿", price: 0,
    moveType: "攻击", applyStatus: "麻穴", statusChance: 0.35,
    desc: "山里泼猴打架偷来的灵感，招不大雅，倒是快得很。对手要是捂住要害，后头就顾不上了。",
  },
  {
    id: "kf_start_chunfeng", name: "春风化雨", type: SKILL_TYPE.MOVE, quality: "绿", price: 0,
    moveType: "状态", hpRestore: 0.12, energyRestore: 3,
    desc: "卖草药的老头教的调息法，名字起得比人温柔。吐纳几轮，身上那点疼和胸口那口气都缓过来些。",
  },
  {
    id: "kf_start_wangba", name: "王八拳", type: SKILL_TYPE.MOVE, quality: "绿", price: 0,
    moveType: "攻击", forceCrit: { multiplier: 1.35 },
    desc: "没章法，没师承，挨打时还缩脖子。可一旦抡圆了胳膊，连挨过的那几下都算没白挨。",
  },
  {
    id: "kf_start_saotang", name: "扫堂腿", type: SKILL_TYPE.MOVE, quality: "绿", price: 0,
    moveType: "攻击", ignoreDefenseRatio: 0.25,
    desc: "乡间摔跤手最爱使的绊子，专挑脚下下手。你站得再稳，裤脚也得先沾一身土。",
  },
  {
    id: "kf_start_ludagun", name: "驴打滚", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 0,
    moveType: "轻功", passiveBonus: { speedBonus: 1 },
    desc: "看驴子在坡上打滚学来的步法，先滚出去再说。姿势不大体面，脚底下倒轻快不少。",
  },
  {
    id: "kf_start_tietou", name: "铁头功", type: SKILL_TYPE.NEIGONG, quality: "绿", price: 0,
    moveType: "内功", passiveBonus: { maxHp: 10 },
    desc: "街头卖艺的硬功，先从撞木桩练起。练得久了脑袋未必更聪明，挨打时确实更扛得住。",
  },
  {
    id: "kf_start_shaodaozi", name: "烧刀子吐纳", type: SKILL_TYPE.MOVE, quality: "绿", price: 0,
    moveType: "状态", energyRestore: 6, nextAttackBonus: 0.2,
    desc: "边地汉子喝烈酒前先练的吐纳，辣气顺喉咙直落丹田。喘匀了这口气，下一拳自然更有劲。",
  },
  {
    id: "kf_start_goupa", name: "狗爬式", type: SKILL_TYPE.MOVE, quality: "绿", price: 0,
    moveType: "防御", ignoreDefensePartialImmune: 0.3,
    desc: "落水狗扑腾两下竟让岸上的人看出了门道，后来就成了这套怪架子。看着狼狈，真挨上时还挺能卸力。",
  },
];
