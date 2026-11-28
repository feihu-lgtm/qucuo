import { BUILDING_TYPE } from "../buildingType.js";

export const fenfengdu = [
  {
    id: "inn_fenfengdu", name: "皮筏客栈", type: BUILDING_TYPE.INN, innPrice: 16,
    desc: "渡口平顶石木客栈，往来玉泉寨的皮货商与上山求见三迦叶的武人皆在此歇脚。",
  },
  {
    id: "shop_fenfengdu", name: "渡口淘金集", type: BUILDING_TYPE.SHOP, shopKey: "渡口淘金集",
    desc: "河滩边的热闹市集，淘金客在此用金沙换取盐巴、刀剑与白门赐下的辟寒火珠。",
  },
  {
    id: "restaurant_fenfengdu", name: "烈火铜锅肆", type: BUILDING_TYPE.RESTAURANT, menuKey: "烈火铜锅肆",
    desc: "河谷酒肆，专卖炙烤白牦牛肋排与焚风青稞烈酒。",
  },
  {
    id: "sect_entry_gaju", name: "百幡白石山门", type: BUILDING_TYPE.SECT_ENTRY, sect: "噶举山人",
    desc: "登山石阶尽头的纯白平顶山门，百道白幡翻飞，入门必先盘问「你师父是谁」。",
  },
  {
    id: "wuguan_gaju", name: "三迦叶拜火武馆", type: BUILDING_TYPE.WUGUAN, skillSet: "噶举",
    desc: "白门授武正堂，大迦叶在此传授《大轮火焰刀》《三迦叶拙火功》与《指月大手印》。",
  },
  {
    id: "sectshop_gaju", name: "四大八小盘道廊", type: BUILDING_TYPE.SECTSHOP, shopKey: "四大八小盘道廊",
    desc: "噶举四大八小十二支派长老会盟与发放白衣、火焰铜刀、转世信物的回廊。",
  },
  {
    id: "hospital_gaju", name: "冰泉蒸衣池", type: BUILDING_TYPE.HOSPITAL, healPerLiang: 3,
    desc: "引雪山寒泉入白石池，以拙火真气蒸干湿衣并疗伤拔寒。",
  },
  {
    id: "temple_gaju", name: "指月断崖台", type: BUILDING_TYPE.TEMPLE, karmaPerPray: 10,
    desc: "平顶大院最南端探出峡谷的巨石露台，十七岁的转世少年掌门在此唱道歌、指冷月。",
  },
];
