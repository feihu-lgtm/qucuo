// 喇嘛庙内层房间，照全势力合稿「喇嘛庙·二、据点与建筑」；护法禅院、山门施药棚为合稿新增建筑房。
export default { district: {
喇嘛庙: {
    anchor: "山门",
    rooms: {
      山门: {
        x: 0, y: 0,
        desc: "三丈高的赭红石牌坊立在雪坡尽头，檐下铜铃被山风吹得零落作响，门前青石板已被三百年香客的靴底磨得发亮。",
        exits: { n: "大殿", w: "护法禅院", s: "山门施药棚" },
        residentNpcName: "洛桑",
      },
      山门施药棚: {
        x: 0, y: 1,
        desc: "搭在山门外避风处的粗布药棚，专供过路冻伤者与穷苦牧民即时诊治调息。",
        exits: { n: "山门" },
        buildingId: "hospital_lamamiao_yizhen",
      },
      护法禅院: {
        x: -1, y: 0,
        desc: "乱石围出的露天练功坪，立着十二根被掌风拍出深印的柏木桩。寺中不收俗家弟子，但肯指点有缘护法修习雪域禅武。",
        exits: { e: "山门", n: "藏经阁" },
        buildingId: "wuguan_lamamiao_hufa",
      },
      大殿: {
        x: 0, y: -1,
        desc: "殿中十八盏酥油长明灯把金身佛像照得晦暗不定，浓重的柏枝香混着陈年寒气，叫人一脚迈进来便不自觉压低了嗓音。",
        exits: { s: "山门", w: "藏经阁", e: "达摩药堂", n: "西厢僧舍" },
        buildingId: "temple_lama",
      },
      藏经阁: {
        x: -1, y: -1,
        desc: "挑高的木楼里排满刷了朱漆的经架，半人高的藏汉卷宗落着细灰，靠北那排钉了铜锁的旧木匣最是显眼。",
        exits: { e: "大殿", s: "护法禅院" },
        buildingId: "library_lama",
        residentNpcName: "次仁",
      },
      达摩药堂: {
        x: 1, y: -1,
        desc: "四壁药柜从地顶到梁，雪莲、红景天、当归与硫磺味绞在一处，药碾子在木案后头不紧不慢地来回碾着。",
        exits: { w: "大殿", s: "素斋" },
        buildingId: "medicine_lama",
        residentNpcName: "达摩药堂师父",
      },
      素斋: {
        x: 1, y: 0,
        desc: "几张被油烟熏黑的松木长桌摆在土灶外头，大铁锅里常年滚着青稞糊和萝卜汤，热气扑在窗纸上凝成一片白霜。",
        exits: { n: "达摩药堂", s: "荤食地下室" },
        buildingId: "restaurant_lama",
        residentNpcName: "丹巴",
      },
      荤食地下室: {
        x: 1, y: 1,
        desc: "掀开素斋大灶后头那块熏黑的青石板，底下竟藏着间暖烘烘的地窖，土陶锅里咕嘟炖着牦牛肉，梁上还挂着半扇风干羊腿。",
        exits: { n: "素斋" },
        // 复用既有 hasBasement 建筑设定的解锁触发，不新造判定逻辑
        unlockCondition: { type: "flag", flag: "unlocked_lama_basement" },
      },
      西厢僧舍: {
        x: 0, y: -2,
        desc: "一排低矮的石砌禅房背靠冷崖，窗棂贴着泛黄的桑皮纸，住持的屋门永远虚掩着一指宽的缝，里头点着灯却听不见人声。",
        exits: { s: "大殿" },
        residentNpcName: "喇嘛庙住持",
      },
    },
  }
} };
