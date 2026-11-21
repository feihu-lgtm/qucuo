const items = {
"鱼定猎刀": { name: "鱼定猎刀", category: "weapon", quality: "白", atkMul: 1.1, standardIssue: true, desc: "鱼定村三曲交汇处最常见的猎刀，刀柄缠着旧布条。杀猪宰羊、防身赶狼都用它，钝了在门槛石上蹭两下又能用。" },
"狼曲短猎矛": { name: "狼曲短猎矛", category: "weapon", quality: "白", atkMul: 1.1, standardIssue: true, desc: "玉泉寨牧民防狼用的短矛，矛尖是旧马蹄铁打扁磨出来的。牧民说扎狼要扎脖子，扎身上它还能咬你一口。" },
"锦官巡街棍": { name: "锦官巡街棍", category: "weapon", quality: "白", atkMul: 1.05, standardIssue: true, desc: "锦官城差役配发的红漆硬木棍，漆面磨得斑驳。打人不见血、留得住活口——差役说这是规矩，也是本事。" },
"熊山柴斧": { name: "熊山柴斧", category: "weapon", quality: "白", atkMul: 1.15, standardIssue: true, desc: "大草甸和熊山进山的人都背一把伐木斧，开过刃。劈柴劈得，遇上野物一斧下去也劈得——就是抡起来慢，得算准了再落。" },
"天都短匕": { name: "天都短匕", category: "weapon", quality: "白", atkMul: 1.1, standardIssue: true, desc: "天都镇市井常见的护身短匕，鞘上刻着摊主自家记号。买的人多半不为杀人，为的是走夜路心里有个底。" },
"孟记弯刀": { name: "孟记弯刀", category: "weapon", quality: "绿", atkMul: 1.25, standardIssue: true, desc: "天都镇孟记铁铺的招牌货，刀背加厚、适合劈砍，马帮最爱。孟铁匠说这刀的好处是“钝了也能砸，砸不动了还能当柴刀”。" },
"雪山巡山剑": { name: "雪山巡山剑", category: "weapon", quality: "绿", atkMul: 1.2, standardIssue: true, desc: "雪山派外门弟子的制式佩剑，剑身窄长，适合雪地步战。比传习剑素得多，是弟子入门头三年用的——练废了不心疼。" },
"喇嘛庙戒刀": { name: "喇嘛庙戒刀", category: "weapon", quality: "绿", atkMul: 1.2, standardIssue: true, effect: { hpRestore: 0.05 }, desc: "喇嘛庙护寺僧的佩刀，刀镡刻六字真言，开过光的护身兵器。僧人说这刀不为杀生，为的是“让起了歹念的人，看一眼这几个字，收收手”。" },
"玉泉马帮刀": { name: "玉泉马帮刀", category: "weapon", quality: "绿", atkMul: 1.25, standardIssue: true, desc: "玉泉寨马帮护卫的制式长刀，刀柄缠牦牛皮绳，马背上单手挥砍不脱手。刀身有一道道细痕，都是在狼曲护商时留下的。" },
"黑风短矛": { name: "黑风短矛", category: "weapon", quality: "绿", atkMul: 1.25, standardIssue: true, desc: "黑风寨给兄弟分发的武器，矛身刻着寨规首句“不抢救命口粮”。巴桑说刻这句不是给外人看的，是给拿矛的人自己看的。" },
"鹰曲长剑": { name: "鹰曲长剑", category: "weapon", quality: "蓝", atkMul: 1.3, standardIssue: true, sixDim: { 身法: 1 }, desc: "喇嘛庙藏经阁有记载的制式长剑，剑身有鹰羽纹，百年前曲措乡铁匠参照唐剑形制所铸。图谱尚在，会打的铁匠却越来越少了。" },
"狼曲猎弩": { name: "狼曲猎弩", category: "weapon", quality: "蓝", atkMul: 1.3, standardIssue: true, effect: { lowEnemyEnergyBonus: { threshold: 2, multiplier: 2 } }, desc: "老猎户同款的精制猎弩，熊山猎户口耳相传的“三发不卡”好弩。上弦费力，但认准了猎物再射，十有八九不落空。" },
"锦官精铁剑": { name: "锦官精铁剑", category: "weapon", quality: "蓝", atkMul: 1.35, standardIssue: true, desc: "锦官城铸剑坊的镇坊之作——不是一把，是“这一批”，每把剑脊都有坊号戳记。买的时候要认戳记，没戳记的多半是仿的。" },
"天都护商长刀": { name: "天都护商长刀", category: "weapon", quality: "蓝", atkMul: 1.35, standardIssue: true, effect: { onCounterSuccessDamageRatio: 0.3 }, desc: "天都镇护商队制式，刀柄包铜、刀身加宽。护商队凭这刀在狼曲杀退过三次劫匪，第三次之后，劫匪就绕着挂这刀的商队走了。" },
"贡措冰铁矛": { name: "贡措冰铁矛", category: "weapon", quality: "蓝", atkMul: 1.35, standardIssue: true, effect: { freezeEnergyRecovery: true }, desc: "贡措海畔偶然掘出的冰铁打造，矛尖泛着湖水的冷蓝色，来历不明但锋利异常。握久了掌心发凉，挑中人时，那点寒意会顺着伤口钻进去。" }
};

export default { item: items, itemGroup: { SUPPLEMENT_WEAPONS: Object.keys(items) } };
