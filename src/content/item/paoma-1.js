// 跑马大会集市货（总纲 v3 4.1 外围集市：锦官商号/土特产/小礼物/食品/药品）。
const items = {
"鎏银发簪": { name: "鎏银发簪", category: "accessory", quality: "绿", tags: ["礼物", "首饰"], desc: "小礼物摊上最拿得出手的一件：鎏银簪头錾着卷草纹，不是足银但擦得极亮，摊主说「送姑娘，这个最稳妥」。" },
"绣纹荷包": { name: "绣纹荷包", category: "accessory", quality: "绿", tags: ["礼物", "杂物"], desc: "本地妇人绣的荷包，针脚密实，里面塞一撮干薰衣草。跑马大会一天能卖出两百个——送人的比自用的多。" },
"安神香囊": { name: "安神香囊", category: "accessory", quality: "蓝", tags: ["礼物", "香料"], consumable: { energyRestore: 2 }, desc: "锦官商号摊上挂了字号牌的香囊，安息香掺冰片，针脚是蜀绣的「打籽绣」。挂床头助眠，送人显心意。" },
"锦官琉璃珠": { name: "锦官琉璃珠", category: "accessory", quality: "蓝", tags: ["礼物", "舶来"], desc: "锦官城商号压箱的琉璃珠串，珠子在阳光下透出孔雀蓝的底。掌柜的说这是「外洋来的玩意儿」，价钱也确实像外洋来的。" },
"牦牛皮护腕": { name: "牦牛皮护腕", category: "armor", quality: "白", tags: ["土特产"], desc: "本地皮匠收摊前赶出来的护腕，牦牛皮双层缝合，针脚粗但皮料厚。跑马的、赶路的都爱戴一副。" },
"风干牦牛肉": { name: "风干牦牛肉", category: "misc", quality: "白", tags: ["食品", "土特产"], consumable: { hpRestore: 0.08 }, desc: "高原风干的牦牛肉条，咸韧耐嚼，一条能啃半日，走山路的人都揣两条。" },
};
export default { item: items };
