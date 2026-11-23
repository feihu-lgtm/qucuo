// 武学目录·五仙（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const wuxian = [
    {
      id: "kf_wx_tingchong", name: "听虫吐纳", type: SKILL_TYPE.MOVE, quality: "绿", price: 65,
      moveType: "状态",
      energyRestore: 5, hpRestore: 0.04,
      unlock: { faction: "五仙教", rep: 0, member: false, note: "无需拜师，五仙教声誉 ≥ 0（演武坪可学）" },
      desc: "苗疆入门吐纳法：闭目听草间虫鸣，以虫息定人息。瘴气再浓的地界，运起这门功也能把肺里那口浊气一点点换出去。苏小青说难的不是学，是敢不敢真的什么都不看、只靠耳朵。",
    },
    {
      id: "kf_wx_yinshe", name: "银蛇绕腕", type: SKILL_TYPE.MOVE, quality: "绿", price: 58,
      moveType: "攻击",
      applyStatus: "淬毒", statusChance: 0.4,
      unlock: { faction: "五仙教", rep: 0, member: false, note: "无需拜师，五仙教声誉 ≥ 0（演武坪可学）" },
      desc: "五仙教入门鞭缠手法，腕上劲走螺旋，缠上兵器或手腕一拧一带，指缝里藏的草粉就抹进对方伤口。阿萝教这招时说：「疼是不疼的，就是过会儿你胳膊就不是你的了。」",
    },
    {
      id: "kf_wx_talan", name: "踏岚步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 115,
      moveType: "状态",
      passiveBonus: { speedBonus: 1 },
      unlock: { faction: "五仙教", rep: 15, member: false, note: "五仙教声誉 ≥ 15（颇具善缘）" },
      desc: "踩着瘴气的边走的轻功。紫岚瘴低处浓高处薄，练熟了的人专挑雾气断层里落足，远远看去像贴着雾面滑行。龙汐月使起来赤足点露，裙角都不带湿的。",
    },
    {
      id: "kf_wx_yanggu", name: "五仙养蛊经", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 140,
      moveType: "防御",
      passiveBonus: { maxHp: 15 },
      unlock: { faction: "五仙教", rep: 15, member: false, note: "五仙教声誉 ≥ 15（颇具善缘）" },
      desc: "以自身气血温养母蛊的养炼法门：蛊在经脉里走得越顺，人越扛得住毒与伤痛。乌婆婆传了半辈子，总念叨「医毒同源，养的是蛊，护的是人」。",
    },
    {
      id: "kf_wx_chiwu", name: "赤蜈缠丝鞭", type: SKILL_TYPE.MOVE, quality: "紫", price: 240,
      moveType: "攻击",
      applyStatus: "剧毒", statusChance: 0.35, ignoreDefenseRatio: 0.25,
      unlock: { faction: "五仙教", member: true, guestRep: 40, note: "需正式拜入五仙教，或五仙教声誉 ≥ 40（门墙之交）" },
      desc: "赤蜈堂鞭法正解。鞭身浸过百年毒油，抖直了穿甲破防如蜈蚣钻土，缠住了又软得卸不掉。麻九娘使的是阴毒变式，龙汐月使的是堂堂正正的快——同一条鞭子，两样心肠。",
    },
    {
      id: "kf_wx_jincan", name: "金蚕脱壳", type: SKILL_TYPE.MOVE, quality: "紫", price: 260,
      moveType: "防御",
      dispelSelf: true, nextAttackBonus: 0.2,
      unlock: { faction: "五仙教", member: true, guestRep: 40, note: "需正式拜入五仙教且声誉 ≥ 40（门墙之交）" },
      desc: "金蚕蛊代主受过：中招的瞬间蛊蜕替你吞了毒与点穴，人借那一蜕的力道滑出半步。蛊蜕一枚要养三个月——所以乌婆婆说，这招是用来保命的，不是用来逞能的。",
    },
    {
      id: "kf_wx_dudian", name: "五仙毒典·万蛊归宗", type: SKILL_TYPE.NEIGONG, quality: "橙", price: 480,
      moveType: "状态",
      passiveBonus: { maxHp: 30, speedBonus: 1 },
      unlock: { faction: "五仙教", member: true, guestRep: 80, quest: ["wuxianjiao_5_yingguandingtan"], note: "需正式拜入五仙教且声誉 ≥ 80，并完成主线《蛊5·银冠定坛》得传毒典正解" },
      desc: "《五仙毒典》上下卷合一的镇派内功，万蛊听令、百毒不侵。老教主当年凭它在昆明城外一人压服三派围攻——练成者气血如蛊潮生生不息，毒物入身反成滋养。",
    },
  ];
