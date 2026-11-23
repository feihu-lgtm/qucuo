// 武学目录·喇嘛庙（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const lamamiao = [
    {
      id: "kf_lama_zhuantong", name: "转经调息", type: SKILL_TYPE.MOVE, quality: "绿", price: 60,
      moveType: "状态",
      energyRestore: 6, hpRestore: 0.06,
      unlock: { faction: "喇嘛庙", rep: 0, member: false, note: "无门槛（喇嘛庙声誉 ≥ 0 即可在护法禅院请教）" },
      desc: "顺着大殿外一排铜经筒走一圈，左手拨筒、右手垂膝，每转三下换一口深气。洛桑说这门功夫最妙的地方在于「腿脚不停，喘气却先平了」，走一整天雪坡也不犯头晕。",
    },
    {
      id: "kf_lama_jingangzhang", name: "大雪金刚掌", type: SKILL_TYPE.MOVE, quality: "绿", price: 75,
      moveType: "攻击",
      ignoreDefenseRatio: 0.2,
      unlock: { faction: "喇嘛庙", rep: 15, member: false, note: "喇嘛庙声誉 ≥ 15（颇具善缘）" },
      desc: "雪域古刹流传最广的护院掌法，出手不求花哨，专讲究像屋檐积雪突然滑落那般沉实一砸。丹巴拿它拍松柴火，根敦拿它震散病人淤血，打在恶徒胸口则是闷雷一声。",
    },
    {
      id: "kf_lama_zhongming", name: "听钟·无畏", type: SKILL_TYPE.MOVE, quality: "蓝", price: 160,
      moveType: "防御",
      onCounterSuccessEnergyGain: 4, onCounterSuccessDamageRatio: 0.35, immuneControl: true,
      unlock: { faction: "喇嘛庙", rep: 15, member: false, quest: ["lamamiao_2_canjuanjiuhui"], note: "喇嘛庙声誉 ≥ 15，且完成主线「寺2·残卷与旧灰」" },
      desc: "与雪山「听雪」、青城「听桥」隐隐相通的一路守势。白塔古钟三十年未响，罗布桑却仍日日对着空钟练耳力——任你刀剑风声乱成一团，心中只认那一记嗡鸣，稳住下盘便顺势震回。",
    },
    {
      id: "kf_lama_xunshanbu", name: "雪岭苦行步", type: SKILL_TYPE.QINGGONG, quality: "蓝", price: 130,
      moveType: "状态",
      passiveBonus: { speedBonus: 1 },
      unlock: { faction: "喇嘛庙", rep: 40, member: false, note: "喇嘛庙声誉 ≥ 40（门墙之交）" },
      desc: "行脚僧常年在齐膝大雪里化缘磨出来的步法。不靠腾挪轻飘，胜在脚底发力稳如岩羊，深雪冰面如履平地，疾行百里而不散一口丹田热气。",
    },
    {
      id: "kf_lama_suyoudeng", name: "酥油长明诀", type: SKILL_TYPE.NEIGONG, quality: "蓝", price: 150,
      moveType: "防御",
      passiveBonus: { maxHp: 22 },
      unlock: { faction: "喇嘛庙", rep: 40, member: false, note: "喇嘛庙声誉 ≥ 40（门墙之交）" },
      desc: "达摩药堂一脉相传的养元内功，运息如殿前酥油灯芯，火苗不大、却熬得住漫长寒夜。根敦常拿它替自己和重病之人吊命，修成后气血浑厚，最耐持久苦战与寒毒侵蚀。",
    },
    {
      id: "kf_lama_fumo", name: "降魔杵法", type: SKILL_TYPE.MOVE, quality: "紫", price: 280,
      moveType: "攻击",
      forceCrit: { multiplier: 1.55 },
      unlock: { faction: "喇嘛庙", rep: 80, member: false, quest: ["lamamiao_3_xuenihongzhua"], note: "喇嘛庙声誉 ≥ 80（股肱心腹），且完成主线「寺3·雪泥鸿爪」" },
      desc: "白塔守塔僧团秘传的刚猛杀招，原本专配重杵使出，徒手运劲亦可化掌为杵、自上而下雷霆镇压。罗布桑说：「平日低眉是慈悲，可恶鬼上了山门，总得有人举起这根铁疙瘩。」",
    },
    {
      id: "kf_lama_budongxin", name: "不动明王禅", type: SKILL_TYPE.NEIGONG, quality: "橙", price: 480,
      moveType: "防御",
      passiveBonus: { maxHp: 45 },
      unlock: { faction: "喇嘛庙", rep: 100, member: false, note: "喇嘛庙声誉 ≥ 140（一代尊宿，引擎封顶取 100）；或声誉 ≥ 80 且触发「寺4·地宫问心」完美心结解开" },
      desc: "喇嘛庙三百年镇寺绝学，源自前任经师强巴留于白塔地宫的密传禅功。修至深处，任敌劲如雪崩压顶，周身气墙巍然如金刚石雕，非但不受惑乱控制，反将沛然佛力倒震敌手心脉。",
    },
  ];
