// 武学目录·欢喜（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const huanxi = [
    {
      id: "kf_huanxi_xunxiang", name: "熏香换气", type: SKILL_TYPE.MOVE, quality: "绿", price: 65,
      moveType: "状态",
      energyRestore: 6, hpRestore: 0.06,
      unlock: { faction: "欢喜教", rep: 0, member: false, note: "无需拜入，欢喜教声誉 ≥ 0" },
      desc: "天都香行伙计熬夜捣香粉练出来的吐纳法子——满屋辛辣烟气里不屏息，反而顺着甜味把浊气往下压，压到丹田再一吐。李掌柜说这功夫不打人，专治「站一天柜台腿肚子转筋」。",
    },
    {
      id: "kf_huanxi_jinlun", name: "伽罗转手", type: SKILL_TYPE.MOVE, quality: "绿", price: 85,
      moveType: "防御",
      onCounterSuccessEnergyGain: 3, onCounterSuccessDamageRatio: 0.25,
      unlock: { faction: "欢喜教", rep: 15, member: false, note: "欢喜教声誉 ≥ 15" },
      desc: "梵衍那从天竺带来的旧摔擒手法，不跟人硬碰骨头，顺着对方来拳拧腕画半个圆，像老何在洱海里用船桨拨暗礁。挡住了不吃亏，还能顺手偷一口气回来。",
    },
    {
      id: "kf_huanxi_tanchen", name: "身坛养息诀", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 145,
      moveType: "防御",
      passiveBonus: { maxHp: 18 },
      unlock: { faction: "欢喜教", rep: 15, member: false, note: "欢喜教声誉 ≥ 15" },
      desc: "欢喜教「身即坛城」的根基心法。以药香熏脉、以内息暖脏，练久了寻常迷烟毒雾近身只觉微甜，不仅气血见长，连阿雅新调的三息醉也得多吸两口才倒。",
    },
    {
      id: "kf_huanxi_huanbu", name: "踏香游步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 165,
      moveType: "状态",
      passiveBonus: { speedBonus: 2 },
      unlock: { faction: "欢喜教", rep: 40, member: false, note: "欢喜教声誉 ≥ 40" },
      desc: "罗琦把大理山民走藤桥的脚法和天竺舞步揉在了一处。脚尖点地轻得像香灰落地，进退之间带起一股极淡的甜风，等对手闻出味不对，人已经绕到了后背。",
    },
    {
      id: "kf_huanxi_milezhang", name: "弥香醉骨掌", type: SKILL_TYPE.MOVE, quality: "紫", price: 270,
      moveType: "攻击",
      ignoreDefenseRatio: 0.2, applyStatus: "麻穴", statusChance: 0.3,
      unlock: { faction: "欢喜教", rep: 40, member: true, note: "需正式拜入欢喜教，且欢喜教声誉 ≥ 40" },
      desc: "出掌前先以指缝暗藏的药脂抹过掌心，劲风扑面时裹着一层暖融融的甜香。挨上一掌当下不觉多疼，两息之后四肢却像泡在热汤里发软，想架招都慢半拍。",
    },
    {
      id: "kf_huanxi_leshi", name: "乐施无碍印", type: SKILL_TYPE.MOVE, quality: "橙", price: 420,
      moveType: "防御",
      onCounterSuccessEnergyGain: 5, onCounterSuccessDamageRatio: 0.55, immuneControl: true,
      unlock: { faction: "欢喜教", rep: 80, member: true, note: "需正式拜入欢喜教且声誉 ≥ 80" },
      desc: "罗琦独悟的护身绝学，取教义「乐施即乐得」之意。对手打来多狠的劲，她便眉眼含笑地全盘笑纳，顺势递回去一半还带利息。她常说：「让人先占了便宜，他才肯把破绽露全。」",
    },
    {
      id: "kf_huanxi_jialuo", name: "伽罗欢喜禅功", type: SKILL_TYPE.NEIGONG, quality: "红", price: 680,
      moveType: "状态",
      passiveBonus: { maxHp: 45, speedBonus: 1 },
      immuneControl: true,
      unlock: { faction: "欢喜教", rep: 100, member: true, note: "需正式拜入欢喜教且声誉满 100" },
      desc: "天竺伽罗王族秘传的镇派心法，原本是给亡国流亡者在绝境里续命的法门。以极烈之意催极静之气，运转时周身如覆无形坛城，心神不为迷毒所乱，气血内息生生不息。",
    },
  ];
