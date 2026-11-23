// 武学目录·黑风（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const heifeng = [
    {
      id: "kf_hf_duanshui", name: "断水刀", type: SKILL_TYPE.MOVE, quality: "绿", price: 50,
      moveType: "攻击",
      highHpBonus: 0.2,
      unlock: { faction: "黑风寨", rep: 0, member: false, note: "无需入伙，黑风寨声誉 ≥ 0（演武坪可学）" },
      desc: "黑风寨入门刀法，厚背刀借势下压，一刀断水——断的是对手刚起的手。彭措教这门时总说：「刃不用磨太利，分量够了，砸下去比劈下去实在。」",
    },
    {
      id: "kf_hf_tangzi", name: "趟子手摔法", type: SKILL_TYPE.MOVE, quality: "绿", price: 45,
      moveType: "攻击",
      applyStatus: "麻穴", statusChance: 0.35,
      unlock: { faction: "黑风寨", rep: 0, member: false, note: "无需入伙，黑风寨声誉 ≥ 0（演武坪可学）" },
      desc: "鹰曲马帮趟子手的缠摔把式：贴身上去别腕拧腰，把人撂倒不算完，顺手还压一穴。彭措走镖时靠它制服过三回劫道的——「摔出去的是人，留住的是命。」",
    },
    {
      id: "kf_hf_zouma", name: "狼曲走马", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 110,
      moveType: "状态",
      passiveBonus: { speedBonus: 1 },
      unlock: { faction: "黑风寨", rep: 15, member: false, note: "黑风寨声誉 ≥ 15（颇具善缘）" },
      desc: "在狼曲河谷乱石滩上练出来的身法，步点像马趟浅水——看着慢，实则每一步都踩在最实的石头上。寨里人过河谷如履平地，追兵的坐骑倒先崴了脚。",
    },
    {
      id: "kf_hf_xiongqi", name: "熊山硬气功", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 135,
      moveType: "防御",
      passiveBonus: { maxHp: 15 },
      unlock: { faction: "黑风寨", rep: 15, member: false, note: "黑风寨声誉 ≥ 15（颇具善缘）" },
      desc: "寨里老人传的笨功夫：天不亮对着熊山风口站桩吐纳，把一口硬气养进筋骨里。不花哨，挨打的时候才知道值多少。老阿雅婶说练这个的人冬天不咳嗽。",
    },
    {
      id: "kf_hf_zhigui", name: "寨规三刀", type: SKILL_TYPE.MOVE, quality: "紫", price: 230,
      moveType: "攻击",
      ignoreDefenseRatio: 0.25, applyMark: { name: "内伤", stacks: 1, max: 5 },
      unlock: { faction: "黑风寨", rep: 40, member: false, note: "黑风寨声誉 ≥ 40（门墙之交）" },
      desc: "三刀对应寨规三条：一刀封退路、二刀落兵器、三刀点到为止。巴桑定下规矩——第三刀永远停在对手咽喉前三寸。会这三刀的人，都知道分寸比刀快重要。",
    },
    {
      id: "kf_hf_shisanduan", name: "黑风十三断", type: SKILL_TYPE.MOVE, quality: "橙", price: 420,
      moveType: "攻击",
      highHpBonus: 0.15, applyMark: { name: "内伤", stacks: 2, max: 5 },
      unlock: { faction: "黑风寨", rep: 80, member: true, guestRep: 100, note: "需入伙黑风寨且声誉 ≥ 80（外客须声誉 ≥ 100 一代尊宿方可求教）" },
      desc: "巴桑压箱底的连环刀，十三断断的是土司府巡捕营的合围阵——当年一道旧疤换来的十三年琢磨。刀势如狼曲河谷的乱风，起手无定处，收手必留人一命。",
    },
  ];
