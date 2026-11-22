const items = {
// ── 门派商坊货（合稿 6.2 货单） ──
"雪山姜枣干粮": { name: "雪山姜枣干粮", category: "misc", quality: "白", tags: ["干粮", "雪山派"], consumable: { hpRestore: 0.06 }, desc: "灶房烘透的青稞干饼配老姜粉，吃下去胃里立刻升起一股暖气，跑雪路最顶饿。" },
"寒岭冻伤膏": { name: "寒岭冻伤膏", category: "misc", quality: "绿", tags: ["药膏", "疗伤", "雪山派"], consumable: { hpRestore: 0.12 }, desc: "用后山硫磺泉泥与羊脂调成的油膏，抹在冻裂或刀伤处先刺痛后温热，回血颇稳。" },
"雪松木剑": { name: "雪松木剑", category: "weapon", quality: "白", tags: ["武器", "剑", "雪山派"], desc: "练功堂削制的雪松重木剑，未开锋却沉手，初学者拿来站桩听风最合用。" },
"雪山素棉袍": { name: "雪山素棉袍", category: "armor", quality: "绿", tags: ["衣甲", "雪山派"], desc: "门中弟子常穿的厚棉白袍，双层防风领口，挡不住暗箭，却最耐寒岭阴风。" },
"寒铁细剑": { name: "寒铁细剑", category: "weapon", quality: "蓝", tags: ["武器", "剑", "雪山派"], effect: { applyStatus: { name: "冰蚕丝缚", chance: 0.2 } }, desc: "齐照野用山洞寒铁打制的佩剑，剑身瘦窄微泛青霜，借雪山剑势刺出轻若无物。" },
"雪莲清心丸": { name: "雪莲清心丸", category: "misc", quality: "蓝", tags: ["丹药", "解毒", "雪山派"], consumable: { dispel: true }, desc: "采雪线野雪莲入药炼成的清苦药丸，服后立解常见瘴毒与心神紊乱，回复内力。" },
"雪狐绒护肩": { name: "雪狐绒护肩", category: "armor", quality: "紫", tags: ["衣甲", "雪山派"], desc: "精选高山白狐颈毛缝制的轻甲护肩，既不碍身法腾挪，又能大幅抵御寒气与割伤。" },
"听雪素玉佩": { name: "听雪素玉佩", category: "accessory", quality: "紫", sixDim: { 悟性: 2, 根骨: 1 }, tags: ["饰品", "雪山派"], desc: "产自寒岩深处的冷白玉佩，贴身佩戴令气息绵长，使反击类招式更易捕捉破绽。" },
"千年冰魄莲": { name: "千年冰魄莲", category: "misc", quality: "紫", tags: ["药材", "解毒", "雪山派", "秘货"], consumable: { dispelAll: true }, desc: "生于雪山崖壁极寒背阴处的灵草，内蕴至纯寒息，可作高阶解毒主药或永久微增内力上限。" },
"霜纹寒玉剑": { name: "霜纹寒玉剑", category: "weapon", quality: "橙", tags: ["武器", "剑", "雪山派", "秘货"], effect: { applyStatus: { name: "冰蚕丝缚", chance: 0.35 }, ignoreDefenseRatio: 0.15 }, desc: "以玄铁参合后山寒玉碎屑反复锻打而成的名剑，拔鞘时周围落雪皆滞半拍，唯有雪山尊宿方有资格请出。" },
// ── 陆寒枝随身 ──
"钝锋寒铁剑": { name: "钝锋寒铁剑", category: "weapon", quality: "蓝", tags: ["武器", "剑", "雪山派"], desc: "剑脊厚重、刻意不开了全锋，专为练功堂喂招与克己守戒之用。陆寒枝说它钝，可挨过一下的人都知道什么叫钝重。" },
"雪山霜铁护心衣": { name: "雪山霜铁护心衣", category: "armor", quality: "蓝", tags: ["衣甲", "雪山派"], desc: "粗麻外衫下缝着薄寒铁甲片，耐刀劈斧凿。穿上半个时辰人就冻得清醒——陆寒枝说这叫以寒养剑心。" },
"青铜戒尺牌": { name: "青铜戒尺牌", category: "accessory", quality: "绿", sixDim: { 体魄: 1 }, tags: ["信物", "雪山派"], desc: "历代雪山执事信物，青铜牌背面刻着「止争」二字。陆寒枝拿它敲过无数偷懒弟子的膝盖。" },
// ── 沈既白随身 ──
"折雪短剑": { name: "折雪短剑", category: "weapon", quality: "绿", tags: ["武器", "剑", "雪山派"], desc: "轻便易藏的短剑，山路遇狼遇匪时拔鞘极快。沈既白说剑不在利，在让歹人先看见你有剑。" },
"藏青牦牛皮袄": { name: "藏青牦牛皮袄", category: "armor", quality: "绿", tags: ["衣甲", "雪山派"], desc: "防风耐刮的牦牛皮袄，内袋缝着暗层专藏账本与药包。翻出来看，针脚全是沈既白自己歪歪扭扭的手艺。" },
"黄铜雪纹算盘坠": { name: "黄铜雪纹算盘坠", category: "accessory", quality: "绿", sixDim: { 智谋: 1 }, tags: ["饰品", "雪山派"], desc: "沈既白贴身的算账家伙，黄铜小算盘串着雪纹皮绳，关键时也能点穴磕飞暗器。" },
// ── 齐照野随身 ──
"独臂乌铁拐剑": { name: "独臂乌铁拐剑", category: "weapon", quality: "紫", tags: ["武器", "剑", "雪山派"], desc: "平日作扫雪撑身的乌铁拐杖，机括一拧便是三尺寒锋。齐照野拄着它扫了三十年雪，也等了三十年。" },
"补丁羊皮老衲袄": { name: "补丁羊皮老衲袄", category: "armor", quality: "绿", tags: ["衣甲", "雪山派"], desc: "沾满炭灰与霜气的老羊皮袄，补丁摞补丁，内衬却缝着一层早年护身软藤。" },
"玄铁旧剑阁钥": { name: "玄铁旧剑阁钥", category: "accessory", quality: "蓝", sixDim: { 悟性: 1 }, tags: ["信物", "雪山派", "任务"], desc: "沉甸甸的玄铁古钥匙，开启寒玉旧剑阁的信物。齐照野贴身揣了三十年，磨得边角发亮。" },
// ── 任务/采买 ──
"雪山炒面干粮": { name: "雪山炒面干粮", category: "misc", quality: "白", tags: ["干粮", "雪山派"], consumable: { hpRestore: 0.05 }, desc: "青稞炒熟磨面拌了酥油，一撮一撮抓着吃，揣在怀里半个月不坏。雪山上出远门的标配。" },
"寒铁护腕": { name: "寒铁护腕", category: "accessory", quality: "绿", sixDim: { 体魄: 1 }, tags: ["饰品", "雪山派"], desc: "寒铁片铆在皮衬上的小护腕，挡剑挡不了几下，胜在便宜结实。沈既白库房里常备的走货。" },
"寒泉雪莲": { name: "寒泉雪莲", category: "misc", quality: "绿", tags: ["药材", "雪山派", "任务"], consumable: { hpRestore: 0.1 }, desc: "山洞深处寒泉边上生的雪莲，花瓣冰得像玉。沈既白说霜灾年里，一株能换半袋糙米。" },
"雪山灵芝膏": { name: "雪山灵芝膏", category: "misc", quality: "蓝", tags: ["药膏", "疗伤", "雪山派"], consumable: { hpRestore: 0.2 }, desc: "雪线灵芝配山蜜熬成的厚膏，温补驱寒，是雪山派调理内伤的常备药。" },
// ── 雪3/雪4/雪5/雪支2/雪支3 任务物与奖励 ──
"峨眉青玉佩": { name: "峨眉青玉佩", category: "accessory", quality: "紫", sixDim: { 悟性: 2 }, tags: ["信物", "任务", "雪山派", "峨眉派"], desc: "三十年前玄尘师太赠予何雨谢的旧信物，青玉边缘有一道极细的剑痕。齐照野说，持此佩上峨眉剑庐，守门弟子不敢拦。" },
"青城论剑旧证": { name: "青城论剑旧证", category: "misc", quality: "蓝", tags: ["任务", "信物", "雪山派", "青城派"], desc: "青霞子亲笔手书：当年老土司桑杰大侠曾密函青城，直言「曲措地契生变，恐有家贼勾结外人」。纸已泛黄，字迹仍峻。" },
"清心冰露": { name: "清心冰露", category: "misc", quality: "紫", tags: ["丹药", "峨眉派", "任务"], consumable: { hpRestore: 0.35, dispel: true }, desc: "玄尘师太赠下的峨眉秘药，冰露入喉先寒后暖，寒毒沉疴皆缓三分。何雨谢服了半盏，三十年头一回睡了个整觉。" },
"血刻地契残角": { name: "血刻地契残角", category: "misc", quality: "紫", tags: ["任务", "证物", "雪山派"], desc: "呼延大侠遗骸旁寻获的地契残角，边角以血刻下两行小字——当年绝顶之上，两位大侠是遭奸人挑拨误斗，而非蓄意残杀。" },
"血刀过境腰牌": { name: "血刀过境腰牌", category: "misc", quality: "蓝", tags: ["任务", "证物", "天龙教"], desc: "从血刀部探子身上搜出的过境腰牌，背面烙着鱼定土司府的私印——草甸的刀客，拿着土司府的路引。" },
"雪猿灵桃": { name: "雪猿灵桃", category: "misc", quality: "蓝", tags: ["灵果", "雪山派"], consumable: { hpRestore: 0.15, energyRestore: 4 }, desc: "老白猿守着的雪线野桃，离枝三日仍带寒香。咬一口先是冰牙，咽下去气血内力一起回暖。" },
"冰蚕护腕": { name: "冰蚕护腕", category: "accessory", quality: "蓝", sixDim: { 体魄: 1, 根骨: 1 }, tags: ["饰品", "雪山派"], desc: "玄女拆了自己一缕冰蚕素绫给你缠的护腕，凉而不冰，刀剑擦过去先滑开半分。" },
"玄冰陨铁": { name: "玄冰陨铁", category: "misc", quality: "紫", tags: ["任务", "材料", "雪山派"], desc: "齐照野珍藏三十年的陨铁，入怀不暖，对着光看里面像封着一小段冻住的星河。" },
"冰心炭": { name: "冰心炭", category: "misc", quality: "绿", tags: ["任务", "材料", "雪山派"], desc: "山洞极寒石髓处采的奇炭，摸上去烫手，丢进雪里却不融。锻剑铺的老话说，寒冰淬火，非此炭不可。" },
"呼延旧玉扳指": { name: "呼延旧玉扳指", category: "accessory", quality: "紫", sixDim: { 体魄: 2, 悟性: 1 }, tags: ["饰品", "信物", "雪山派"], desc: "呼延大侠生前挽弓佩剑的旧扳指，玉色被摩挲得温润。何雨谢把它交给你时说：「他的东西，该跟着活人下山。」" },
"雪岭剑主令": { name: "雪岭剑主令", category: "accessory", quality: "紫", sixDim: { 根骨: 2, 气运: 1 }, tags: ["信物", "雪山派"], desc: "霜天月奉留雪山镇山那日，何雨谢亲授的客卿令。持令如携雪山半剑，山下人见了要掂量掂量。" },
};
export default { item: items, itemGroup: { XUESHAN_GOODS: Object.keys(items) } };
