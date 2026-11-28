export default { district: {
丹霞城: {
  anchor: "丹霞外城街",
  rooms: {
    丹霞外城街: {
      x: 0, y: 0,
      desc: "灰白土坡下的热闹石板街，满街都是挑着青稞与红盐来向萨迦世家交租的庄户。",
      exits: { n: "三色花墙正门", w: "溪卡纳租庄仓", e: "朱砂印经工坊", s: "红盐客栈" },
      residentNpcName: "收租管事·旺堆",
    },
    溪卡纳租庄仓: {
      x: -1, y: 0,
      desc: "萨迦名下十八座田庄的总粮仓兼官营商铺，对外发卖余粮、红盐、氆氇与藏药。",
      exits: { e: "丹霞外城街" },
      buildingId: "shop_danxiacheng",
    },
    朱砂印经工坊: {
      x: 1, y: 0,
      desc: "上百名工匠手持桦木雕版刷印五明典籍与武学图谱，满院朱砂与松烟墨香。",
      exits: { w: "丹霞外城街" },
      buildingId: "library_sajia",
      residentNpcName: "雕版老匠人根秋",
    },
    红盐客栈: {
      x: 0, y: 1,
      desc: "外城平顶石柱客栈，住满了来向萨迦求购经卷、盐引与交纳岁贡的各地客商。",
      exits: { n: "丹霞外城街" },
      buildingId: "inn_danxiacheng",
    },
    三色花墙正门: {
      x: 0, y: -1,
      desc: "刷着红白蓝三色花条的平顶巨石城门，檐口压着白玛草，进门便是萨迦昆氏的内城大院。",
      exits: { s: "丹霞外城街", n: "三十六石柱大院", w: "外姓护法堂", e: "半衙签押司" },
      buildingId: "sect_entry_sajia",
      residentNpcName: "昆·索朗坚赞",
    },
    半衙签押司: {
      x: 1, y: -1,
      desc: "萨迦代管雪域词讼与田赋的官厅，黑漆公案与门派戒尺并列，半门派半衙门。",
      exits: { w: "三色花墙正门" },
      buildingId: "bounty_sajia",
    },
    外姓护法堂: {
      x: -1, y: -1,
      desc: "十二根粗石柱撑起的平顶偏院，外姓长老在此统管护院武僧、发放日月五轮与法器。",
      exits: { e: "三色花墙正门", n: "金轮武馆" },
      buildingId: "sectshop_sajia",
      residentNpcName: "金轮护法·达尔巴",
    },
    三十六石柱大院: {
      x: 0, y: -2,
      desc: "阿嘎土夯实的开阔平顶内院，三十六根灰白巨石方柱列成大阵，门人在此先论理后论剑。",
      exits: { s: "三色花墙正门", n: "昆氏道果正殿", w: "金轮武馆", e: "班智达辩经坛" },
      residentNpcName: "昆·阿旺班智达",
    },
    金轮武馆: {
      x: -1, y: -2,
      desc: "萨迦世家授武重地，石柱上嵌满金银飞轮劈出的深痕，大轮法王在此传授五轮与龙象绝技。",
      exits: { s: "外姓护法堂", e: "三十六石柱大院", n: "龙象般若石窟" },
      buildingId: "wuguan_sajia",
      residentNpcName: "大轮法王·卓玛嘉",
    },
    龙象般若石窟: {
      x: -1, y: -3,
      desc: "巨石封顶的后院密室，壁刻十三层龙象托山图，供护法武僧锤炼十叠巨力。",
      exits: { s: "金轮武馆" },
    },
    班智达辩经坛: {
      x: 1, y: -2,
      desc: "红毡铺地的平顶石廊，各国游学僧与江湖剑客在此击掌辩理，输理者不拔刀自退。",
      exits: { w: "三十六石柱大院", n: "八思巴铁券阁" },
    },
    昆氏道果正殿: {
      x: 0, y: -3,
      desc: "八根朱漆巨石方柱撑起的萨迦主殿，屋顶铺白玛草与金幢，正中石座只传昆氏叔侄。",
      exits: { s: "三十六石柱大院", e: "八思巴铁券阁" },
      buildingId: "temple_sajia",
      residentNpcName: "昆·法王丹巴坚赞",
    },
    八思巴铁券阁: {
      x: 1, y: -3,
      desc: "密藏前朝皇帝赐给帝师八思巴的玉印、金字铁券与全城田契总册。",
      exits: { s: "班智达辩经坛", w: "昆氏道果正殿" },
      buildingId: "chest_sajia",
      unlockCondition: { type: "factionRep", faction: "萨迦世家", min: 40 },
    },
  },
} } };
