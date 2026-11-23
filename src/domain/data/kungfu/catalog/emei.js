// 武学目录·峨眉（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const emei = [
    {
      id: "kf_rec_jinding", name: "金顶观日", type: SKILL_TYPE.MOVE, quality: "蓝", price: 135,
      unlock: { faction: "峨眉派", rep: 0, member: false, note: "峨眉派声誉 ≥ 0，无需拜入" },
      moveType: "状态",
      energyRestore: 6, hpRestore: 0.10,
      desc: "天不亮上金顶，等云海底下那一线红。等的时候不许动，冻得发抖也不许动。日头出来那一刻吸一口气——师太说那口气跟别的时辰不一样，「你自己会知道」。",
    },
    {
      id: "kf_rec_xiaozhuang", name: "十二庄·小庄息", type: SKILL_TYPE.MOVE, quality: "紫", price: 210,
      unlock: { faction: "峨眉派", rep: 40, member: false, note: "峨眉派声誉 ≥ 40，虚白道姑传授" },
      moveType: "状态",
      energyRestore: 8, nextAttackBonus: 0.25,
      desc: "十二庄里最短的一庄，只换一个站姿。虚白道姑演示给你看，你没看出哪里变了，但她说气已经归了位。「下一下你自己使使看。」",
    },
    {
      id: "kf_ting_foguang", name: "听桥·佛光", type: SKILL_TYPE.MOVE, quality: "橙", price: 0,
      unlock: { faction: "峨眉派", rep: 40, member: true, note: "峨眉派声誉 ≥ 40 且正式拜入峨眉" },
      moveType: "防御",
      onCounterSuccessEnergyGain: 6, doubleReflectDamage: true,
      desc: "峨眉不外传的听桥。双掌合什立于身前，来力撞上去像撞庙墙——墙不动，撞的人自己先受不住。玄尘师太说这一式的关键不在手上，「在你信不信那堵墙」。",
    },
    {
      id: "kf_emei_tongbei", name: "峨眉通臂拳", type: SKILL_TYPE.MOVE, quality: "白", price: 18,
      unlock: { faction: "峨眉派", rep: 0, member: false, note: "峨眉派声誉 ≥ 0，司徒瑛传授，无需拜入" },
      moveType: "攻击",
      lowHpBonus: 0.25,
      desc: "峨眉最老的一门，托名白猿祖师司徒玄空所创。相传他在山中看灵猴攀援腾挪看了十年，把猴子怎么甩臂、怎么借腰劲写成了拳。招式看着不雅相，肩臂甩得很开，但打人极疼——猴子打架从来不讲好看。",
    },
    {
      id: "kf_emei_jian", name: "峨眉剑法", type: SKILL_TYPE.MOVE, quality: "绿", price: 55,
      unlock: { faction: "峨眉派", rep: 15, member: false, note: "峨眉派声誉 ≥ 15（颇具善缘）" },
      moveType: "攻击",
      nullifyStatusOnHit: true,
      desc: "峨眉入门剑法，三十六式，式式带禅意。剑走轻灵不尚蛮力，剑尖画出的轨迹如梵文种子字——看似随意，实则每一笔都有定数。女子使来如飞天散花，男子使来如老僧扫地。",
    },
    {
      id: "kf_emei_jieshou", name: "截手九式", type: SKILL_TYPE.MOVE, quality: "绿", price: 48,
      unlock: { faction: "峨眉派", rep: 15, member: false, prestige: 0, note: "峨眉派声誉 ≥ 15 且威望 ≥ 0" },
      moveType: "防御",
      onCounterSuccessDamageRatio: 0.35,
      desc: "峨眉掌法里最不起眼的一门，专管「接」。对方拳来掌来兵刃来，九式各截一路，截住就完，不追不打。了因师太说这九式是给新弟子保命用的——「你先学会不挨打，再谈打人。」",
    },
    {
      id: "kf_emei_piaoxue", name: "飘雪穿云掌", type: SKILL_TYPE.MOVE, quality: "蓝", price: 105,
      unlock: { faction: "峨眉派", rep: 15, member: false, note: "峨眉派声誉 ≥ 15（颇具善缘）" },
      moveType: "攻击",
      ignoreDefenseRatio: 0.3,
      desc: "掌风轻柔得像拂脸上的雪，挨着不疼，退开三步才觉得胸口发闷。峨眉五峰发力里最见功夫的一门——力不出在掌上，出在肩肘之间那一寸转折里，看的人只看见袖子动了动。",
    },
    {
      id: "kf_emei_zhi", name: "兰花拂穴手", type: SKILL_TYPE.MOVE, quality: "蓝", price: 100,
      unlock: { faction: "峨眉派", rep: 40, member: true, note: "峨眉派声誉 ≥ 40 且正式拜入峨眉" },
      moveType: "状态",
      applyStatus: "麻穴", statusChance: 0.55,
      desc: "六大专修功里指穴功一路。五指如兰花绽放，指尖点出带一股柔劲，不伤皮肉专封经脉。被点中的人不疼，但半边身子动不了。解法只有两个：等两个时辰自行散开，或者让峨眉的人再点一下。",
    },
    {
      id: "kf_emei_qingxin", name: "清心普善咒", type: SKILL_TYPE.MOVE, quality: "蓝", price: 130,
      unlock: { faction: "峨眉派", rep: 40, member: false, prestige: 0, note: "峨眉派声誉 ≥ 40（门墙之交）且威望 ≥ 0，了因师太传授" },
      // 原写 moveType:"疗伤"，但上阵槽只有攻击/防御/状态三格（deriveMovesetFromSkills
      // 就按这三类找 active 武学），疗伤压根匹配不上——这门买了也永远上不了阵。
      // 改挂状态槽，回血靠 hpRestore（resolveTurn 本就按最大气血比例结算），
      // 「高效回血」是真的回，不是描述。
      moveType: "状态",
      hpRestore: 0.18,
      desc: "不是打人的功夫，是救人的。默诵咒文导气归经，血止得快，断骨接得齐。了因师太在佛堂教这个，来学的一半是弟子，一半是城里的郎中。她从不收郎中的钱——「你们治的人比我多。」",
    },
    {
      id: "kf_emei_foguang", name: "佛光普照", type: SKILL_TYPE.MOVE, quality: "紫", price: 185,
      unlock: { faction: "峨眉派", rep: 80, member: false, prestige: 20, note: "峨眉派声誉 ≥ 80（股肱心腹）且威望 ≥ 20" },
      moveType: "防御",
      doubleReflectDamage: true,
      desc: "峨眉掌法巅峰一门。双掌合什再分开，掌心朝外一推，来力像撞在庙墙上——墙不动，撞的人手疼。金顶云海上日出时佛光现，看的人都说那是菩萨显圣；练成这门的人知道，那不过是光碰上了雾。",
    },
    {
      id: "kf_emei_huifeng", name: "回风拂柳剑", type: SKILL_TYPE.MOVE, quality: "紫", price: 210,
      unlock: { faction: "峨眉派", rep: 80, member: true, note: "峨眉派声誉 ≥ 80（股肱心腹）且正式拜入峨眉" },
      moveType: "状态",
      confuseChance: 0.5, afterCounterBonus: 0.35,
      desc: "峨眉代表剑法。剑不直去，走的是回旋的路子，一剑荡开对方兵刃，剑势不停顺势卷回来，像风过柳梢那一下回摆。对手往往是被自己格挡的余力带偏的——你使多大劲挡，就被带出多远。",
    },
    {
      id: "kf_emei_shierzhuang", name: "峨眉十二庄", type: SKILL_TYPE.NEIGONG, quality: "紫", price: 195,
      unlock: { faction: "峨眉派", rep: 80, member: true, note: "正式拜入峨眉且峨眉派声誉 ≥ 80，玄尘与虚白合传" },
      moveType: "防御",
      desc: "南宋白云禅师融医理入武创下的核心内功，天地之人心龙鹤风云大小幽明十二庄，一庄一桩一诀。动静双修，站桩时不动如山，行气时又要求周身关节皆活。练全的人极少——虚白道姑站到第九庄用了二十二年。",
      passiveBonus: { maxHp: 26 },
    },
    {
      id: "kf_emei_hubu", name: "虎步功", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 52,
      moveType: "状态",
      desc: "六大专修功之一。名叫虎步却不是猛冲，讲的是落脚——脚掌先着地再压脚跟，重心始终吊在两腿之间，随时能转向。在金顶石阶上练，下雨天不许扶栏杆。",
      passiveBonus: { speedBonus: 1 },
    },
    {
      id: "kf_emei_jiuyang", name: "峨嵋九阳功", type: SKILL_TYPE.NEIGONG, quality: "橙", price: 0,
      moveType: "防御",
      desc: "镇派内功，相传自《九阳真经》残卷中悟出，只得三成而已——但这三成已经够峨眉立派数百年。行功时周身发热，冬日盘坐雪地上，坐处一圈雪自行化去。掌门口传心授，不入剑庐的武学榜，也从不标价。",
      passiveBonus: { maxHp: 45 },
    },
  ];
