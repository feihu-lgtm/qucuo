export default { district: {
鱼定土司: {
    anchor: "府门",
    rooms: {
      府门: {
        x: 0, y: 0,
        desc: "土司府的正门，高台宅院，檐角挂着风铃，门前守卫神情肃穆。",
        exits: { n: "前厅", e: "护卫厅", w: "军需司" },
        buildingId: "pigeon_yudingtusi",
      },
      军需司: {
        x: -1, y: 0,
        desc: "西厢外院的军需库房，青稞干粮码到房梁，墙上挂着成排的牦牛皮护胸。差役拨着算盘，眼皮都不抬一下。",
        exits: { e: "府门" },
        buildingId: "shop_yudingtusi",
        residentNpcName: "白玛次仁",
      },
      护卫厅: {
        x: 1, y: 0,
        desc: "统领骑手三十人与巡捕营二十人的日常操练与值守调度之地，兵器架上刀枪林立。",
        exits: { w: "府门" },
        residentNpcName: "格桑顿珠",
        buildingId: "wuguan_yudingtusi",
      },
      前厅: {
        x: 0, y: -1,
        desc: "日常接待场所，陈设规整，是土司府对外交涉的第一道门面。",
        exits: { s: "府门", n: "议事厅", e: "管家值房", w: "梅朵闺房" },
        buildingId: "bounty_yudingtusi",
      },
      管家值房: {
        x: 1, y: -1,
        desc: "管家私人办公处，桌上常年堆着账册，村2/山5\"税册\"相关剧情可能涉及。",
        exits: { w: "前厅" },
        residentNpcName: "管家·陆福生",
      },
      梅朵闺房: {
        x: -1, y: -1,
        desc: "梅朵的私人空间，陈设不算奢华，却处处透着一股不服管束的随性。",
        exits: { e: "前厅" },
        residentNpcName: "梅朵",
      },
      议事厅: {
        x: 0, y: -2,
        desc: "土司理政处，正中一张长案，两侧是历年账簿和地契的存放架。",
        exits: { s: "前厅", n: "桑杰朵杰书房", w: "库房", e: "档册文书房" },
      },
      档册文书房: {
        x: 1, y: -2,
        desc: "议事厅东侧的长屋，一排排木架上堆满税册、地契抄本和户籍账，空气里尽是陈纸和酥油灯的味道。",
        exits: { w: "议事厅" },
        residentNpcName: "洛桑平措",
        buildingId: "library_yudingtusi",
      },
      库房: {
        x: -1, y: -2,
        desc: "存放贵重物什的库房，门上挂着一把沉甸甸的铜锁，虎胆三重门\"夜闯偷虎胆\"场景发生地。",
        exits: { e: "议事厅" },
        buildingId: "chest_yudingtusi",
      },
      桑杰朵杰书房: {
        x: 0, y: -3,
        desc: "土司私人空间，案头摆着几卷父亲留下的旧物，终局相关剧情预留。",
        exits: { s: "议事厅", n: "书房密室" },
        residentNpcName: "桑杰朵杰",
      },
      书房密室: {
        x: 0, y: -4,
        desc: "书架后一道窄门，里面只容一人转身。墙上挂着老土司桑杰大侠的旧刀，案上压着半张烧焦的地契，落款处的朱印缺了一角。",
        exits: { s: "桑杰朵杰书房" },
        unlockCondition: { type: "flag", flag: "tusi_secret_room" },
      },
    },
  }
} };
