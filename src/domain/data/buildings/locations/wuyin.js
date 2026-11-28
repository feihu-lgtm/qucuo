import { BUILDING_TYPE } from "../buildingType.js";

  // ── 雾隐寨（8 种，苗疆秘宗·五仙教北坛） ──
export const wuyin = [
    {
      id: "inn_wuyinzhai", name: "避瘴吊脚楼", type: BUILDING_TYPE.INN, innPrice: 18,
      desc: "悬在溪涧上方的两层竹楼，床帐里缝着驱虫晒干的艾草与菖蒲。外乡人头一回住总嫌湿气重，睡到半夜听见竹柱底下虫爬，反倒不敢下床乱跑。",
    },
    {
      id: "sect_entry_wuxian", name: "五仙拜师坛", type: BUILDING_TYPE.SECT_ENTRY, sect: "五仙教",
      desc: "五根灵柱正中摆着一只盛满清酒的黑陶碗，碗底沉着一枚银蛇牌。想入五仙教不用磕响头，先把碗里掺了微毒的酒喝干，站得稳才算过关。",
    },
    {
      id: "wuguan_wuxian", name: "听虫演武坪", type: BUILDING_TYPE.WUGUAN, skillSet: "五仙",
      desc: "青石坪缝里长满滑脚的青苔，教中弟子练功专挑雨雾最浓的辰光。龙汐月常坐廊下甩鞭子，说外人练拳靠眼睛，苗疆功夫靠耳朵听草动。",
    },
    {
      id: "medicine_wuxian", name: "百蛊药房", type: BUILDING_TYPE.MEDICINE, shopKey: "五仙百蛊房",
      desc: "柜台后头百十个药抽屉没贴一张纸签，全靠掌柜阿萝闻味儿抓药。解瘴丹、断肠散和治跌打的草膏挨着放，外乡人买错了她多半会笑眯眯提醒你一句——看心情。",
    },
    {
      id: "sectshop_wuxian", name: "五仙秘珍坊", type: BUILDING_TYPE.SECTSHOP, shopKey: "五仙秘珍坊",
      desc: "只认教中功勋与门墙情面的小竹阁，寻常散银买不走里头半片蛇蜕。案几上摆着淬过三道秘毒的苗银兵刃与活虫玉匣，外客连门槛都跨不进来。",
    },
    {
      id: "temple_wuxian", name: "五仙祖灵殿", type: BUILDING_TYPE.TEMPLE,
      desc: "供奉着历代圣母牌位与五灵石像的幽暗石殿，终年点着松明火把。乌婆婆每天清晨来扫落叶，常在殿角晒些外头见不着的冷僻草根。",
    },
    {
      id: "teahouse_wuxian", name: "藤花茶棚", type: BUILDING_TYPE.TEAHOUSE,
      desc: "搭在紫岚藤桥内侧的半敞竹棚，卖粗碗烤茶和凉拌折耳根。往来雅江采药客、天都镇脚夫和教中巡山女都在这儿歇脚，雾里藏不住的风声多半先落在这张桌子上。",
    },
    {
      id: "kitchen_wuxian", name: "酸汤竹灶", type: BUILDING_TYPE.KITCHEN,
      desc: "用湿泥糊成的苗家地灶，吊锅里常年咕嘟着红亮酸汤，墙上挂满腊肉、山椒与野菌。寨里人说，进了毒瘴谷要想不烂肠子，每天得吃三口滚烫酸辣。",
    },
    {
      id: "wuxian_centipede_den", name: "五仙百毒禁谷", type: BUILDING_TYPE.DUNGEON, dungeonId: "wuxian_centipede_den",
      desc: "雾隐寨后山吊脚药楼下的毒瘴禁谷，五仙教世代在此炮制毒草药方、试药护坛，各路采药盗药高手云集其间。",
    },
];
