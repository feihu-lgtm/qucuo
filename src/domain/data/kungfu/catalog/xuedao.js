// 武学目录·血刀（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const xuedao = [
    {
      id: "kf_rec_chuoxue", name: "啜血还气", type: SKILL_TYPE.MOVE, quality: "橙", price: 80,
      moveType: "状态",
      energyRestore: 12,
      desc: "血刀门的路子：把干在指缝里的血痂抠下来吃了。气回得极快，快到不像人该有的速度。厉天行说这没什么讲究，「你饿了会吃饭，我这就是吃饭」。",
      unlock: { faction: "天龙教", rep: 0, member: false, note: "非敌对即可在磨刀坪学" },
    },
    {
      id: "kf_rec_daoxiu", name: "刀锈入喉", type: SKILL_TYPE.MOVE, quality: "紫", price: 180,
      moveType: "状态",
      energyRestore: 8, forceCrit: { multiplier: 1.35 },
      desc: "舔一下刀背。铁锈味混着别人的血腥味压在舌根，恶心，但眼睛会红。红了之后下一刀的分量不一样——这门功夫从不解释为什么。",
      unlock: { faction: "天龙教", rep: 15, member: false, note: "天龙教声誉 ≥ 15（厉天行另眼相看者亦可求教）" },
    },
    { id: "kf_xuedao", name: "血刀大法", type: SKILL_TYPE.MOVE, quality: "橙", price: 480,
      // hpRestore 是招式层已经跑通的字段（resolveTurn 里按最大气血比例结算），
      // 设计稿原写的 lifesteal（按实际伤害比例吸血）全项目没有接线，写了也不生效，
      // 所以这里落在 hpRestore 上——"砍中就回一口"的观感一样，但它是真的会回血。
      hpRestore: 0.06,
      moveType: "攻击",
      desc: "以血养刀，以杀证道。每一刀劈出都带着铁锈般的血腥气，砍中对手时刀身会吸——不是吸肉，是吸气。被砍中的人伤口愈合极慢，而持刀者面色红润。练到极处，一刀下去，对手瘦一圈，你胖一圈。",
      passiveBonus: { maxHp: 10 },
      unlock: { faction: "天龙教", rep: 80, member: true, note: "需拜入天龙教且声誉 ≥ 80（门人秘传，外客不可求教）" } },
  ];
