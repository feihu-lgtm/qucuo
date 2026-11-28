export default { district: {
琼隆古墟: {
  anchor: "对转铁索桥",
  rooms: {
    对转铁索桥: {
      x: 0, y: 0,
      desc: "横跨白塔与琼隆古墟深涧的石墩铁索桥，顺行僧人与逆行黑门武士常在此迎面「对转」顶牛。",
      exits: { w: "黑石山民集", n: "煨桑皮货店" },
      residentNpcName: "逆行护法·琼波",
    },
    煨桑皮货店: {
      x: 0, y: -1,
      desc: "外城平顶黑石客店，火塘终年焚烧松柏枝与苦艾，供掘藏散人与矿商歇脚。",
      exits: { s: "对转铁索桥" },
      buildingId: "inn_qionglong",
    },
    黑石山民集: {
      x: -1, y: 0,
      desc: "象雄遗民聚居的石板街市，家家户户门楣挂白牦牛头骨，售卖矿石、骨器与青稞袋。",
      exits: { e: "对转铁索桥", w: "左旋雍仲正门", n: "天铁矿炉坊", s: "青稞朵玛庄房" },
      buildingId: "shop_qionglong",
    },
    天铁矿炉坊: {
      x: -1, y: -1,
      desc: "苯门辖下的冶铁重地，以雪山雷击天铁（陨铁）与寒铁混锻九股黑杵与掘藏钢钎。",
      exits: { s: "黑石山民集", w: "掘藏奇珍阁" },
      buildingId: "forge_qionglong",
      residentNpcName: "天铁匠首·贡布",
    },
    青稞朵玛庄房: {
      x: -1, y: 1,
      desc: "领地庄户缴纳青稞炒面与酥油的总坊，门人在此揉制坚如铁石的「朵玛」小牦牛。",
      exits: { n: "黑石山民集" },
      buildingId: "kitchen_benmen",
    },
    左旋雍仲正门: {
      x: -2, y: 0,
      desc: "嵌着十八具逆时针黑铜经轮的平顶巨石城门，推顺时针者当场被门内机括弹飞。",
      exits: { e: "黑石山民集", w: "十二黑石柱王院", n: "掘藏奇珍阁", s: "九宫卜算楼" },
      buildingId: "sect_entry_benmen",
    },
    十二黑石柱王院: {
      x: -3, y: 0,
      desc: "十二根刻满大鹏与九宫图的墨色巨石方柱撑起平顶回廊，地面铺设左旋黑石板。",
      exits: { e: "左旋雍仲正门", w: "辛饶大鹏正殿", n: "琼鸟九乘武馆", s: "中阴度亡医窟" },
      residentNpcName: "九乘长老·木雅仲巴",
    },
    琼鸟九乘武馆: {
      x: -3, y: -1,
      desc: "黑门授武大坪，弟子头戴黑木琼鸟面具，在此锤炼《象雄大鹏爪》与《朵玛奔牛劲》。",
      exits: { s: "十二黑石柱王院", e: "掘藏奇珍阁" },
      buildingId: "wuguan_benmen",
      residentNpcName: "金翅武师·阿古顿巴",
    },
    掘藏奇珍阁: {
      x: -2, y: -1,
      desc: "收纳历代掘藏师从深山岩缝与古塔地底刨出的羊皮秘籍、天铁兵刃与兽面具。",
      exits: { s: "左旋雍仲正门", w: "琼鸟九乘武馆", e: "天铁矿炉坊" },
      buildingId: "sectshop_benmen",
      residentNpcName: "铁钎掘藏师·阿旺",
    },
    九宫卜算楼: {
      x: -2, y: 1,
      desc: "苯门前四乘卜算重地，以炙烤羊肩胛骨裂纹与九宫绳结推算敌手明日来路。",
      exits: { n: "左旋雍仲正门", w: "中阴度亡医窟" },
      buildingId: "library_benmen",
      residentNpcName: "九算神婆·雍措",
    },
    中阴度亡医窟: {
      x: -3, y: 1,
      desc: "前四乘「驱邪、度亡」医理所在，以矿物药石与金针将濒死之人从鬼门关拽回。",
      exits: { n: "十二黑石柱王院", e: "九宫卜算楼" },
      buildingId: "hospital_benmen",
    },
    辛饶大鹏正殿: {
      x: -4, y: 0,
      desc: "八根整石黑柱撑起的平顶主殿，供奉骑金翅大鹏的祖师辛饶米沃黑铜像。",
      exits: { e: "十二黑石柱王院" },
      buildingId: "temple_benmen",
      residentNpcName: "象雄大宗主·桑吉坚赞",
    },
  },
} } };
