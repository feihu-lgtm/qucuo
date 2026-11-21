const items = {
"乡勇木棓": { name: "乡勇木棓", category: "weapon", quality: "白", atkMul: 1.0, standardIssue: true, desc: "曲措乡各村团练发下来的枣木短棒，一头烤硬熏黑。谁家都有一根，白天赶牦牛，夜里守寨门——打不死人，但能把偷粮的手打肿三天。" },
"市集杀猪刀": { name: "市集杀猪刀", category: "weapon", quality: "白", atkMul: 1.05, standardIssue: true, desc: "天都镇铁铺按斤称着卖的宽背厚刀，本是杀年猪用的。江湖人图它便宜结实，磨一磨也能开脸——就是拔出来时总带着一股洗不掉的油腥。" },
"巡捕营制式腰刀": { name: "巡捕营制式腰刀", category: "weapon", quality: "绿", atkMul: 1.2, standardIssue: true, desc: "土司府巡捕营统一配发，刀鞘烙着编号，握把缠红漆布。制式归制式，二十把里总有三五把是以次充好的私铸货——认得出的老兵会挑刀柄不晃的那把。" },
"马帮护商弩": { name: "马帮护商弩", category: "weapon", quality: "绿", atkMul: 1.15, standardIssue: true, desc: "鹰曲马帮走商路防狼防匪的手弩，机括简陋但上弦快。弩身刻着马帮记号，转手过好几道，记号叠着记号，像一截被反复烙印的木头。" },
"锦官坊标兵剑": { name: "锦官坊标兵剑", category: "weapon", quality: "蓝", atkMul: 1.3, standardIssue: true, desc: "锦官城铸剑坊接官府订单成批打的制式剑，剑格统一雕缠枝纹，锋口验过才出坊。一整个武馆能配齐一色的这剑——齐是齐了，就是少了点各自的脾气。" },
"黑风寨分发刀": { name: "黑风寨分发刀", category: "weapon", quality: "蓝", atkMul: 1.25, standardIssue: true, desc: "巴桑给新入伙兄弟统一发的厚背刀，刀身没花样，刀柄一律缠三圈麻绳。寨规：刀可以钝，麻绳不能松——松了说明你偷懒没保养，先罚站三天寨门。" },
"雪山派传习剑": { name: "雪山派传习剑", category: "weapon", quality: "紫", atkMul: 1.4, standardIssue: true, effect: { onCounterSuccessDamageRatio: 0.25 }, desc: "雪山派内门弟子出师时统一授予的传习剑，剑脊一道浅浅的松纹（比松纹剑那道淡），是门派量产而非亲铸。剑随人走，人亡剑归——练功堂剑架上空着的位置，比挂着的更让人不敢多看。" },
"欢喜堂供役杖": { name: "欢喜堂供役杖", category: "weapon", quality: "紫", atkMul: 1.35, standardIssue: true, effect: { enemyCostPenalty: { value: 1, turns: 2 } }, desc: "欢喜堂外院供役统一持的铜头长杖，杖身缠暗红布条，走起来布条扫地无声。梵衍那说这不是兵器是法器——可挨过一杖的人都知道，法器也硌骨头，且沾了那股香，手脚发沉。" },
"土司府仪卫戟": { name: "土司府仪卫戟", category: "weapon", quality: "橙", atkMul: 1.5, standardIssue: true, effect: { forceFirst: true }, desc: "跑马大会开场，土司府三十骑手方阵统一擎的仪卫长戟，戟缨染成一色的赭红。中看，也中用——格桑顿珠治军严，这批戟的锋刃是真开过的，方阵一动，气势先压人半头。" },
"官铸镇仓槊": { name: "官铸镇仓槊", category: "weapon", quality: "红", atkMul: 1.6, standardIssue: true, effect: { forceFirst: true, ignoreDefense: true }, sixDim: { 身法: 2, 体魄: 1 }, desc: "锦官城军械库封存的重槊，本是戍边镇仓的制式重兵，一整排列在架上落灰。柳青鸢上任清点军械时发现少了两杆——账上写的是“锈蚀报废”，她盯着那行字看了很久，没说话。" }
};

export default { item: items, itemGroup: { STANDARD_WEAPONS: Object.keys(items) } };
