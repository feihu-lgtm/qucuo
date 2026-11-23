import { BUILDING_TYPE } from "../buildingType.js";

export const lamamiao = [
    {
      id: "restaurant_lama", name: "素斋", type: BUILDING_TYPE.RESTAURANT, menuKey: "素斋",
      hasBasement: true,
      desc: "寺里的素食堂，清淡养生。传闻某处小门通往荤食地下室，寺里讳莫如深。",
    },
    {
      id: "temple_lama", name: "大殿", type: BUILDING_TYPE.TEMPLE, karmaPerPray: 10,
      desc: "庄严的佛殿，花功德拜佛，偶尔会有顿悟感悟，七维属性可能有所增益。",
    },
    {
      id: "library_lama", name: "藏经阁", type: BUILDING_TYPE.LIBRARY,
      desc: "珍藏经卷的阁楼，免费阅读可增长见识，部分秘籍出售，武学亦有收录。",
    },
    {
      id: "medicine_lama", name: "达磨药堂", type: BUILDING_TYPE.MEDICINE, shopKey: "达磨药堂",
      desc: "喇嘛庙西厢的药堂，僧医兼职，以藏药为主，跌打外伤高原草药均有备货。",
    },
    {
      id: "wuguan_lamamiao_hufa", name: "护法禅院", type: BUILDING_TYPE.WUGUAN, skillSet: "喇嘛庙",
      desc: "大殿西侧一座用乱石围出的露天练功坪，立着十二根被掌风拍出深印的柏木桩。寺中不收俗家弟子，但肯指点有缘护法修习雪域禅武。",
    },
    {
      id: "hospital_lamamiao_yizhen", name: "山门施药棚", type: BUILDING_TYPE.HOSPITAL, healPerLiang: 3,
      desc: "搭在山门外避风处的粗布药棚，专供过路冻伤者与穷苦牧民即时诊治调息，不误时辰。凡获喇嘛庙善缘者，可于此直接疗伤回气。",
    },
];
