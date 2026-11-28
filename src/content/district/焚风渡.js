export default { district: {
焚风渡: {
  anchor: "焚风牛皮渡",
  rooms: {
    焚风牛皮渡: {
      x: 0, y: 0,
      desc: "狼曲南下的干热河谷古渡，热风扑面，牛皮筏子满载羊毛与沙金往来两岸。",
      exits: { s: "渡口淘金集", w: "皮筏客栈", e: "白牦牛官牧场" },
      residentNpcName: "摆渡老汉多吉",
    },
    皮筏客栈: {
      x: -1, y: 0,
      desc: "渡口平顶石木客栈，往来玉泉寨的皮货商与上山求见三迦叶的武人皆在此歇脚。",
      exits: { e: "焚风牛皮渡" },
      buildingId: "inn_fenfengdu",
    },
    白牦牛官牧场: {
      x: 1, y: 0,
      desc: "属于白门寺产的千亩河谷暖滩，放养着上千头纯白牦牛，供应全院酥油与皮货。",
      exits: { w: "焚风牛皮渡" },
      residentNpcName: "牧场头人仁青",
    },
    渡口淘金集: {
      x: 0, y: 1,
      desc: "河滩边的热闹市集，淘金客在此用金沙换取盐巴、刀剑与白门赐下的辟寒火珠。",
      exits: { n: "焚风牛皮渡", s: "百幡白石山门", w: "烈火铜锅肆" },
      buildingId: "shop_fenfengdu",
    },
    烈火铜锅肆: {
      x: -1, y: 1,
      desc: "河谷酒肆，铜炉柴火昼夜不断，专卖炙烤白牦牛肋排与焚风青稞烈酒。",
      exits: { e: "渡口淘金集" },
      buildingId: "restaurant_fenfengdu",
    },
    百幡白石山门: {
      x: 0, y: 2,
      desc: "登山石阶尽头的纯白平顶山门，百道白幡翻飞，入门必先盘问「你师父是谁」。",
      exits: { n: "渡口淘金集", s: "十六白柱敞院", e: "四大八小盘道廊", w: "冰泉蒸衣池" },
      buildingId: "sect_entry_gaju",
      residentNpcName: "盘道人·白衣赤列",
    },
    十六白柱敞院: {
      x: 0, y: 3,
      desc: "十六根粗大白石方柱撑起的平顶大院，身穿单层白布僧衣的门人在此吐纳焚风。",
      exits: { n: "百幡白石山门", s: "三迦叶拜火武馆", e: "口传密授石室" },
      residentNpcName: "拜火二迦叶·灿莲",
    },
    三迦叶拜火武馆: {
      x: 0, y: 4,
      desc: "白门授武正堂，正中三尺青铜火盆烈焰熊熊，大迦叶在此传授《大轮火焰刀》与《拙火功》。",
      exits: { n: "十六白柱敞院", s: "指月断崖台" },
      buildingId: "wuguan_gaju",
      residentNpcName: "拜火大迦叶·燃灯",
    },
    口传密授石室: {
      x: 1, y: 3,
      desc: "不存一页纸质秘籍的平顶静室，噶举绝学皆由师父在此隔着火盆贴耳口授。",
      exits: { w: "十六白柱敞院", n: "四大八小盘道廊" },
      residentNpcName: "拜火三迦叶·明空",
    },
    四大八小盘道廊: {
      x: 1, y: 2,
      desc: "噶举四大八小十二支派长老会盟与发放白衣、火焰铜刀、转世信物的回廊。",
      exits: { w: "百幡白石山门", s: "口传密授石室" },
      buildingId: "sectshop_gaju",
      residentNpcName: "寻访使·楚臣",
    },
    冰泉蒸衣池: {
      x: -1, y: 2,
      desc: "引雪山寒泉入白石池，弟子冬日湿衣入座，三息内以拙火真气将冰衣蒸干疗伤。",
      exits: { e: "百幡白石山门" },
      buildingId: "hospital_gaju",
    },
    指月断崖台: {
      x: 0, y: 5,
      desc: "平顶大院最南端探出峡谷的巨石露台，十七岁的转世少年掌门在此唱道歌、指冷月。",
      exits: { n: "三迦叶拜火武馆" },
      buildingId: "temple_gaju",
      residentNpcName: "转世法王·白衣少年",
    },
  },
} } };
