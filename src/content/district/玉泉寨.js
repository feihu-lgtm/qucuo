export default { district: {
玉泉寨: {
    anchor: "狼曲河谷",
    rooms: {
      狼曲河谷: {
        x: 0, y: 0,
        desc: "大草甸↔玉泉寨之间的路途，黑风寨山1-山5、虎1/虎3全部发生在这里。",
        exits: { s: "寨门" },
      },
      寨门: {
        x: 0, y: 1,
        desc: "玉泉寨真正的村寨入口，藏寨牧民聚落。",
        exits: { n: "狼曲河谷", s: "玉泉小栈", w: "扎西/卓玛家", e: "寨口牧场" },
      },
      玉泉小栈: {
        x: 0, y: 2,
        desc: "寨里的客栈，李若由常驻此处经营。",
        exits: { n: "寨门", e: "玉泉练武场", w: "丹增蒙古包" },
        buildingId: "inn_yuquan",
        residentNpcName: "李若由",
      },
      玉泉练武场: {
        x: 1, y: 2,
        desc: "寨里练武切磋的场地。",
        exits: { w: "玉泉小栈" },
        buildingId: "wuguan_yuquan",
      },
      "扎西/卓玛家": {
        x: -1, y: 1,
        desc: "扎西与卓玛父女同住的家，卓玛支线核心场景。",
        exits: { e: "寨门" },
        residentNpcName: "扎西",
      },
      丹增蒙古包: {
        x: -1, y: 2,
        desc: "玉泉寨村长丹增的蒙古包，哈那墙上挂着他的旧马鞭。",
        exits: { e: "玉泉小栈" },
        residentNpcName: "丹增",
      },
      寨口牧场: {
        x: 1, y: 1,
        desc: "小牧童阿索常在此处放牧，紧邻寨门。",
        exits: { w: "寨门" },
      },
    },
  }
} };
