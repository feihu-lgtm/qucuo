export default { district: {
打箭炉: {
  anchor: "炉城东关",
  rooms: {
    炉城东关: {
      x: 0, y: 0,
      desc: "折多河与雅拉河交汇处的峡谷石关，背着百斤雅州边茶砖的背夫与康巴马帮在此交验茶引，人马嘶鸣声整日不绝。",
      exits: { w: "折多索桥", n: "榷茶官栈", s: "武侯造箭坊" },
      residentNpcName: "守关把总赵铁山",
    },
    榷茶官栈: {
      x: 0, y: -1,
      desc: "官督商办的茶马总驿，院里拴满健马与骡驼，专跑川藏各据点间的加急递信与客旅传送。",
      exits: { s: "炉城东关", w: "长青春茶馆" },
      buildingId: "transport_dajianlu",
    },
    武侯造箭坊: {
      x: 0, y: 1,
      desc: "引折多河急流水车鼓风的百年官炉，既打破甲重箭，也铸密宗金银飞轮，火星映红半边石壁。",
      exits: { n: "炉城东关", w: "番市皮毛街" },
      buildingId: "forge_dajianlu",
      residentNpcName: "炉城铁匠郭三",
    },
    折多索桥: {
      x: -1, y: 0,
      desc: "横跨折多河咆哮白水的铁索木桥，桥东多川商茶客，桥西多藏袍刀客，脚下浪涛声震耳欲聋。",
      exits: { e: "炉城东关", w: "大锅庄总号", n: "长青春茶馆", s: "番市皮毛街" },
    },
    长青春茶馆: {
      x: -1, y: -1,
      desc: "炉城最热闹的平顶石柱大茶楼，酥油茶与蒙顶毛峰同壶摆着，花门、白门、黑门的风声都在桌上流转。",
      exits: { s: "折多索桥", e: "榷茶官栈", n: "跑马山武馆" },
      buildingId: "teahouse_dajianlu",
      residentNpcName: "说书瞎子阿吉",
    },
    跑马山武馆: {
      x: -1, y: -2,
      desc: "跑马山麓用巨石方柱围出的演武大院，扎巴教头在此传授康巴重刀与角抵硬功。",
      exits: { s: "长青春茶馆", w: "溜溜云亭" },
      buildingId: "wuguan_dajianlu",
      residentNpcName: "康巴总教头·扎巴",
    },
    溜溜云亭: {
      x: -2, y: -2,
      desc: "云朵缭绕的山腰四角平顶石亭，俯瞰全城平顶石楼与折多河白水，常闻悠扬康定情歌顺风飘下。",
      exits: { e: "跑马山武馆" },
      residentNpcName: "炉城歌女拉姆",
    },
    大锅庄总号: {
      x: -2, y: 0,
      desc: "康定最大的一家锅庄，二层平顶石柱回廊深院，底层圈马囤茶，楼上包揽住宿与大宗茶马交易。",
      exits: { e: "折多索桥", n: "雪域珍宝行", s: "牦牛骨汤馆", w: "三宗会馆" },
      buildingId: "inn_dajianlu",
      residentNpcName: "锅庄大掌柜兰措",
    },
    雪域珍宝行: {
      x: -2, y: -1,
      desc: "专营九眼天珠、绿松石、红珊瑚、藏红花与三宗流散法器的商号，柜台后总垂着厚重氆氇帘。",
      exits: { s: "大锅庄总号" },
      buildingId: "shop_dajianlu",
    },
    牦牛骨汤馆: {
      x: -2, y: 1,
      desc: "铜锅里常年滚着奶白牦牛筒骨汤与康定红酒，驱寒补气一绝，马帮汉子进城头一件事便是先灌两碗。",
      exits: { n: "大锅庄总号", e: "番市皮毛街" },
      buildingId: "restaurant_dajianlu",
    },
    番市皮毛街: {
      x: -1, y: 1,
      desc: "满街晾挂雪豹皮、狼皮与雪域草药，老彭措坐堂专治刀创与高原寒症。",
      exits: { n: "折多索桥", e: "武侯造箭坊", w: "牦牛骨汤馆" },
      buildingId: "medicine_dajianlu",
      residentNpcName: "藏医老彭措",
    },
    三宗会馆: {
      x: -3, y: 0,
      desc: "八根整石方柱撑起的平顶议事厅，花、白、黑三门在此张贴江湖悬赏、调停纠纷。",
      exits: { e: "大锅庄总号" },
      buildingId: "bounty_dajianlu",
      residentNpcName: "调停客宗喀",
    },
  },
} } };
