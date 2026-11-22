export default { district: {
蜀南唐堡: {
    anchor: "吊桥暗渠口",
    rooms: {
      吊桥暗渠口: {
        x: 0, y: 0,
        desc: `　　护城暗渠水色发墨，一道青竹吊桥搭过去，桥索上挂着九枚细铜铃。风吹过，铃不响。
　　守桥的唐家子弟说，铃只在有人踩错青砖方位时才响——响一声，桥那头的机括就松一扣。`,
        exits: { n: "竹影正堂", w: "千机演武坪", e: "外姓竹坞" },
      },
      竹影正堂: {
        x: 0, y: -1,
        desc: `　　八扇乌木雕花屏风围出一间森严厅堂，正中供着唐家历代先人的牌位。
　　临窗一张紫檀椅，老太太坐在上面慢条斯理地纳鞋底，脚边竹篓里插满细如牛毛的精钢绣针。她抬头冲你笑了笑，手里的针没停。`,
        exits: { s: "吊桥暗渠口", e: "唐堡内库", w: "宗祠入堂石", n: "宗谱机密楼" },
        unlockCondition: { type: "flag", flag: "tangmen_invited" },
        residentNpcName: "唐老太",
      },
      唐堡内库: {
        x: 1, y: -1,
        desc: `　　正堂东侧一间石砌货房，门是两寸厚的铁皮包木，门闩上挂着一把没有锁眼的机关锁。
　　架上的瓷瓶都贴着朱砂小签，签上只写编号不写名字——唐家人自己认得，外人拿错了也不会有人提醒。`,
        exits: { w: "竹影正堂" },
        unlockCondition: { type: "flag", flag: "tangmen_invited" },
        buildingId: "sectshop_tangmen",
      },
      千机演武坪: {
        x: -1, y: 0,
        desc: `　　青砖地面布满细密的滑槽与旋转木桩，墙上钉着千疮百孔的铁皮靶人。
　　竹风过处，常听见机簧绷断的脆响，接着是一声闷哼——又有子弟没躲开。`,
        exits: { e: "吊桥暗渠口" },
        buildingId: "wuguan_tangmen",
      },
      外姓竹坞: {
        x: 1, y: 0,
        desc: `　　依着崖壁搭起的一片吊脚工坊，住的都是唐门雇来的外姓匠人。炉火映红了半边竹林，打铁声和药臼捣毒声昼夜不歇。
　　外姓人进不了正堂，手艺却是唐门的半条命。`,
        exits: { w: "吊桥暗渠口", e: "试毒暗阁" },
        buildingId: "hospital_tangmen",
      },
      宗祠入堂石: {
        x: -1, y: -1,
        desc: `　　正堂西侧的唐家宗祠，门槛前横着一块被膝盖磨凹了的青石，叫入堂石。
　　石上三道浅槽，是历代弟子立血誓时滴血的地方。案头摞着一沓玄竹令牌，背面都还空着。`,
        exits: { e: "竹影正堂" },
        unlockCondition: { type: "flag", flag: "tangmen_invited" },
        buildingId: "sect_entry_tangmen",
      },
      宗谱机密楼: {
        x: 0, y: -2,
        desc: `　　正堂后一座三层木楼，梁上悬满细竹签，每根签对着一格账匣。
　　楼梯口坐着一位灰袍老者，手里摩挲一串青铜钥匙，谁上楼都要先对他报房头。`,
        exits: { s: "竹影正堂", n: "宗谱铁室" },
        unlockCondition: { type: "flag", flag: "tangmen_invited" },
      },
      宗谱铁室: {
        x: 0, y: -3,
        desc: `　　机密楼底层的铁室，四壁包着生铁，只一盏油灯。
　　架上是三十年来唐门每一笔毒药、机括的出货账，墨色深浅不一，有几页像是被人用褪墨水洗过。`,
        exits: { s: "宗谱机密楼" },
        unlockCondition: { type: "flag", flag: "quest_tang2_s1" },
      },
      试毒暗阁: {
        x: 2, y: 0,
        desc: `　　外姓竹坞尽头一间不开窗的暗阁，墙角码着贴朱签的陶瓮，空气里有股甜腥。
　　桌上摊着唐老太手写的方子，旁边一碗清水——进来的人先喝它，再碰别的。`,
        exits: { w: "外姓竹坞" },
        unlockCondition: { type: "flag", flag: "quest_tang4_s1" },
      },
    },
  }
} };
