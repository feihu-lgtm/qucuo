export const HOMESTEAD_FEATURES = {
  溪边小屋: {
    label: "溪边小屋",
    district: "鱼定村",
    flavor: "溪水里泡着半截破草鞋，篱笆上挂着个歪歪扭扭的木牌：「乞丐与老7滚勿入」。门口菜畦里被人偷拔过两次葱。",
    features: [
      { id: "cooking", icon: "🍳", name: "烹饪台", desc: "灶台上铁锅铜壶齐整，灶膛余烬未冷。可以烹饪食材获得增益。" },
      // 鸽子笼已独立成建筑 pigeon_coop_xibian（挂在溪边小屋院子，走左栏建筑入口），
      // 不再是面板设施。留在这里会成为一条任何房间都够不到的孤儿条目。
      // 库房木箱 likewise 已独立成建筑 chest_xibian（左栏入口），从面板移除。
      { id: "wine", icon: "🍶", name: "酒窖", desc: "灶台后头一个半地下的石窖，阴凉潮湿，坛子沿上长着青苔。可以酿酒。" },
      { id: "garden", icon: "🌱", name: "菜畦", desc: "门前巴掌大的菜畦，篱笆边野蔷薇爬了一墙。可以种植。" },
    ],
  },
  山间别墅: {
    label: "山间别墅",
    district: "天都镇",
    flavor: "壁炉架上落了一层细灰，沙发垫子拍一拍能扬起半尺高的尘。那只铁柜子还是冰的，始终没人搞得懂它。",
    features: [
      { id: "cooking", icon: "🍳", name: "大厨房", desc: "灶台比寻常人家大三倍，调料架、烤炉俱全。可以烹饪高级料理。" },
      { id: "fireplace", icon: "🔥", name: "壁炉", desc: "一楼客厅的壁炉，生起火来整个屋子都暖。可以烤火恢复精力。" },
      { id: "telescope", icon: "🔭", name: "望远镜", desc: "二楼窗台架着一只铜制望远镜，正对山谷。可以远眺侦察。" },
      { id: "garden", icon: "🌲", name: "松院", desc: "院角一小块空地，老松树下石桌石凳。可以种植与打坐。" },
    ],
  },
  弟子别院: {
    label: "弟子别院",
    district: "雪山派",
    flavor: "木桩上全是刀劈剑削的痕迹，老梅今年又开了。琴弦还是断的，没人修。",
    features: [
      { id: "training", icon: "⚔", name: "练功场", desc: "院中木桩石锁俱全，可以练功提升武学熟练。" },
      { id: "study", icon: "📚", name: "书房", desc: "西厢书案笔墨齐备，架上几本心法杂书。可以读书悟道。" },
      { id: "guqin", icon: "🎵", name: "琴桌", desc: "窗下一张琴桌，弦断了三根。可以抚琴养性。" },
      { id: "garden", icon: "❄", name: "花坛", desc: "老梅树下一圈花坛，种着格桑花和雪莲幼苗。可以种植。" },
    ],
  },
  蜀王庄: {
    label: "蜀王庄",
    district: "锦官城",
    flavor: "朱漆大门推开时掉了一片漆。照壁后芭蕉叶上积着去年的枯叶，石狮子被摸得溜光水滑。",
    features: [
      { id: "cooking", icon: "🍳", name: "大厨房", desc: "倒座房的大厨房，灶台蒸笼案板俱全，够摆一桌酒席。可以烹饪宴席。" },
      { id: "meditation", icon: "🧘", name: "佛堂", desc: "正中一间小佛堂，白瓷观音，香炉冷灰。可以打坐恢复气血。" },
      { id: "library", icon: "📚", name: "书房", desc: "大书案文房四宝俱全，架上诗词地方志，另有一把保存极好的古琴。可以读书抚琴。" },
      { id: "garden", icon: "🍂", name: "银杏院", desc: "后院一丛翠竹一棵大银杏，秋日满地金黄。可以种植与休憩。" },
    ],
  },
};

export const RECIPES = [
  { id: "糌粑饼", ingredients: ["糌粑"], result: "糌粑饼", buff: "气血+15", duration: 3, difficulty: 1 },
  { id: "牦牛骨汤", ingredients: ["牦牛肉", "野葱"], result: "牦牛骨汤", buff: "气血+30, 内力+10", duration: 5, difficulty: 2 },
  { id: "烤全鱼", ingredients: ["溪鱼", "干辣椒"], result: "烤全鱼", buff: "攻击+5", duration: 4, difficulty: 2 },
  { id: "酥油茶", ingredients: ["酥油", "茶叶"], result: "酥油茶", buff: "内力+20", duration: 3, difficulty: 1 },
  { id: "松茸炖鸡", ingredients: ["松茸", "土鸡"], result: "松茸炖鸡", buff: "气血+50, 精力恢复", duration: 6, difficulty: 3 },
  { id: "青稞酒酿", ingredients: ["青稞", "酒曲"], result: "青稞酒", buff: "攻击+8, 防御-3", duration: 4, difficulty: 2 },
];

export const WINE_RECIPES = [
  { id: "青稞酒", ingredients: ["青稞", "酒曲"], ageTime: 3, result: "陈年青稞酒", buff: "气血+20, 内力+20", note: "窖藏三日，酒色微黄，入口绵柔。" },
  { id: "梅子酒", ingredients: ["青梅", "冰糖", "白酒"], ageTime: 5, result: "雪山梅酒", buff: "精力全恢复", note: "五日开封，酸甜冽冽，雪山派的冬天就靠这一口。" },
  { id: "桂花酿", ingredients: ["桂花", "糯米", "酒曲"], ageTime: 4, result: "桂花酿", buff: "好感度+5（赠礼用）", note: "四日酿成，甜香扑鼻，锦官城的人好这一口。" },
];

export const PLANT_SLOTS = [
  { id: "野葱", growTime: 2, yield: "野葱", note: "溪边最常见，两天一茬。" },
  { id: "干辣椒", growTime: 3, yield: "干辣椒", note: "窗台上晒着的那种，三天熟。" },
  { id: "雪莲", growTime: 8, yield: "雪莲", note: "极难伺候，八日一花，但值。" },
  { id: "青稞", growTime: 4, yield: "青稞", note: "酿酒的主料，四日一熟。" },
  { id: "桂花", growTime: 5, yield: "桂花", note: "秋天才开，但窖里恒温，五日可得。" },
];

// ── 设施按房间分布 ────────────────────────────────────────────────────────
// 【为什么加这一层】四栋家园原本各是**一间**大房间，五种设施全塞在顶栏🏠那个
// 总面板里当按钮点——房间描述里写着「灶台后头一个半地下的石窖」，玩家却只能
// 在面板上点一个「🍶 酒窖」图标，走不进去。现在四栋都拆成了真房间（起居室/
// 灶房/菜园子/书房/主卧…），设施就该跟着房间走：你站在灶房才能开火与下窖，
// 站在菜园子才能种地，而不是在院子里隔空点按钮。
// 键是**内层房间名**，值是该房间能用的设施 id（对应上面 features 里的 id）。
// 房间名全项目唯一，所以这张表可以直接按房间名查。
const FEATURES_BY_ROOM = {
  // 溪边小屋（鱼定村）：院子本身没有面板设施——鸽笼已独立成建筑走左栏建筑入口。
  // 显式登记成空，免得落到下面 direct 的兜底分支、把整栋五样又全列出来。
  溪边小屋: { house: "溪边小屋", ids: [] },
  起居室: { house: "溪边小屋", ids: [] },   // 木箱已独立成建筑 chest_xibian
  灶房: { house: "溪边小屋", ids: ["cooking", "wine"] },
  菜园子: { house: "溪边小屋", ids: ["garden"] },
  // 弟子别院（雪山派）：院里练功、东厢存物、西厢读书抚琴
  弟子别院: { house: "弟子别院", ids: ["training", "garden"] },
  东厢卧房: { house: "弟子别院", ids: [] },   // 木箱已独立成建筑 chest_bieyuan
  西厢书房: { house: "弟子别院", ids: ["study", "guqin"] },
  // 山间别墅（天都镇）：院里松院、一楼壁炉与厨房、二楼衣柜与望远镜
  山间别墅: { house: "山间别墅", ids: ["garden"] },
  一楼客厅: { house: "山间别墅", ids: ["fireplace", "cooking"] },
  二楼主卧: { house: "山间别墅", ids: ["telescope"] },   // 衣柜已独立成建筑 chest_shanbie
  // 蜀王庄（锦官城）：倒座房厨房在一进、佛堂在正堂、书房存物读书、后院种植
  蜀王庄: { house: "蜀王庄", ids: ["cooking"] },
  正堂佛堂: { house: "蜀王庄", ids: ["meditation"] },
  后院书房: { house: "蜀王庄", ids: ["library"] },   // 紫檀匣已独立成建筑 chest_shuwang
  银杏后院: { house: "蜀王庄", ids: ["garden"] },
};

// 传任意一间家园房间名，返回「这间屋子能干什么」。
// 返回体沿用原来的形状（label/district/flavor/features），只是 features 收窄成
// 本房间的那几样，所以 HomesteadPanel 与顶栏🏠的判断都不用改。
// house 字段是新加的：告诉调用方这间属于哪栋（存物/酿酒/种植的存档键仍按栋走，
// 不按房间走——一栋人家只有一只箱子，不该因为换了间屋就看见不同的东西）。
export function getHomestead(roomName) {
  const direct = HOMESTEAD_FEATURES[roomName];
  const mapped = FEATURES_BY_ROOM[roomName];
  if (!mapped) {
    // 不在分布表里：要么不是家园房间，要么是老存档里那间没拆的大屋，原样返回
    return direct || null;
  }
  const house = HOMESTEAD_FEATURES[mapped.house];
  if (!house) return null;
  const features = house.features.filter(f => mapped.ids.includes(f.id));
  if (!features.length) return null;
  return { ...house, house: mapped.house, features };
}

// ── 库房默认家底（开局预填全套食材+调味料）────────────────────────────
// 四栋小屋的库房（木箱）首次打开时各送一套，让玩家落地就能开火。
// count：白/绿常见件×3，蓝稀罕件×2。tags 供烹饪台 isCookingMaterial 识别。
export const STARTER_COOKING_STOCK = [
  // 调味料 10
  { name: "熊山花椒", quality: "绿", tag: "调味品", count: 3 },
  { name: "贡措海盐", quality: "蓝", tag: "调味品", count: 2 },
  { name: "锦官豆瓣酱", quality: "白", tag: "调味品", count: 3 },
  { name: "雅江菜籽油", quality: "白", tag: "调味品", count: 3 },
  { name: "雪山野蜂蜜", quality: "绿", tag: "调味品", count: 3 },
  { name: "大草甸孜然", quality: "白", tag: "调味品", count: 3 },
  { name: "黑风寨苞谷醋", quality: "白", tag: "调味品", count: 3 },
  { name: "喇嘛庙藏红花", quality: "蓝", tag: "调味品", count: 2 },
  { name: "天都镇酱油", quality: "白", tag: "调味品", count: 3 },
  { name: "鱼定村野葱油", quality: "白", tag: "调味品", count: 3 },
  // 食材 20
  { name: "熊山松茸", quality: "白", tag: "食材", count: 3 },
  { name: "青城山蕨菜", quality: "白", tag: "食材", count: 3 },
  { name: "熊山铁棍山药", quality: "白", tag: "食材", count: 3 },
  { name: "雪山雪莲瓣", quality: "蓝", tag: "食材", count: 2 },
  { name: "贡措海苔花", quality: "白", tag: "食材", count: 3 },
  { name: "大草甸野韭", quality: "白", tag: "食材", count: 3 },
  { name: "狼曲冷水鱼", quality: "白", tag: "食材", count: 3 },
  { name: "青衣江团鱼", quality: "绿", tag: "食材", count: 3 },
  { name: "贡措海裂腹鱼", quality: "绿", tag: "食材", count: 3 },
  { name: "熊曲石斑", quality: "白", tag: "食材", count: 3 },
  { name: "牦牛腱子肉", quality: "白", tag: "食材", count: 3 },
  { name: "藏香猪五花", quality: "绿", tag: "食材", count: 3 },
  { name: "大草甸黄羊腿", quality: "绿", tag: "食材", count: 3 },
  { name: "雪山雪鸡肉", quality: "绿", tag: "食材", count: 3 },
  { name: "熊猫笋", quality: "白", tag: "食材", count: 3 },
  { name: "鱼定村青稞", quality: "白", tag: "食材", count: 3 },
  { name: "玉泉寨土豆", quality: "白", tag: "食材", count: 3 },
  { name: "雅江嫩豆腐", quality: "白", tag: "食材", count: 3 },
  { name: "大草甸蘑菇", quality: "白", tag: "食材", count: 3 },
  { name: "锦官城干笋", quality: "白", tag: "食材", count: 3 },
];

// 展开成一件件带唯一 id 的物品对象（库房/背包都按 id 区分同名多件）
export function defaultChestStock() {
  const out = [];
  for (const s of STARTER_COOKING_STOCK) {
    for (let i = 0; i < s.count; i++) {
      out.push({
        id: `stock_${s.name}_${i}`,
        name: s.name, category: "misc", quality: s.quality,
        tags: [s.tag], equipped: false,
      });
    }
  }
  return out;
}

// 存档键一律按「栋」而不是按「房间」：一栋人家只有一只箱子、一个酒窖、一畦地，
// 站在起居室和站在灶房看见的该是同一批东西。下面几个 load/save 都先归一到栋名。
export function homesteadHouseOf(roomName) {
  return FEATURES_BY_ROOM[roomName]?.house || (HOMESTEAD_FEATURES[roomName] ? roomName : null);
}

export function loadChest(roomName) {
  roomName = homesteadHouseOf(roomName) || roomName;
  try {
    const raw = localStorage.getItem(`qucuo_chest_${roomName}`);
    // 键不存在（null）= 这只库房从没被开过 → 预填一套家底。
    // 注意区分 null（从没存过）与 "[]"（玩家主动清空过）：清空过的不再补货。
    if (raw === null) return defaultChestStock();
    return JSON.parse(raw || "[]");
  } catch { return []; }
}

export function saveChest(roomName, items) {
  roomName = homesteadHouseOf(roomName) || roomName;
  localStorage.setItem(`qucuo_chest_${roomName}`, JSON.stringify(items));
}

export function loadWineCellar(roomName) {
  roomName = homesteadHouseOf(roomName) || roomName;
  try {
    return JSON.parse(localStorage.getItem(`qucuo_wine_${roomName}`) || "[]");
  } catch { return []; }
}

export function saveWineCellar(roomName, items) {
  roomName = homesteadHouseOf(roomName) || roomName;
  localStorage.setItem(`qucuo_wine_${roomName}`, JSON.stringify(items));
}

export function loadGarden(roomName) {
  roomName = homesteadHouseOf(roomName) || roomName;
  try {
    return JSON.parse(localStorage.getItem(`qucuo_garden_${roomName}`) || "[]");
  } catch { return []; }
}

export function saveGarden(roomName, items) {
  roomName = homesteadHouseOf(roomName) || roomName;
  localStorage.setItem(`qucuo_garden_${roomName}`, JSON.stringify(items));
}
