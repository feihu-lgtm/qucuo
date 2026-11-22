// 青城派青4、青5 与三条支线的任务物和奖励（合稿·青城派 四）
const items = {
"三清松风令": { name: "三清松风令", category: "accessory", quality: "紫", sixDim: { 悟性: 1, 根骨: 1 }, tags: ["饰品", "信物", "青城"], desc: "一清道长亲手交给你的松木令牌，正面刻三清，背面刻一株迎风老松。持令者可代青城联络正道各派。" },
"紫阳松纹剑": { name: "紫阳松纹剑", category: "weapon", quality: "橙", atkMul: 1.5, sixDim: { 根骨: 1, 身法: 1 }, tags: ["武器", "剑", "青城"], effect: { ignoreDefenseRatio: 0.2 }, desc: "青霞子年轻时的佩剑，剑身松纹隐隐泛紫。三十年没出过鞘，这一回他亲手递给你。" },
"七星桩磨剑石": { name: "七星桩磨剑石", category: "misc", quality: "蓝", tags: ["素材", "磨剑", "青城"], desc: "剑坪七星桩底下垫的青石，被剑锋磨了几十年，石面光得能照人。拿来打磨剑刃，刃口格外顺。" },
"糖油果子": { name: "糖油果子", category: "misc", quality: "白", tags: ["食品", "雅江特产"], consumable: { hpRestore: 0.06, energyRestore: 1 }, desc: "糯米团子下锅炸得金黄，裹一层红糖浆，撒白芝麻。青玄练完剑总要啃一串。" },
"山阴七叶莲": { name: "山阴七叶莲", category: "misc", quality: "绿", tags: ["药材", "解毒", "青城"], desc: "后山陡崖背阴处才长的七叶一枝花，七片叶子托着一朵细花。玉真子拿它压瘴毒。" },
"离堆冷水苔": { name: "离堆冷水苔", category: "misc", quality: "绿", tags: ["药材", "青城"], desc: "伏龙观江畔石缝里刮下来的青苔，常年泡在冰凉的江水里，敷在伤口上能退热。" },
"百草防瘴香囊": { name: "百草防瘴香囊", category: "accessory", quality: "绿", sixDim: { 根骨: 1, 体魄: 1 }, tags: ["饰品", "防瘴", "青城"], desc: "玉真子缝的粗布香囊，塞满苍术、艾叶和七叶莲碎末。挂在身上，紫雾近不了身。" },
"九转青灵散": { name: "九转青灵散", category: "misc", quality: "蓝", tags: ["药", "解毒", "青城"], consumable: { dispelAll: true, hpRestore: 0.1 }, desc: "玉真子照九蒸九晒的古方配的解毒散，专克苗疆秘传的残瘴余毒。" },
"离堆青铜水则尺": { name: "离堆青铜水则尺", category: "misc", quality: "蓝", tags: ["古器", "任务", "青城"], desc: "一柄青铜量水尺，尺身刻满水纹刻度，尺尾錾着「离堆」二字。老道士入道前靠它量了半辈子江水。" },
};
export default { item: items, itemGroup: { QINGCHENG_QUEST: Object.keys(items) } };
