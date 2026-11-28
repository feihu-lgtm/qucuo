import { BUILDING_TYPE } from "../buildingType.js";

export const danxiacheng = [
  {
    id: "shop_danxiacheng", name: "溪卡纳租庄仓", type: BUILDING_TYPE.SHOP, shopKey: "溪卡纳租庄仓",
    desc: "萨迦名下十八座田庄的总粮仓兼官营商铺，对外发卖余粮、红盐、氆氇与藏药。",
  },
  {
    id: "library_sajia", name: "朱砂印经工坊", type: BUILDING_TYPE.LIBRARY,
    desc: "上百名工匠手持桦木雕版刷印五明典籍与武学图谱，满院朱砂与松烟墨香。",
  },
  {
    id: "inn_danxiacheng", name: "红盐客栈", type: BUILDING_TYPE.INN, innPrice: 20,
    desc: "外城平顶石柱客栈，住满了来向萨迦求购经卷、盐引与交纳岁贡的各地客商。",
  },
  {
    id: "sect_entry_sajia", name: "三色花墙正门", type: BUILDING_TYPE.SECT_ENTRY, sect: "萨迦世家",
    desc: "刷着红白蓝三色花条的平顶巨石城门，昆·索朗坚赞在此主持拜入萨迦世家事宜。",
  },
  {
    id: "bounty_sajia", name: "半衙签押司", type: BUILDING_TYPE.BOUNTY,
    desc: "萨迦代管雪域词讼与田赋的官厅，黑漆公案与门派戒尺并列，半门派半衙门。",
  },
  {
    id: "sectshop_sajia", name: "外姓护法堂", type: BUILDING_TYPE.SECTSHOP, shopKey: "外姓护法堂",
    desc: "十二根粗石柱撑起的平顶偏院，外姓长老在此统管护院武僧、发放日月五轮与法器。",
  },
  {
    id: "wuguan_sajia", name: "金轮武馆", type: BUILDING_TYPE.WUGUAN, skillSet: "萨迦",
    desc: "萨迦世家授武重地，大轮法王卓玛嘉在此传授五轮、龙象与道果绝技。",
  },
  {
    id: "temple_sajia", name: "昆氏道果正殿", type: BUILDING_TYPE.TEMPLE, karmaPerPray: 10,
    desc: "八根朱漆巨石方柱撑起的萨迦主殿，屋顶铺白玛草与金幢。",
  },
  {
    id: "chest_sajia", name: "八思巴铁券阁", type: BUILDING_TYPE.CHEST, house: "八思巴铁券阁", emptyStock: true,
    faction: "萨迦世家", minRep: 40,
    desc: "密藏前朝皇帝赐给帝师八思巴的玉印、金字铁券与全城田契总册。",
  },
];
