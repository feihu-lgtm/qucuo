export default { district: {
玉泉寨: {
    anchor: "狼曲河谷",
    rooms: {
      狼曲河谷: {
        x: 0, y: 0,
        desc: "大草甸↔玉泉寨之间的路途，黑风寨山1-山5、虎1/虎3全部发生在这里。",
        exits: { s: "寨门", e: "枯柳暗窖" },
      },
      寨门: {
        x: 0, y: 1,
        desc: "玉泉寨真正的村寨入口，藏寨牧民聚落。",
        exits: { n: "狼曲河谷", s: "玉泉小栈", w: "扎西/卓玛家", e: "寨口牧场" },
      },
      玉泉小栈: {
        x: 0, y: 2,
        desc: "寨里的客栈，李若由常驻此处经营。",
        exits: { n: "寨门", e: "玉泉练武场", w: "丹增蒙古包", s: "寨场酥油茶棚" },
        buildingId: "inn_yuquan",
        residentNpcName: "李若由",
      },
      玉泉练武场: {
        x: 1, y: 2,
        desc: "寨里练武切磋的场地。",
        exits: { w: "玉泉小栈", e: "玉泉茶马货栈" },
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
        exits: { e: "玉泉小栈", w: "巴登草药棚", s: "狼曲篝火灶台" },
        residentNpcName: "丹增",
      },
      寨口牧场: {
        x: 1, y: 1,
        desc: "小牧童阿索常在此处放牧，紧邻寨门。",
        exits: { w: "寨门", e: "寨门铁作棚" },
        residentNpcName: "小牧童阿索",
      },
      寨门铁作棚: {
        x: 2, y: 1,
        desc: "寨门口的露天铁作棚，索朗在这里给全寨打马掌、打牧刀。",
        exits: { w: "寨口牧场" },
        buildingId: "forge_yuquan",
        residentNpcName: "索朗",
      },
      巴登草药棚: {
        x: -2, y: 2,
        desc: "巴登阿妈的草药棚，棚檐下挂着一排晾晒的药草，空气里全是藏红花和艾绒味。",
        exits: { e: "丹增蒙古包" },
        buildingId: "hospital_yuquan",
        residentNpcName: "巴登阿妈",
      },
      寨场酥油茶棚: {
        x: 0, y: 3,
        desc: "寨场边的酥油茶棚，牧民放完牧都爱来喝一碗热的。",
        exits: { n: "玉泉小栈", w: "狼曲篝火灶台" },
        buildingId: "teahouse_yuquan",
      },
      狼曲篝火灶台: {
        x: -1, y: 3,
        desc: "狼曲河边的公共篝火灶台，谁家炖了肉都往这儿凑。",
        exits: { e: "寨场酥油茶棚", n: "丹增蒙古包" },
        buildingId: "kitchen_yuquan",
      },
      玉泉茶马货栈: {
        x: 2, y: 2,
        desc: "茶马古道上的中转货栈，柜台后摞着茶砖、皮货和青稞酒坛。",
        exits: { w: "玉泉练武场" },
        buildingId: "shop_yuquan",
      },
      枯柳暗窖: {
        x: 1, y: 0,
        desc: "枯柳树根下的暗窖，黑风寨藏赃的地方——肉干、毛皮和小袋银子都码在里头。",
        exits: { w: "狼曲河谷" },
        unlockCondition: { type: "flag", flag: "yuquan_kuliu_unlocked" },
      },
    },
  }
} };
