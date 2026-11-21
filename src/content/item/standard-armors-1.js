const items = {
"乡勇布甲": { name: "乡勇布甲", category: "armor", quality: "白", defMul: 1.0, standardIssue: true, desc: "团练发的粗麻缝棉甲，前襟一块补丁摞补丁。挡不住刀，挡得住冷——多数乡勇一辈子只指望它挡冷。" },
"脚夫护肩": { name: "脚夫护肩", category: "armor", quality: "白", defMul: 1.05, standardIssue: true, desc: "天都镇脚行统一发的皮护肩，扛货压出来的包浆比铠甲还厚。江湖人拿它当轻甲使——图的是不起眼，混在人堆里没人多看一眼。" },
"巡捕营皂隶衣": { name: "巡捕营皂隶衣", category: "armor", quality: "绿", defMul: 1.2, standardIssue: true, desc: "土司府巡捕营的青黑制式服，衣摆压铅边防风也防人扯。穿上它在鱼定村走一圈，牧民的门都关得快一点——不是怕人，是怕这身衣裳。" },
"马帮硬皮褂": { name: "马帮硬皮褂", category: "armor", quality: "绿", defMul: 1.15, standardIssue: true, desc: "鹰曲马帮走高原的耐磨皮褂，桐油反复浸过，硬挺得能挂在墙上立着。褂子越旧越值钱——旧，说明主人跑了很多趟还活着。" },
"锦官坊标兵甲": { name: "锦官坊标兵甲", category: "armor", quality: "蓝", defMul: 1.3, standardIssue: true, desc: "铸剑坊配套打的制式扎甲，甲片一色的青灰，编绳一色的麻黄。一队差役穿出来齐整威风，但老兵嫌它腋下卡——柳青鸢改软甲版型，就是被这甲逼的。" },
"守塔僧团铁网衲": { name: "守塔僧团铁网衲", category: "armor", quality: "蓝", defMul: 1.35, standardIssue: true, desc: "白塔守塔僧统一的铁网夹层僧衲，比外袍那件轻些，是巡夜用的。地宫里潮，铁网锈得慢却锈得匀，一件衲子传三代守塔僧，锈色就是年轮。" },
"雪山派御寒裘": { name: "雪山派御寒裘", category: "armor", quality: "紫", defMul: 1.4, standardIssue: true, effect: { hpRestore: 0.08 }, sixDim: { 根骨: 2 }, desc: "雪山派弟子上顶峰当值统一配的羊羔皮裘，内衬缝了艾草。比雪豹裘轻贱得多，却是弟子们真正天天穿的那件——真金白银的宝物锁在箱底，护命的是这些不起眼的制式货。" },
"欢喜堂内院锦襕": { name: "欢喜堂内院锦襕", category: "armor", quality: "紫", defMul: 1.35, standardIssue: true, effect: { enemyCostPenalty: { value: 1, turns: 1 } }, sixDim: { 魅力: 1, 智谋: 1 }, desc: "欢喜堂内院弟子统一的暗红锦襕，比礼服素，日常穿。锦线里掺了极细的香丝，穿久了自己闻不出，别人一近身先恍神半瞬——罗琦说这是梵衍那的主意，她不喜欢。" },
"土司府仪卫明光铠": { name: "土司府仪卫明光铠", category: "armor", quality: "橙", defMul: 1.5, standardIssue: true, effect: { onCounterSuccessDamageRatio: 0.3 }, desc: "骑手方阵的制式明光铠，胸背两面圆护擦得能照见人。格桑顿珠不许手下把铠甲当摆设——每副都配实战绑带，挨了打能顺势卸力反撞。中看的皮相底下，是真练过的骨头。" },
"官铸镇边重铠": { name: "官铸镇边重铠", category: "armor", quality: "红", defMul: 1.6, standardIssue: true, effect: { onCounterSuccessDamageRatio: 0.4, ignoreDefensePartialImmune: 0.3 }, sixDim: { 根骨: 2, 体魄: 2 }, desc: "锦官军械库封存的戍边重铠，全身鱼鳞甲片，一个人穿不动，得两个人抬着套。太平年月锁在库里生绿锈，柳青鸢摸着冰凉的甲片想：上一个穿它的人，六年前跟着上司一起，没回来。" }
};

export default { item: items, itemGroup: { STANDARD_ARMORS: Object.keys(items) } };
