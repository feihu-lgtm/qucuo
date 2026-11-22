export default { district: {
  雾隐寨: {
    anchor: "紫岚藤桥",
    rooms: {
      紫岚藤桥: {
        x: 0, y: 0,
        desc: "两根合抱粗的老葛藤横跨十丈深涧，桥头挂着一串浸过雄黄的银铃，外人踏上木板时铃响三声，崖壁雾里立刻就有淬毒吹箭无声对准了来客咽喉。",
        exits: { e: "银铃吊脚集", w: "听虫演武坪", n: "五仙灵坛" },
        buildingId: "teahouse_wuxian",
      },
      银铃吊脚集: {
        x: 1, y: 0,
        desc: "依山搭起的竹木长街终日湿漉漉的，屋檐下垂着晒干的毒藤与彩色苗布，往来采药女腰间叮当作响，空气里飘着酸木瓜汤混着草药根茎的奇异辛香。",
        exits: { w: "紫岚藤桥", e: "百蛊药房", s: "酸汤竹灶" },
        buildingId: "inn_wuyinzhai",
        residentNpcName: "苏小青",
      },
      百蛊药房: {
        x: 2, y: 0,
        desc: "柜台后头百十个药抽屉没贴一张纸签，全靠掌柜阿萝闻味儿抓药。解瘴丹、断肠散和治跌打的草膏挨着放，外乡人买错了她多半会笑眯眯提醒你一句——看心情。",
        exits: { w: "银铃吊脚集" },
        buildingId: "medicine_wuxian",
        residentNpcName: "阿萝",
      },
      酸汤竹灶: {
        x: 1, y: 1,
        desc: "用湿泥糊成的苗家地灶，吊锅里常年咕嘟着红亮酸汤，墙上挂满腊肉、山椒与野菌。寨里人说，进了毒瘴谷要想不烂肠子，每天得吃三口滚烫酸辣。",
        exits: { n: "银铃吊脚集" },
        buildingId: "kitchen_wuxian",
      },
      听虫演武坪: {
        x: -1, y: 0,
        desc: "青石坪缝里长满滑脚的青苔，教中弟子练功专挑雨雾最浓的辰光。龙汐月常坐廊下甩鞭子，说外人练拳靠眼睛，苗疆功夫靠耳朵听草动。",
        exits: { e: "紫岚藤桥" },
        buildingId: "wuguan_wuxian",
        residentNpcName: "桑七",
      },
      五仙灵坛: {
        x: 0, y: -1,
        desc: "整座大殿建在一块天然青石坪上，五根合抱黑木柱上盘刻着蛇、蜈、蝎、蟾、守宫五灵浮雕，正中香炉里燃的不是檀香，而是能令常人头晕目眩的紫苏安神烟。",
        exits: { s: "紫岚藤桥", w: "五仙祖灵殿", e: "百蛊湿廊", n: "圣母沉香阁" },
        unlockCondition: { type: "flag", flag: "wuxian_invited" },
        buildingId: "sect_entry_wuxian",
        residentNpcName: "龙汐月",
      },
      五仙祖灵殿: {
        x: -1, y: -1,
        desc: "供奉着历代圣母牌位与五灵石像的幽暗石殿，终年点着松明火把。乌婆婆每天清晨来扫落叶，常在殿角晒些外头见不着的冷僻草根。",
        exits: { e: "五仙灵坛" },
        unlockCondition: { type: "flag", flag: "wuxian_invited" },
        buildingId: "temple_wuxian",
        residentNpcName: "乌婆婆",
      },
      百蛊湿廊: {
        x: 1, y: -1,
        desc: "半截嵌进湿冷崖壁的回廊里密密麻麻排着数百只黑陶蛊罐，罐口蒙着透气的油麻布，夜深人静时能听见细密的沙沙爬行声，像一场永远停不下来的小雨。",
        exits: { w: "五仙灵坛", n: "赤蜈毒窟" },
        unlockCondition: { type: "flag", flag: "wuxian_invited" },
        buildingId: "sectshop_wuxian",
      },
      赤蜈毒窟: {
        x: 1, y: -2,
        desc: "藏在吊脚楼地桩下方的天然溶洞，石壁渗着泛红的寒水，角落里堆着贴了蜀南唐门封条的铁木箱，空气里满是刺鼻的火药硫磺与赤蜈干尸混杂的腥气。",
        exits: { s: "百蛊湿廊" },
        unlockCondition: { type: "item", itemName: "赤蜈铜牌" },
        residentNpcName: "麻九娘",
      },
      圣母沉香阁: {
        x: 0, y: -2,
        desc: "悬在绝壁最高处的一座孤零零竹楼，唯有一道可收放的软梯通往下方；阁内却纤尘不染，案头插着新鲜的蜀中山茶，墙上挂着历代银冠圣母的手绘药谱。",
        exits: { s: "五仙灵坛" },
        unlockCondition: { type: "flag", flag: "wuxian_sanctum" },
      },
    },
  }
} };
