// ============================================================================
// 曲措乡·补货批次「收尾」共 24 件
// 依据《物品四维分布总表》3.2 节点名的收尾缺口生成：
//   ① 红档通货武器（可买的红档兵器，非神兵）× 5
//   ② 白/绿低阶饰品 × 9
//   ③ 白族（大理）可售谱系 × 6
//   ④ 异域（天竺）白档器物 × 4
// 全部逐件 grep 过现有 335 品名，无撞名。字段严守提示词规则：
//   不写 atk/def/price/durability；不带人名；红档武器挂通货级特效而非神兵组合。
// 用法：整段贴进 src/items/catalog.js 的 SUNDRIES 数组内（虎王筋条目之后、578 行 ] 之前）。
// ============================================================================

// ── ① 红档通货武器 × 5（能买到的红档兵器，特效克制，避开神兵专属组合）──
{ name: "百炼玄铁大刀", category: ITEM_CATEGORY.WEAPON, quality: "红", tags: ["通货", "重兵"], effect: { ignoreDefense: true }, desc: "锦官城铸剑坊接了大主顾才肯开炉的一批重刀，百炼折叠的刀身黑得发青，寻常皮甲铁甲一概当纸糊，价钱也贵得能买半座宅子。至于用得动用不动，铁匠只笑不答，说买得起的自然抡得起。" },
{ name: "赤铜错金枪", category: ITEM_CATEGORY.WEAPON, quality: "红", tags: ["通货", "长兵"], effect: { forceFirst: true }, desc: "官造军械里最扎眼的一杆长枪，枪杆赤铜错着金线，出手快得对方还没看清就已中招。原是给品级够高的武官配的仪仗，流到市面上的都是有门路的人转手，寻常铺子摆不出这么一杆。" },
{ name: "寒锋七星剑", category: ITEM_CATEGORY.WEAPON, quality: "红", tags: ["通货", "名匠"], effect: { forceCrit: true }, desc: "剑脊上嵌着七枚北斗样的星纹，据说是某位隐姓名匠晚年一年只出三口的活儿。剑虽利，却不认人,谁使都是一样的锋,故而算不得独一份的名器,只是贵得离谱的一件好货罢了。" },
{ name: "镔铁破阵斧", category: ITEM_CATEGORY.WEAPON, quality: "红", tags: ["通货", "重兵"], effect: { highHpBonus: 0.3 }, desc: "边军里淘汰下来的破阵重斧，斧头厚得能当砧板，人越是气力充沛这一斧劈得越狠，脱了力反倒抡不圆。军中说这斧子挑人，挑的不是身份，是那口还没泄的气。" },
{ name: "点睛乌金鞭", category: ITEM_CATEGORY.WEAPON, quality: "红", tags: ["通货", "软兵"], effect: { nullifyStatusOnHit: true }, desc: "十三节乌金软鞭，节节相扣如活蛇，鞭梢一点便能把对方刚运起的花招震散。会使的人不多，肯花大价钱买的更少，铺子里挂着更多是充门面，真买走的据说都不是善茬。" },

// ── ② 白/绿低阶饰品 × 9（各地风味,白绿为主,小六维或不带效果）──
{ name: "牛骨素圈", category: ITEM_CATEGORY.ACCESSORY, quality: "白", tags: ["饰品", "藏地"], desc: "玉泉寨牧人拿吃剩的牦牛胫骨磨的素圈，不錾花不镶石，戴手上凉丝丝的。牧女说磨得越亮的准是戴了十几年的，新的那批白得刺眼，一看就没经过日子。" },
{ name: "红绳桃核串", category: ITEM_CATEGORY.ACCESSORY, quality: "白", tags: ["饰品", "平安"], desc: "鱼定村妇人给出远门的人串的桃核，一颗颗自己啃的核，红绳是染布剩的边角。挡不了刀枪，倒是攥在手里心里踏实，走夜路的人多半兜里揣着一串。" },
{ name: "铜钱压襟", category: ITEM_CATEGORY.ACCESSORY, quality: "白", tags: ["饰品", "市井"], desc: "天都镇小贩把穿旧了的制钱编成压襟坠子，走起路来叮当响。图个财气，也图个响动——夜里独行,响声比刀还壮胆。" },
{ name: "松石小坠", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", tags: ["饰品", "藏银"], sixDim: { 魅力: 1 }, desc: "喇嘛庙山下摊子上论堆卖的松石坠，成色参差，好的那几颗蓝得正,配上藏银托子颇能唬人。香客求个吉利,牧女图个好看,倒也各取所需。" },
{ name: "缠丝玛瑙牌", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", tags: ["饰品", "当铺"], sixDim: { 气运: 1 }, desc: "天都镇当铺里压了几年没人赎的玛瑙牌，缠丝的纹路像水波,当铺老板嫌占地方,肯让价出。据说原主戴着它赢过几回钱,后来输光了连它一起当了——玛瑙无辜,运气这东西本就不长在一件物件上。" },
{ name: "银鎏花簪", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", tags: ["饰品", "锦官"], sixDim: { 魅力: 2 }, desc: "锦官城金玉行给寻常人家姑娘备的鎏银花簪，样子仿的是官眷诰命簪，鎏的却是薄薄一层银，戴出去远看体面近看便知深浅。掌柜从不点破,买的人也心知肚明。" },
{ name: "结绳护腕串", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", tags: ["饰品", "山寨"], sixDim: { 体魄: 1 }, desc: "黑风寨弟兄拿牛皮条编的护腕串，缠三圈打个死结，说是护腕其实更像个念想——上山的人一人一条,断了就知道少了个人。寨里妇人手快,一晚上能编七八条。" },
{ name: "冷水鱼骨坠", category: ITEM_CATEGORY.ACCESSORY, quality: "白", tags: ["饰品", "山野"], desc: "狼曲冷水鱼的脊骨晒干磨圆穿成的坠子，泛着淡青的光。捞鱼的娃娃拿它当稀罕玩意换糖吃,大人戴着倒说压水汽,常年在河边讨生活的图这么个说法。" },
{ name: "羊脂玉平安扣", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", tags: ["饰品", "锦官"], sixDim: { 根骨: 1 }, desc: "锦官城金玉行的中档货，一块囫囵的羊脂玉钻个孔,不雕花只求个圆满。买的多是给小辈压岁的长辈,说玉能养人,戴住了骨头都结实些——真假不论,这份心思是真的。" },

// ── ③ 白族(大理)可售谱系 × 6（补兵器/器物/衣饰,填异乡缺口）──
{ name: "大理苍山剑", category: ITEM_CATEGORY.WEAPON, quality: "蓝", tags: ["白族", "长剑"], effect: { forceFirst: true }, desc: "大理苍山下铁铺出的窄身长剑，剑格上錾着白族的雪花纹,轻快灵巧,是随梵衍那这一路流亡人带过来的家乡样式。用惯了藏刀汉剑的人初上手嫌它飘,使顺了才知道这份巧劲另有门道。" },
{ name: "白族扎染披肩", category: ITEM_CATEGORY.ARMOR, quality: "绿", tags: ["白族", "衣物"], desc: "大理白族妇人板蓝根染的披肩，蓝底上洇开一朵朵素白的花，说不上挡什么,风寒夜露倒是能遮一遮。异乡人裹着它,像把大理的天也带来了半片。" },
{ name: "点苍茶刀", category: ITEM_CATEGORY.WEAPON, quality: "绿", tags: ["白族", "短兵"], desc: "大理人分茶饼用的小茶刀,巴掌长,原不是兵器,可流落江湖的白族人贴身藏一把,急了也能捅人。刃口薄得能片下一层茶,握柄是点苍山的老黄杨,盘得发亮。" },
{ name: "白族银泡帽", category: ITEM_CATEGORY.ARMOR, quality: "蓝", tags: ["白族", "护具"], sixDim: { 魅力: 1 }, effect: { freezeEnergyRecovery: true }, desc: "大理白族少女出嫁戴的银泡帽，一圈圈缀满小银泡,叮当作响。硬皮衬里意外挡得住闷棍,只是戴出来太扎眼,流亡在外的白族人多半收进箱底,舍不得戴也不敢戴。" },
{ name: "苍洱桂花油", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["白族", "香品"], consumable: { sixDimTemp: { 魅力: 1 }, buffDuration: 20 }, desc: "大理白族拿苍山桂花窨的头油,抹一点满头香气,能压住旅途风尘味。异乡开香铺的人卖它卖得最贱,说不图挣钱,图买的人问一句'这是大理的桂花吗'。" },
{ name: "白族三道茶", category: ITEM_CATEGORY.MISC, quality: "绿", tags: ["白族", "茶饮"], consumable: { hpRestore: 0.12, energyRestore: 1 }, desc: "一苦二甜三回味的白族待客茶,头道烤得焦苦,二道搁了核桃红糖,三道添花椒姜片。走远路的人讨一碗,苦过甜过,那点辛麻的回味竟把浑身的乏都逼出来了几分。" },

// ── ④ 异域(天竺)白档器物 × 4（补低阶谱系,欢喜堂/大理可售）──
{ name: "天竺粗香饼", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["天竺", "香品"], desc: "欢喜堂外院随手施舍给香客的粗香饼,料杂,燃起来烟大味冲,却是最不值钱也最不迷人的一种——教里人说,肯让你闻的香,才是没打你主意的香。" },
{ name: "天竺棉布缠头", category: ITEM_CATEGORY.ARMOR, quality: "白", tags: ["天竺", "衣物"], desc: "天竺流亡人惯裹的长条棉布缠头,一圈圈绕上七八尺,挡日头也挡风沙。缠得好的能垫一垫闷棍,缠不好的自己先绊倒。异乡人认这个,老远看缠头的绕法就知是不是同乡。" },
{ name: "贝叶抄经纸", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["天竺", "杂货"], desc: "欢喜堂裁下的空白贝叶,压平晾干可抄经也可记账。教里穷,好纸舍不得,便拿这个抵。识字的异乡人攒一沓,说等攒够了要把家乡的事从头写一遍——写给谁看,他们也不知道。" },
{ name: "天竺赤陶油灯", category: ITEM_CATEGORY.MISC, quality: "白", tags: ["天竺", "器物"], desc: "欢喜堂供役自己捏的赤陶小油灯,粗手粗脚一个坯,灌上迦南脂的边角料就能点。夜里欢喜堂后院一排排点起来,昏黄一片,倒比正殿的鎏金大灯更像个有人住的地方。" },
