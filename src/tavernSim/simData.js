// 酒馆经营沙盒 · 静态数据表
// 跟斗蛐蛐一个性质：脱离主线剧情与主存档的独立小游戏。
// 这里只放手写常量——菜单、伙计候选词、事件池、堂吃语料、夜报模板。
// 数值初值都标了注释，调平衡先改这里，引擎（simEngine.js）不藏魔法数。

// ── 时间 ─────────────────────────────────────────────────────────────
// 1 天 = 8 个时段。0~6 营业（客人会来），7 = 打烊日结（不再来客）。
export const TICKS_PER_DAY = 8;
export const TICK_LABELS = ["开门", "早市", "午市", "午后", "晚市", "夜市", "上夜", "打烊"];
export const LAST_OPEN_TICK = 6; // 最后一个营业时段

// ── 菜单 ─────────────────────────────────────────────────────────────
// stock 对应 pantry 的三类库存：wine 酒水 / food 食材 / snack 干粮。
// basePrice 是挂牌价，玩家可在 0.5x~2x 之间调价；价越高客人越可能嫌贵走人。
// minRep 是声望解锁线——好菜要店有名气才做得出招牌。
export const MENU = [
  { id: "wine_cup", name: "青稞酒", stock: "wine", basePrice: 6, minRep: 0, desc: "本店常驻，藏家酿法。" },
  { id: "zanba", name: "糌粑饼", stock: "food", basePrice: 4, minRep: 0, desc: "扎实管饱，行路人最爱。" },
  { id: "jerky", name: "风干肉", stock: "snack", basePrice: 8, minRep: 0, desc: "越嚼越香，下酒一绝。" },
  { id: "bone_soup", name: "牦牛骨汤", stock: "food", basePrice: 10, minRep: 0, desc: "慢火一天，汤白如乳。" },
  { id: "drunken", name: "醉仙酿", stock: "wine", basePrice: 20, minRep: 30, desc: "烈酒，三碗放倒一条好汉。" },
  { id: "chicken", name: "松茸炖鸡", stock: "food", basePrice: 26, minRep: 50, desc: "秋日珍馐，药香入汤。" },
  { id: "feast", name: "三江全席", stock: "food", basePrice: 60, minRep: 80, desc: "整桌开席，镇店之宝。" },
];

// 调价范围（倍率）
export const PRICE_MULT_MIN = 0.5;
export const PRICE_MULT_MAX = 2.0;

// ── 进货 ─────────────────────────────────────────────────────────────
// 库存按"份"买，卖出一份菜扣一份对应库存。进价就是成本价。
export const STOCK_INFO = {
  wine: { label: "酒水", unitPrice: 3, icon: "🍶" },
  food: { label: "食材", unitPrice: 4, icon: "🥬" },
  snack: { label: "干粮", unitPrice: 3, icon: "🍖" },
};
export const STOCK_BATCH = 10; // 一批 10 份

// ── 伙计 ─────────────────────────────────────────────────────────────
// 四格岗位。skill 1~10，日薪随 skill 走。候选每日种子刷新。
export const STAFF_ROLES = {
  cook: { label: "厨子", icon: "🍳", wageBase: 4, desc: "上菜率 = 60% + 技能×4%。没厨子，客人点的热菜大半做不出。" },
  runner: { label: "跑堂", icon: "🏃", wageBase: 3, desc: "每点技能 +3% 客流（翻台麻利，门口不排长队）。" },
  accountant: { label: "账房", icon: "🧮", wageBase: 5, desc: "无账房日结损耗 10%~25%（对不上账）；有则损耗 (10-技能)%，并解锁账本明细。" },
  manager: { label: "掌柜", icon: "🎩", wageBase: 6, desc: "每点技能 +2% 客单价（会张罗、会推销）。" },
};
export const STAFF_SURNAMES = ["王", "李", "张", "刘", "陈", "杨", "赵", "周", "吴", "卓", "丹", "桑"];
export const STAFF_GIVEN = ["老汉", "嫂子", "胖子", "小脚", "快嘴", "顺风", "算盘", "铁勺", "笑面", "哑巴", "一根筋", "巧手"];

// ── 侠客护院 ──────────────────────────────────────────────────────────
// "可招募队友"在独立经营版的化用：不打架（沙盒无战斗），雇来看场子。
// 闹事事件可交给护院稳妥处理；技能每点再减闹事损失 8%；高技能还有名人效应（声望日增）。
export const GUARD_NAMES = [
  "独臂刀客", "铁掌水上漂", "雪山逃奴", "退役镖头", "醉拳老道", "哑巴剑",
  "断枪将军", "女飞贼", "草原猎手", "还俗武僧", "快刀阿九", "铁塔汉子",
];
export const GUARD_FEE_BASE = 20; // 一次性佣金基数（×技能）

// ── 座位 ─────────────────────────────────────────────────────────────
// 座位数 = 基础 + 酒馆等级加成。坐标是场景百分比（大堂区域内排布）。
export const BASE_SEATS = 4;
export const LEVEL_SEAT_BONUS = [0, 2, 4]; // level 0破落 / 1热闹 / 2闻名
export const SEAT_COORDS = [
  { x: 10, y: 42 }, { x: 26, y: 54 }, { x: 42, y: 44 }, { x: 14, y: 64 },
  { x: 34, y: 68 }, { x: 50, y: 58 }, { x: 22, y: 34 }, { x: 46, y: 30 },
];
// 升级：声望线 + 花费
export const LEVEL_UP = [
  { needRep: 40, cost: 300, label: "翻修门面", desc: "添两张桌子，挂上气死风灯。客流上限 +2。" },
  { needRep: 75, cost: 1000, label: "名扬三江", desc: "换了金字招牌，远近客商慕名而来。客流上限再 +2。" },
];

// ── 场景区域 ──────────────────────────────────────────────────────────
// 借 Star-Office-UI 的"状态→区域"思路：渲染层只按实体所在区域查坐标。
export const ZONES = {
  door: { x: 4, y: 86, label: "门口" },
  counter: { x: 78, y: 10, label: "柜台" },
  stove: { x: 8, y: 8, label: "灶台" },
  ledger: { x: 56, y: 8, label: "账台" },
  cellar: { x: 30, y: 8, label: "酒架" },
  rooms: { x: 88, y: 86, label: "客房梯口" },
};
export const GUEST_GLYPHS = ["🧔", "👴", "👩", "🧕", "👲", "🥷", "👳", "🧙", "💂", "👵"];
export const STAFF_SPOT = { cook: "stove", runner: "hall", accountant: "ledger", manager: "counter" };

// ── 随机事件池 ─────────────────────────────────────────────────────────
// 每个营业 tick 小概率触发（见引擎 EVENT_CHANCE_PER_TICK），每天最多 EVENT_MAX_PER_DAY 起。
// options 的 effect 是声明式的，由引擎结算——AI 永远不参与数值。
export const EVENTS = [
  {
    id: "drunk_brawl", title: "醉酒闹事", weight: 3,
    desc: "一个醉汉掀了桌子，指着满堂客人骂街，酒坛子滚了一地。",
    options: [
      { id: "self", label: "亲自摆平", hint: "六成把握。成了声望+2，砸了赔 20 两、声望-2" },
      { id: "guard", label: "护院出手", hint: "需要雇有护院。稳稳镇住，声望+1", needGuard: true },
      { id: "pay", label: "赔钱了事", hint: "-12 两，自认倒霉" },
    ],
  },
  {
    id: "food_critic", title: "挑剔的美食家", weight: 2,
    desc: "一位锦官城来的老饕落座，说要尝尝你这儿最拿得出手的东西。",
    options: [
      { id: "cook", label: "亲自下厨招待", hint: "需食材×3。成了声望+6，失手声望-1" },
      { id: "normal", label: "按常招待", hint: "不特殊对待，随他去" },
    ],
  },
  {
    id: "credit_regular", title: "赊账的熟客", weight: 2,
    desc: "常来的老马帮头儿搓着手笑：今儿个盘缠紧，这顿先记账上？",
    options: [
      { id: "allow", label: "赊给他", hint: "七成来日还 30 两，三成坏账亏 15 两" },
      { id: "refuse", label: "婉拒", hint: "面子薄，声望-1" },
    ],
  },
  {
    id: "storyteller", title: "说书人驻场", weight: 2,
    desc: "一位云游说书人讨碗酒喝，说愿意给店里讲一晚《雪山侠隐传》助兴。",
    options: [
      { id: "hire", label: "花 10 两请他讲", hint: "今日余下时段客流 +50%，声望+3" },
      { id: "pass", label: "敬谢不敏", hint: "省下 10 两" },
    ],
  },
  {
    id: "tax_check", title: "官府抽查", weight: 1, auto: true,
    desc: "两个公人进店翻账。账目清不清，全看你有没有请账房。",
    // 无选项，直接结算：有账房罚 0~2%，无账房罚 5%
  },
  {
    id: "wandering_hero", title: "游方侠客进店", weight: 2, auto: true,
    desc: "一位带兵的江湖人进店讨酒，看样子正在找落脚的地方。（今日招工里出现了护院候选）",
    // 无选项：标记今日必出护院候选
  },
];
export const EVENT_CHANCE_PER_TICK = 0.05;
export const EVENT_MAX_PER_DAY = 2;

// ── 堂吃语料（气泡用） ─────────────────────────────────────────────────
export const GUEST_BANTER = [
  "三碗不过岗！", "这酒有劲儿。", "老板娘，添饭！", "听说雪山派又收徒了。",
  "大草甸的狼最近凶得很。", "押镖这活儿，刀口舔血啊。", "再来一壶！", "这汤鲜掉眉毛了。",
  "锦官城的玉石料场，有人一刀开出紫的。", "赶路三天，就为这口热汤。", "爷们儿走一个！",
  "嘘……黑市的消息，花钱买的。", "今年的松茸贵得离谱。", "啥时候能攒够钱开个铺子哟。",
];

// ── 本地夜报模板（AI 降级兜底） ─────────────────────────────────────────
// AI 夜报失败/无 key/超限时用这个拼，保证沙盒零依赖也能完整运转。
export function fallbackNightReport({ day, guests, revenue, wages, net, repDelta, level }) {
  const mood = net > 0
    ? (net >= 50 ? "柜台上的银子摞起来，晃眼。" : "小赚一笔，灯油钱有了。")
    : "今日亏了本，灶膛的火都矮了半截。";
  const rep = repDelta > 0 ? `名声渐起（声望+${repDelta}）` : repDelta < 0 ? `口碑受挫（声望${repDelta}）` : "口碑平平";
  return `第${day}日·夜报：到客 ${guests} 人，营收 ${revenue} 两，工钱 ${wages} 两，净入账 ${net} 两。${rep}。${mood}`;
}

// 事件结果的系统短句模板（永远本地，不走 AI）
export const EVENT_RESULT_TEXT = {
  drunk_brawl: {
    self_win: "你一把拎起醉汉的后领，像拎小鸡一样丢出门外。满堂喝彩。",
    self_lose: "醉汉一坛子砸过来，你俩滚作一团，桌椅又折了两条腿。",
    guard: "护院上前两步，醉汉看清来人的刀，酒醒了三分，灰溜溜地走了。",
    pay: "你塞过去一锭银子，醉汉掂了掂，骂骂咧咧地走了。",
  },
  food_critic: {
    cook_win: "老饕放下筷子，闭眼半晌：「这一口，值回三天的路。」他逢人便说。",
    cook_lose: "老饕只动了一筷，摇摇头放下银子走了。你看着那盘菜，陷入沉思。",
    normal: "老饕按常吃了一顿，不咸不淡地走了。",
  },
  credit_regular: {
    allow_win: "三日后，老马帮头儿果然登门，连本带利还了 30 两。",
    allow_lose: "那之后，再没人见过老马帮头儿。账本上多了笔烂账。",
    refuse: "老马帮头儿讪讪地掏钱结了账，之后好些天没再来。",
  },
  storyteller: {
    hire: "说书人一拍醒木，满店鸦雀无声。讲到侠客坠崖，门口都挤满了人。",
    pass: "说书人讨了碗酒，自顾自喝完，踱去了别家。",
  },
  tax_check: {
    withAccountant: "账房先生不慌不忙捧出账本，公人翻了翻，挑不出错，象征性地罚了点就走了。",
    withoutAccountant: "公人翻了半天你那本糊涂账，冷笑一声，按头罚了一成。",
  },
  wandering_hero: "那江湖人喝完酒，把刀往桌上一放，问你还缺不缺看场子的。",
};
