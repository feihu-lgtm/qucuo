export default { residentGroup: {
鱼定村: [
    {
      name: "才旦", id: "resident_caidan", levelCap: 1,
      brief: "村长之女，账算得滴水不漏",
      personality: "工于心计说话不留破绽，卸下防备才露出年纪相符的脆弱",
      carry: [
        { name: "鱼定猎刀", category: "weapon", quality: "白" },
        { name: "鱼定粗布短打", category: "armor", quality: "白" },
        { name: "村社护佑结", category: "accessory", quality: "白" },
        { name: "才旦的薄荷脑", category: "misc", quality: "白" },
        { name: "酥油炒面", category: "misc", quality: "白" },
        { name: "青稞饼", category: "misc", quality: "白" },
        { name: "止血散", category: "misc", quality: "白" },
      ],
    },
    {
      name: "老孙", id: "resident_laosun", levelCap: 1,
      brief: "老孙饭馆的掌柜",
      personality: "实在憨厚，藏着当年被岳父嫌弃的心结，嘴上不饶人心里认账",
      carry: [
        { name: "市集杀猪刀", category: "weapon", quality: "白" },
        { name: "熊皮坎肩", category: "armor", quality: "绿" },
        { name: "脚夫铜牌", category: "accessory", quality: "白" },
        { name: "老孙饭馆的糌粑", category: "misc", quality: "白" },
        { name: "熊曲鱼汤面", category: "misc", quality: "绿" },
        { name: "青稞酒", category: "misc", quality: "白" },
        { name: "牦牛粪饼", category: "misc", quality: "白" },
      ],
    },
    {
      name: "鱼定大娘", id: "resident_yudingdaniang", levelCap: 1,
      brief: "村里的厨娘，热心肠，谁上山都塞一包炒面",
      personality: "爽利豪快爱张罗，主张藏汉不分家（「水都不分家，人分什么家」），儿子小孙与张商人之女私定终身，正为两家老人不点头发愁",
      carry: [
        { name: "熊山柴斧", category: "weapon", quality: "白" },
        { name: "乡勇布甲", category: "armor", quality: "白" },
        { name: "村社护佑结", category: "accessory", quality: "白" },
        { name: "艾草止血贴", category: "misc", quality: "白" },
        { name: "酥油炒面", category: "misc", quality: "白" },
        { name: "甜奶茶", category: "misc", quality: "白" },
        { name: "牦牛骨髓粉", category: "misc", quality: "白" },
      ],
    },
    {
      name: "大公鸡", id: "resident_dagongji", levelCap: 1,
      beast: true, respawn: true, cannotSpeak: true,
      brief: "村口一只油亮好斗的大公鸡",
      personality: "扑棱着翅膀满地乱窜，见人就啄，偏偏又打不过就跑、跑两步又回头挑衅",
      carry: [
        { name: "乡勇木棓", category: "weapon", quality: "白" },
        { name: "乡勇布甲", category: "armor", quality: "白" },
        { name: "村社护佑结", category: "accessory", quality: "白" },
        { name: "金蛋", category: "misc", quality: "绿" },
        { name: "牦牛粪饼", category: "misc", quality: "白" },
        { name: "熊山松茸", category: "misc", quality: "白" },
        { name: "狼曲冷水鱼", category: "misc", quality: "白" },
      ],
    },
    {
      name: "雪豹", id: "resident_snow_leopard", levelCap: 2,
      beast: true, cannotSpeak: true, companionCandidate: true,
      brief: "无主的雪白灵兽，前爪有旧伤，只认有灵之人，长卧村口青石",
      personality: "不惧生人也不主动亲近，只是静静看着，仿佛在等一个自己认准的人",
      fullBio: `归属与命定（重要·纠正旧误传）：这头通体雪白的雪豹，并非嘎则或任何人的
兽——嘎则养的是白虎雪团，与它无关。它无主，自雪线之上而来，长长久久卧在村口
那块青石上，不亲近谁，也不归谁所有，只静静等着一个它自己认准的人。那个人是
玩家，且只能是玩家。它与玩家之间是命定的羁绊，前世便结下的缘分，一旦认主便
忠贞无二，此生只随玩家一人，旁人再不能使它低头。它不通人言，喜怒哀乐全凭动作、
眼神、姿态传达——以额抵掌、绕身而行、伏低臣服，都是它不必开口的情意。

兽形之貌：通体雪白不带一丝杂色，唯耳尖尾梢缀着几枚墨斑，金瞳沉静如琥珀，
粗长的尾巴随呼吸轻轻起伏。卧时像一尊雪塑的兽像，动时却快得只剩一道白影。

化形之伏笔：乡间有极老的传闻，说雪线之上的灵兽若与认主之人情深至此，便能褪去
兽身、化为人形相伴——但那要等情意攒到极深才成，眼下它仍是一头安静的兽，卧在
玩家脚边，把这份没说出口的认定，一寸寸攒着。（化形后的形貌与私密性情，待情意
足够时方显，此处不表。）`,
    },
    {
      name: "珍珠", id: "resident_pearl", levelCap: 2,
      beast: true, cannotSpeak: true, companionCandidate: true, affectionable: true,
      brief: "村口一匹通体雪白的小白马，睫毛长长，丰神俊朗，此刻正低着头专心啃草",
      personality: "志不在驰骋，平生最爱干饭与躺平，看着惫懒，认主后却忠心无二、脚力惊人",
      carry: [
        { name: "珍珠的缰绳", category: "accessory", quality: "蓝" },
        { name: "藏纹小马鞍", category: "armor", quality: "绿" },
        { name: "一袋青稞精料", category: "misc", quality: "绿" },
        { name: "晒干的苜蓿草", category: "misc", quality: "白" },
      ],
      fullBio: `长相与名字：珍珠是一匹通体雪白的小白马，名字正来源于这一身珍珠似的白毛。
它长得颇为俊美，睫毛长长的，丰神俊朗，是那种一眼就让人想多看两眼的马。可它
原本有个浪漫的藏语名字，叫"哈瓦夏日"，译过来是"灰色的梅花鹿"——跟它这身白
完全不搭，像是谁随口起的，又像是它骨子里那点不肯随俗的劲儿。

反差萌的性子：与旁人"赛马王子"的想象相反，珍珠对比赛毫无兴趣。它平生两大爱好——
专心干饭，就地躺平。你骑它，它走两步就要低头啃草；你催它，它甩甩尾巴当没听见。
村里人都说它志不在夺冠，更适合当个无忧无虑的宠物。可真正认了主、真要护主的时候，
这匹马撒开四蹄快得像一道白影，脚力强健得吓人——那份惫懒底下，藏着的是不肯轻易
示人的真本事。

坐骑之身：它此刻是被人骑着的坐骑，温顺地立在村口，由着人上下，只是眼神里总带着
一点"快点结束我好去吃饭"的淡定。它认主，且只认一个——一旦认准了，便忠心无二，
驮着那人走再远的路也不抱怨（顶多路上多啃两口草）。它不会说话，喜怒哀乐全凭嘶鸣、
甩尾、低头蹭人传达，是一匹把情意都放在四蹄上的马。`,
    },
  ]
} };
