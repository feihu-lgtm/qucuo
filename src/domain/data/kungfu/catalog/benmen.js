// 武学目录·苯门（黑门 · 琼隆古墟琼鸟九乘武馆，5 门）
import { SKILL_TYPE } from "../skillType.js";

export const benmen = [
  {
    id: "kf_benmen_duoma", name: "朵玛奔牛劲", type: SKILL_TYPE.MOVE, quality: "绿", price: 75,
    moveType: "攻击",
    ignoreDefenseRatio: 0.22,
    unlock: { faction: "古象雄苯门", rep: 0, member: false, note: "古象雄苯门声誉 ≥ 0（外客可在琼鸟九乘武馆请教）" },
    desc: "随手探入腰间皮囊，将青稞糌粑与酥油一捏一揉化作棱角分明的小牦牛（朵玛），灌入内劲脱手飞出，声如奔雷、劲似真牛撞胸。",
  },
  {
    id: "kf_benmen_zuoxuanbu", name: "左旋对转步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 155,
    moveType: "状态",
    passiveBonus: { speedBonus: 2 },
    unlock: { faction: "古象雄苯门", rep: 15, member: false, note: "古象雄苯门声誉 ≥ 15（颇具善缘）" },
    desc: "终身逆时针转山磨出的左旋身法，迎面「对转」时肩肘一拧便挤入对手最难招架的左外死角。",
  },
  {
    id: "kf_benmen_jiugong", name: "九宫算路手", type: SKILL_TYPE.MOVE, quality: "蓝", price: 190,
    moveType: "防御",
    onCounterSuccessDamageRatio: 0.4,
    onCounterSuccessEnergyGain: 4,
    unlock: { faction: "古象雄苯门", rep: 40, member: false, note: "古象雄苯门声誉 ≥ 40（门墙之交）" },
    desc: "前四乘卜算武道，凭风向、鞋印与肩骨起落提前半息算准对方下一刀来路，刀未至而铁钎已封死落点。",
  },
  {
    id: "kf_benmen_dapengzhua", name: "象雄大鹏爪", type: SKILL_TYPE.MOVE, quality: "紫", price: 330,
    moveType: "攻击",
    forceCrit: { multiplier: 1.65 },
    ignoreDefenseRatio: 0.3,
    unlock: { faction: "古象雄苯门", rep: 80, member: true, note: "需拜入古象雄苯门且声誉 ≥ 80" },
    desc: "掘藏师从三百年前岩缝铜匣刨出的古象雄搏击术，戴黑木琼鸟面具施展时双臂如金翅大鹏裂石抓铁，专扣琵琶骨与护体气门。",
  },
  {
    id: "kf_benmen_honghua", name: "九乘虹化大圆满", type: SKILL_TYPE.NEIGONG, quality: "橙", price: 550,
    moveType: "防御",
    passiveBonus: { maxHp: 45, speedBonus: 1 },
    hpRestore: 0.15,
    unlock: { faction: "古象雄苯门", rep: 100, member: true, note: "需拜入古象雄苯门且声誉 ≥ 100（古塑腹中九乘至高心法）" },
    desc: "从古塑腹中刨出的九乘至高心法，周身真气澄澈如雪山虹雾，化去敌方十成死力并借势回元。",
  },
];
