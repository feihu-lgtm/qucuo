const items = {
"旧护身符": {
    name: "旧护身符", category: "accessory", quality: "绿",
    sixDim: { 气运: 2 },
    desc: "锦官城镖师遗孀赵氏给亡夫求的，他戴了二十年。临死前托人送到你手里——符袋上还有他最后攥过的手温。护得住命，护不住命数。",
  },
"虎乳牙": {
    name: "虎乳牙", category: "accessory", quality: "蓝",
    effect: { lowHpBonus: 0.2 },
    sixDim: { 体魄: 1 },
    desc: "嘎则的白虎雪团换下的乳牙，根部用她辫子上的彩线缠了一圈。她说是借的——你若真不还，她会托巴桑带话：“利息是一包桂花糖”。越到绝境，虎性越壮。",
  },
"红线": {
    name: "红线", category: "accessory", quality: "白",
    sixDim: { 魅力: 1 },
    desc: "藏汉婚事上新娘卓嘎塞给你的。熊曲、鹰曲、狼曲三水都流进一条曲水——水都不分家。手绳编得不太齐，是她连夜赶出来的。",
  },
"界石下的土": {
    name: "界石下的土", category: "accessory", quality: "白",
    sixDim: { 气运: 1 },
    desc: "才旦从村口界石底座下捧的一小撮土，装在小布袋里。不是武功，不是财物，是有人在这地方站过。布袋口系着她自己的头发。",
  },
"半块银锁片": {
    name: "半块银锁片", category: "accessory", quality: "绿",
    sixDim: { 智谋: 1, 气运: 1 },
    desc: "卓央阿妈留下的银锁，兄妹各执一半。断口是旧痕，背面刻着“央”，巴桑那半块刻着“桑”。合在一起才看得出——不是锁，是只鹰。（黑风寨据点解锁凭证）",
  },
"青鸢私印": {
    name: "青鸢私印", category: "accessory", quality: "蓝",
    sixDim: { 智谋: 2, 魅力: 1 },
    desc: "柳青鸢的私人小印，印文只有“青鸢”二字。她把印按在纸上递给你：“拿去找罗琦，她认得我的字”。印纽雕的是一只收翅的鸟。持此印，江湖人高看一眼。",
  },
"狼曲石子": {
    name: "狼曲石子", category: "accessory", quality: "白",
    sixDim: { 体魄: 1 },
    desc: "一颗被狼曲河水冲圆的小石子，嘎则从狼曲石上挑的。她在手心握了很久才递给你，石头是温的——“那块石头的儿子，带它去山下见见世面”。",
  },
"百花引残香囊": {
    name: "百花引残香囊", category: "accessory", quality: "蓝",
    effect: { enemyCostPenalty: { value: 2, turns: 1 } },
    sixDim: { 悟性: -1 },
    desc: "兰姐用百花引残料缝的香囊，她自己不留——闻久了会忘了自己是谁。内衬绣了朵兰花，用她年轻时在昆明穿的旧裙线。香气缠人，也蚀心神。",
  },
"旧铜镜": {
    name: "旧铜镜", category: "accessory", quality: "紫",
    effect: { onCounterSuccessDamageRatio: 0.4 },
    sixDim: { 悟性: 2 },
    desc: "梵衍那故国王宫遗物，背面刻宫室图，细如发丝。罗琦每三天擦一次，不照自己——镜里的自己会越来越像阿雅婶，但镜背的人永远十九岁。以镜观敌，破绽尽显。",
  },
"熊山手绘地图": {
    name: "熊山手绘地图", category: "accessory", quality: "白",
    sixDim: { 悟性: 1, 气运: 1 },
    desc: "老猎户亲手画的熊山地形图，标注温泉位置。不是羊皮纸——是旧年历的反面，边角还印着“庚子年·宜出行”。识途者不慌。",
  },
"达摩药堂念珠": {
    name: "达摩药堂念珠", category: "accessory", quality: "绿",
    effect: { hpRestore: 0.06 },
    desc: "喇嘛庙药堂师父常挂的旧念珠，珠子被药汁浸成琥珀色。捻了十几年，有一颗裂了——“裂了就不用补，珠子里住进了药香”。捻珠调息，暗自回血。",
  },
"铃铛": {
    name: "铃铛", category: "accessory", quality: "蓝",
    effect: { freezeEnergyRecovery: true },
    desc: "嘎则辫子上系过的铃铛，响声不脆，闷闷的。她解下来给你时铃舌已经歪了——是雪团咬歪的，虎牙刚好卡进铃铛缝。铃声一闷，对手的调息乱了半拍。",
  },
"玉器轩断簪": {
    name: "玉器轩断簪", category: "accessory", quality: "白",
    sixDim: { 魅力: 1 },
    desc: "天都镇玉器轩的旧玉簪，簪头雕如意云纹，断了一小截。掌柜说是个老牧民拿来当的，当期过了没赎——后来听说老牧民是扎西的阿爸。",
  },
"守宫砂": {
    name: "守宫砂", category: "accessory", quality: "蓝",
    effect: { applyMark: { name: "内伤印", stacks: 1 }, applyMarkChance: 0.25 },
    desc: "白塔守塔僧团的护身符，形如一滴干涸朱砂。兰姐收来当百花引辅料，但有一颗怎么也化不开——“这颗不是砂，是执念”。执念附身，触之留痕。",
  },
"燕羊胎石": {
    name: "燕羊胎石", category: "accessory", quality: "绿",
    effect: { hpRestore: 0.05 },
    sixDim: { 魅力: 1 },
    desc: "大草甸燕羊胎里取出的小石子，光滑如卵。百花楼的姑娘们贴身带一颗——不是催情，是它在体温下会散发极淡奶香，治痛经比药好，也养神。",
  },
"青铜鸢": {
    name: "青铜鸢", category: "accessory", quality: "橙",
    effect: { enemyCostPenalty: { value: 2, turns: 2 }, onCounterSuccessEnergyGain: 2 },
    sixDim: { 智谋: 2 },
    desc: "柳青鸢软鞭的鞭梢铜坠，雕成收翅青鸢。老兵说她装了这坠后再没抽断过树枝——不是准头好了，是不忍心让鸟喙再啄树。缠敌于无形，收放皆在一念。",
  },
"藏银耳坠": {
    name: "藏银耳坠", category: "accessory", quality: "白",
    sixDim: { 魅力: 2 },
    desc: "卓玛十六岁生日扎西托人从锦官城打的一对，银丝绕成狼曲河湾的形状。她舍不得戴，红布包着压枕头底下三年——直到发现左坠被压弯才赶紧戴上。",
  },
"鸡足山贝叶经残片": {
    name: "鸡足山贝叶经残片", category: "accessory", quality: "紫",
    effect: { energyRestore: 2 },
    sixDim: { 悟性: 3 },
    desc: "梵衍那从大理带来的旧经残叶，纸缘焦黑，兵燹中抢出。他不让任何人碰——罗琦说那上面的梵文不是经文，是他母亲的名字。诵之凝神，真气自生。",
  },
"黑风寨木牌": {
    name: "黑风寨木牌", category: "accessory", quality: "白",
    sixDim: { 魅力: 1, 气运: 1 },
    desc: "巴桑给过路人的通行木牌，刻着狼头印记，刀法粗朴。背面歪歪扭扭刻着“说话算话”——嘎则刻的，巴桑嫌丑，但每块木牌都用了。持牌行走狼曲，无人为难。",
  },
"老兵烟斗": {
    name: "老兵烟斗", category: "accessory", quality: "白",
    effect: { lowHpBonus: 0.1 },
    desc: "老兵退伍汉用了十几年的烟斗，斗钵磕掉一小块瓷。他说是战场上磕的——趴地上装死，烟斗硌着胸口，敌人走过去他才敢翻身。烟斗还在，敌人不在了。命悬一线时，反而稳。",
  },
// ── 丐帮三星分舵（广汉） ──
"磨损藏银火镰": { name: "磨损藏银火镰", category: "accessory", quality: "紫", sixDim: { 魅力: 2, 气运: 2 }, desc: "三十年前老土司桑杰大侠随手赠给落难少年的防身火镰，银面磨得发亮，刻着残缺的鱼定纹。严九斤一直贴身带着。" },
"铜框单边镜": { name: "铜框单边镜", category: "accessory", quality: "蓝", sixDim: { 智谋: 2 }, desc: "广汉老匠人配的铜框水晶单边镜，缺了一条腿。周小满靠它夜读小字，辨认伪契上的墨迹。" },
"红绳铜哨": { name: "红绳铜哨", category: "accessory", quality: "绿", sixDim: { 魅力: 1 }, desc: "拴着红绳的铜哨，一吹便能召集方圆三里内的分舵弟子结阵。胡三爷吹它从来不用第二声。" },
"响铃铜钱串": { name: "响铃铜钱串", category: "accessory", quality: "绿", sixDim: { 魅力: 1, 气运: 1 }, desc: "一串磨亮的乾元通宝穿在红绳上，中间吊颗小铜铃，走一步响一声。秦小鹊从来不数里头有几枚，输光了就解一枚下来押。" },
"缺齿黄杨算盘": { name: "缺齿黄杨算盘", category: "accessory", quality: "蓝", sixDim: { 智谋: 2 }, desc: "白婶亡夫留下的黄杨算盘，缺了两颗珠子，却比谁的都算得快。" },
"断耳牦牛角坠": { name: "断耳牦牛角坠", category: "accessory", quality: "绿", sixDim: { 体魄: 1 }, desc: "多吉逃离玉泉寨前，从老牧场捡来的半截牦牛角，磨成了坠子。他说等打回去，要把家里两头白牦牛牵回来。" },
"青铜小铃": { name: "青铜小铃", category: "accessory", quality: "紫", sixDim: { 悟性: 2, 气运: 1 }, desc: "百年前三星派赠给历代守约人的信物。摇起来没有声音——只有走进古墟的雾里，它才会响。" },
"铜铃竹哨": { name: "铜铃竹哨", category: "accessory", quality: "绿", sixDim: { 身法: 1 }, desc: "察世堂外围探子常用的小哨，佩在腰间身法微增，野外遇险吹响能惊走埋伏的人。" },
"紫皮闷倒驴葫芦": { name: "紫皮闷倒驴葫芦", category: "accessory", quality: "紫", effect: { energyRestore: 1 }, sixDim: { 体魄: 1 }, desc: "严九斤托老皮匠缝的紫皮酒葫芦，装的是能闷倒一头驴的烧酒。佩着它，每回合都像抿了一口。" },
"八袋长老令": { name: "八袋长老令", category: "accessory", quality: "紫", sixDim: { 魅力: 2, 智谋: 1 }, desc: "严九斤亲手交给你的八袋长老竹令，背面刻着「三星分舵」。拿着它在川西任何一个叫花子面前亮一亮，都有人替你传话。" },
// ── 三星派（广汉古蜀青铜神树墟）──
"青铜纵目护符": { name: "青铜纵目护符", category: "accessory", quality: "蓝", sixDim: { 悟性: 1 }, effect: { immuneControl: true }, desc: "缩微浇铸的青铜小面具吊坠，佩在胸前令人头脑清明，不易中迷香与心神控制。" },
"赤炉青铜护腕": { name: "赤炉青铜护腕", category: "accessory", quality: "蓝", sixDim: { 体魄: 1, 根骨: 1 }, desc: "樊枯拿修补神树铜枝的余料替你浇的一副护腕，火候极纯，铜色泛着金红。" },
"神鸟金箔佩": { name: "神鸟金箔佩", category: "accessory", quality: "紫", sixDim: { 悟性: 1, 气运: 1 }, desc: "拼合太阳神鸟残片时剩下的一缕金箔，樊枯把它压进铜框做成佩饰。十二道光芒绕着四只神鸟，挂在身上暖烘烘的。" },
"古蜀赤铜火印": { name: "古蜀赤铜火印", category: "accessory", quality: "紫", sixDim: { 体魄: 1 }, desc: "三星派掌炉长老的信物，赤铜方印上刻着古蜀火纹，握在手里总是温的。" },
"太阳神鸟小铜镜": { name: "太阳神鸟小铜镜", category: "accessory", quality: "蓝", sixDim: { 身法: 1 }, desc: "巴掌大的铜镜，背面铸着太阳神鸟。姜泠拿它反光探路，也是三星派对外走动的凭证。" },
"狼牙骨哨": { name:"狼牙骨哨", category:"accessory", quality:"蓝", sixDim:{ 身法: 1 }, tags:["饰品","哨子","天龙教"], desc:"狼牙磨成的骨哨，吹起来声音尖得像风钻谷口。哨卡上靠它传讯——一声是来人，两声是来人带了刀。" },
"银针包": { name:"银针包", category:"accessory", quality:"蓝", sixDim:{ 身法: 1 }, tags:["饰品","医具"], desc:"羊皮缝的小包，里头一排银针按长短排着。贺兰昭的针走穴快过走药——她下针时病人总觉得先好了半分。" },
"天龙教主令": { name:"天龙教主令", category:"accessory", quality:"紫", sixDim:{ 魅力: 2 }, tags:["饰品","令牌","天龙教"], desc:"蟠龙纹玄铁令，教主亲发的随身信物。持此令者在天龙教营地通行无阻——玄甲兵见令先低头，再抬头看你的脸。" },
"旧天王印": { name:"旧天王印", category:"accessory", quality:"紫", sixDim:{ 气运: 1, 魅力: 1 }, tags:["饰品","印信","白衣旧部"], desc:"安世衡当年用的旧印，白玉质，印面「止戈」二字磨得发圆。如今它只是一方石头——旧部看见它还是会站直。" },
"止戈玉令": { name:"止戈玉令", category:"accessory", quality:"橙", sixDim:{ 气运: 2, 魅力: 1 }, tags:["饰品","令牌","白衣旧部","秘货"], desc:"天王一脉的玉令，白玉上只刻「止戈」二字。持令的人不是来打仗的——旧部认它，认的是那个抄经抄了半辈子的老人。" },
};

export default { item: items, itemGroup: { ACCESSORIES: Object.keys(items) } };
