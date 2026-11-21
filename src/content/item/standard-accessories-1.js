const items = {
"村社护佑结": { name: "村社护佑结", category: "accessory", quality: "白", sixDim: { 气运: 1 }, standardIssue: true, desc: "鱼定村口经幡拆下的旧布条打的结，家家门楣挂一个。不灵验，但挂着心安——才旦说，心安本身就是一种灵验。" },
"脚夫铜牌": { name: "脚夫铜牌", category: "accessory", quality: "白", sixDim: { 体魄: 1 }, standardIssue: true, desc: "天都镇脚行发的记工铜牌，穿绳挂脖子上，磨得字都平了。扛一趟货刻一道，牌子越油亮，肩膀越结实——也越驼。" },
"巡捕营腰牌": { name: "巡捕营腰牌", category: "accessory", quality: "绿", sixDim: { 魅力: 1, 智谋: 1 }, standardIssue: true, desc: "巡捕营制式腰牌，火漆烙号。亮出来能唬住半条街的市井混混——但在真认得土司府门道的人面前，这牌子反而是个把柄。" },
"马帮路引": { name: "马帮路引", category: "accessory", quality: "绿", sixDim: { 气运: 1, 智谋: 1 }, standardIssue: true, desc: "鹰曲马帮通用的过路凭信，牛皮上烙鹰纹，背面盖了沿途各卡的骑缝章。章越多越好使——每一个章都是一次“这人以前来过、没惹事”的背书。" },
"锦官验讫牙牌": { name: "锦官验讫牙牌", category: "accessory", quality: "蓝", sixDim: { 智谋: 2 }, standardIssue: true, desc: "锦官城官市统一发的验货牙牌，商户凭它进出。牌上一道道刻痕是历年验讫的记录——懂行的人拿到手先数刻痕，数完就知道这商户底子有多深。" },
"雪山问心珠": { name: "雪山问心珠", category: "accessory", quality: "蓝", effect: { energyRestore: 1 }, sixDim: { 悟性: 1 }, standardIssue: true, desc: "雪山派弟子入门统一分的一串素木珠，十八颗，不值钱。师父说犯难时捻一颗问一句心——珠子答不了，但捻着捻着，人自己就答了。" },
"欢喜堂持斋牌": { name: "欢喜堂持斋牌", category: "accessory", quality: "紫", effect: { freezeEnergyRecovery: true }, sixDim: { 魅力: 1 }, standardIssue: true, desc: "欢喜堂外围信众统一佩的持斋牌，暗红漆木刻梵字。牌子熏过堂里的香，佩久了自己那点心事就淡了——罗琦说这才是最厉害的地方，不用下药，人自己就交出去了。" },
"土司府门客玉扣": { name: "土司府门客玉扣", category: "accessory", quality: "紫", sixDim: { 魅力: 2, 智谋: 1 }, standardIssue: true, desc: "土司府养的清客门人统一佩的青玉扣，形制一色，只在成色上分高下。管家陆福生最会看这个——一眼扫过谁的玉扣发暗，谁就该被从名单上划掉了。" },
"官眷诰命簪": { name: "官眷诰命簪", category: "accessory", quality: "橙", effect: { onCounterSuccessEnergyGain: 2 }, sixDim: { 魅力: 3 }, standardIssue: true, desc: "锦官城按品级颁给官眷的制式银簪，簪头花样定死了不许僭越。柳青鸢有一支，从没戴过——她说这簪子的花样是别人替她定的，连她该是什么身份，都不用她自己开口。" },
"御赐銮铃": { name: "御赐銮铃", category: "accessory", quality: "红", effect: { enemyCostPenalty: { value: 2, turns: 2 }, onCounterSuccessEnergyGain: 2 }, sixDim: { 魅力: 2, 智谋: 2 }, standardIssue: true, desc: "本是官驿快马统一悬的铜銮铃，铃声一响沿途让道——太平年月早不用了，成了库房里论堆称的旧物。可老驿卒说，六年前有一队人快马出城，銮铃摇得整条官道都静下来，那之后就再没听过这声了。" }
};

export default { item: items, itemGroup: { STANDARD_ACCESSORIES: Object.keys(items) } };
