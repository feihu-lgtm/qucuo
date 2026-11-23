// 武学目录·玉泉（从 qucuoKungfu.js 拆出，聚合见 ./index.js）
import { SKILL_TYPE } from "../skillType.js";

export const yuquan = [
    {
      id: "kf_rec_muge", name: "牧歌调息", type: SKILL_TYPE.MOVE, quality: "绿", price: 55,
      moveType: "状态",
      energyRestore: 6,
      unlock: { faction: "玉泉寨", rep: 0, member: false, note: "玉泉寨声誉 ≥ 0（非敌对即可在练武场求学）" },
      desc: "放牦牛的人在坡上哼的调子，没词，只有起伏。哼到第三遍呼吸自己就跟上了拍子，胸口那口憋着的气顺下去。阿索说这不是功夫，是「人跟着牛走久了，走出来的」。",
    },
    {
      id: "kf_rec_langqu", name: "狼曲饮雪", type: SKILL_TYPE.MOVE, quality: "蓝", price: 120,
      moveType: "状态",
      energyRestore: 7, hpRestore: 0.08,
      unlock: { faction: "玉泉寨", rep: 0, member: false, note: "玉泉寨声誉 ≥ 0" },
      desc: "掬一捧狼曲上游的雪含在嘴里，不嚼不咽，让它自己化。凉气顺喉管一路沉到丹田，化开的时候整个人激灵一下。牧民冬天赶远路全靠这一口。",
    },
    {
      id: "kf_liuyun", name: "流云步法", type: SKILL_TYPE.QINGGONG, quality: "绿", price: 45,
      moveType: "状态",
      unlock: { faction: "玉泉寨", rep: 0, member: false, note: "玉泉寨声誉 ≥ 0" },
      desc: "藏地牧民代代相传的步伐心诀，身随意转，如云散无形。修习后身法加强，与对手同类招式对撞时更易占得先手。",
      passiveBonus: { speedBonus: 1 },
    },
    {
      id: "kf_daishuai", name: "摔跌术", type: SKILL_TYPE.MOVE, quality: "绿", price: 35,
      moveType: "状态",
      applyStatus: "麻穴", statusChance: 0.4,
      unlock: { faction: "玉泉寨", rep: 15, member: false, note: "玉泉寨声誉 ≥ 15（练武场才肯教真摔法）" },
      desc: "借力打力，将对手的气势引入虚处——看似平淡，实则以巧破力，是玉泉寨人相互切磋最常用的手段。",
    },
    {
      id: "kf_jiangong", name: "坚桩功", type: SKILL_TYPE.MOVE, quality: "白", price: 20,
      moveType: "防御",
      ignoreDefensePartialImmune: 0.3,
      unlock: { faction: "玉泉寨", rep: 15, member: false, note: "玉泉寨声誉 ≥ 15" },
      desc: "扎实的站桩功夫，招式简单但根基牢固，练到纯熟能以守代攻。初学者的不二之选。",
    },
    // 合稿·玉泉寨 武学三档：rep40 套马索魂手、rep80 长生天吐纳诀/搏狼鞭法（声誉封顶 100，原 140 档压回 80）。
    {
      id: "kf_yuquan_taoma", name: "套马索魂手", type: SKILL_TYPE.MOVE, quality: "蓝", price: 130,
      moveType: "攻击",
      applyStatus: "麻穴", statusChance: 0.45,
      unlock: { faction: "玉泉寨", rep: 40, member: false, note: "玉泉寨声誉 ≥ 40（丹增点头才传）" },
      desc: "驯马人的套索手，索影一抖缠住对手脚踝——套马的东西用在人身上，套上就跑不脱。",
    },
    {
      id: "kf_yuquan_changshengtian", name: "长生天吐纳诀", type: SKILL_TYPE.NEIGONG, quality: "紫", price: 180,
      moveType: "状态",
      passiveBonus: { maxHp: 28 }, energyRestore: 6, hpRestore: 0.1,
      unlock: { faction: "玉泉寨", rep: 80, member: false, note: "玉泉寨声誉 ≥ 80（视作狼曲义亲候选）" },
      desc: "牧民对长生天的吐纳法，一呼一吸学草原的风——绵长、不绝。练成后气血如草根般自己往回长。",
    },
    {
      id: "kf_yuquan_bolang", name: "搏狼鞭法", type: SKILL_TYPE.MOVE, quality: "紫", price: 180,
      moveType: "攻击",
      forceCrit: 1.55, lowHpBonus: 0.35,
      unlock: { faction: "玉泉寨", rep: 80, member: false, note: "玉泉寨声誉 ≥ 80" },
      desc: "狼曲河谷猎户的保命鞭法，专等自己血气最弱、狼扑上来那一刻反手一鞭——越险越狠。",
    },
  ];
