// ── 日更杂货摊（设计：机关叮叮车铁伯推摊，垃圾为主偶有宝贝，节气大促）──
// 货架=当日生成的条目落进 NPC carriedItems（带 dailyShop=dayKey 记位），
// 复用随身交易的货架/买入/偷窃/出场固化全链路，不另起交易系统。
// 纯函数无 IO：刷新产出 changes{room,npcState} 由调用方落账。
import { seededRand } from "../../../utils/seededRandom.js";

// 目前只元朵朵一摊；日后加摊主往这里登记即可。
const DAILY_SHOP_NPCS = new Set(["元朵朵"]);
export const isDailyShopNpc = (npc) => !!(npc && DAILY_SHOP_NPCS.has(npc.name));

/** UTC+8 自然日「YYYY-MM-DD」——换日即换货。 */
export function dailyShopDayKey(now = new Date()) {
  return new Date(now.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
}

// 二十四节气（平年近似公历日，游戏级精度）：节气日货架出特供+全场折扣。
const PROMO_TERMS = {
  "01-06": "小寒", "01-20": "大寒", "02-04": "立春", "02-19": "雨水",
  "03-06": "惊蛰", "03-21": "春分", "04-05": "清明", "04-20": "谷雨",
  "05-06": "立夏", "05-21": "小满", "06-06": "芒种", "06-21": "夏至",
  "07-07": "小暑", "07-23": "大暑", "08-08": "立秋", "08-23": "处暑",
  "09-08": "白露", "09-23": "秋分", "10-08": "寒露", "10-23": "霜降",
  "11-07": "立冬", "11-22": "小雪", "12-07": "大雪", "12-22": "冬至",
};
export const PROMO_DISCOUNT = 0.7;
export function promoForDay(dayKey) {
  const term = PROMO_TERMS[dayKey?.slice(5)];
  return term ? { term, discount: PROMO_DISCOUNT } : null;
}

// 垃圾杂货池：价格即原价（两）。
const JUNK_POOL = [
  { name: "掉漆的木马勺", desc: "舀汤漏一半，朵朵说是西域古董。", price: 3 },
  { name: "半块霉月饼", desc: "去年的，硬得能当暗器。", price: 1 },
  { name: "缺页的黄历", desc: "只剩忌日那几页，摊主说吉利话都被人撕走了。", price: 2 },
  { name: "生锈的铜铃铛", desc: "摇起来像铁伯咳嗽。", price: 4 },
  { name: "裂口粗瓷碗", desc: "沿口豁了三处，喝粥硌嘴。", price: 2 },
  { name: "褪色红头绳", desc: "朵朵戴过三天的，她自己忘了。", price: 5 },
  { name: "钝口小剪刀", desc: "剪不断纸，剪得断耐心。", price: 3 },
  { name: "缺一只的耳环", desc: "另一只兴许掉在锦官哪个当铺。", price: 6 },
  { name: "漏风的油纸伞", desc: "撑开像个筛子，朵朵说透风凉快。", price: 8 },
  { name: "假翡翠扳指", desc: "玻璃底子染绿，灯下还挺唬人。", price: 9 },
  { name: "半瓶跌打酒", desc: "谁喝剩的不知道，药劲倒是真的。", price: 7 },
  { name: "绣歪了的香囊", desc: "鸳鸯绣成了两只水鸭。", price: 5 },
  { name: "卷刃的剔骨小刀", desc: "切豆腐都费劲，胜在便宜。", price: 4 },
  { name: "哑炮仗", desc: "点不着的那种，朵朵进了一整箱。", price: 1 },
  { name: "掉毛的拂尘", desc: "挥两下只剩个杆。", price: 6 },
  { name: "错版当票", desc: "锦官通宝当铺印坏的票根，朵朵说绝版值钱。", price: 10 },
  { name: "半块磨刀石", desc: "磨了十年剩个角，摊上说够用。", price: 3 },
  { name: "虫蛀的竹简书", desc: "字没剩几个，当个摆设倒雅致。", price: 5 },
];

// 真宝贝池：小概率出一件。
const TREASURE_POOL = [
  { name: "墨家小机关匣", desc: "铁伯同门手艺，拧上发条会自己挪步的紫檀小匣。", price: 80, quality: "蓝" },
  { name: "西域琉璃盏", desc: "真货琉璃，灯下一转七彩流光——朵朵这回没看走眼。", price: 120, quality: "蓝" },
  { name: "前朝错金带钩", desc: "错金云纹没磨掉，行里说出自王爷墓。", price: 150, quality: "紫" },
  { name: "半页剑谱残章", desc: "只剩三式，剑意倒是真东西。", price: 200, quality: "紫" },
  { name: "南海珍珠簪", desc: "珠圆有晕彩，不是蚌壳粉搓的。", price: 100, quality: "蓝" },
  { name: "金丝软猬甲残片", desc: "巴掌大一片金丝网，缝在护腕上就是保命符。", price: 180, quality: "紫" },
  { name: "老坑端砚", desc: "下发如油，朵朵拿它压过咸菜。", price: 90, quality: "蓝" },
  { name: "吐蕃雪獒牙坠", desc: "獒王犬齿，藏人说能辟邪。", price: 110, quality: "蓝" },
];

// 节气特供：表里有就上桌，没有就按节气名凑一个福袋。
const PROMO_SPECIALS = {
  清明: { name: "艾草青团", desc: "铁伯肚膛里焐着的青团，艾香软糯。", price: 15 },
  冬至: { name: "桂花冬酿", desc: "锦官桂花糯米酒，一年就开这一坛。", price: 25 },
  立春: { name: "咬春萝卜卷", desc: "脆生生一卷春意，朵朵非说吃了转运。", price: 12 },
  端午: { name: "五丝粽子", desc: "五花绳扎的角粽，咸甜各半。", price: 14 },
  七夕: { name: "乞巧红线", desc: "据说绑在腕上招桃花。", price: 18 },
  中秋: { name: "流心月饼", desc: "今年新烤的，真的会流心。", price: 20 },
  重阳: { name: "茱萸香囊", desc: "登高必备，驱虫辟邪。", price: 16 },
};
const promoSpecialFor = (term) => PROMO_SPECIALS[term]
  || { name: `${term}节气福袋`, desc: `朵朵为${term}攒的特供礼包，里面是什么她自己也忘了。`, price: 22 };

/**
 * 当日货架：seeded 可重放——同一天同一摊主必然同一批货。
 * 垃圾杂货 5-7 件 + 约三成概率一件真宝贝；节气日加特供、全场折扣。
 */
export function genDailyStock(dayKey, ownerId = "duoduo") {
  const dayIdx = Math.floor(Date.parse(`${dayKey}T00:00:00Z`) / 86400000);
  const rng = seededRand(dayIdx, `日更摊_${ownerId}`);
  const promo = promoForDay(dayKey);
  const discount = promo?.discount ?? 1;
  const pickN = (pool, n) => {
    const idx = new Set();
    while (idx.size < Math.min(n, pool.length)) idx.add(Math.floor(rng() * pool.length));
    return [...idx].map((i) => pool[i]);
  };
  const junk = pickN(JUNK_POOL, 5 + Math.floor(rng() * 3));
  const treasure = rng() < 0.35 ? pickN(TREASURE_POOL, 1) : [];
  const items = [...junk, ...treasure].map((g, i) => ({
    ...g,
    id: `${ownerId}_ds_${dayKey}_${i}`,
    category: g.category || "misc",
    quality: g.quality || "白",
    slot: "bag",
    sellable: true,
    cherish: 0,
    price: Math.max(1, Math.round(g.price * discount)),
    // 与 priceForQuality 同口径：转卖价=实付半价——不然买到的货没有
    // sellPrice，交易屏不让卖、quoteSell 也拒收。
    sellPrice: Math.max(1, Math.round(Math.max(1, Math.round(g.price * discount)) / 2)),
    dailyShop: dayKey,
  }));
  if (promo) {
    const sp = promoSpecialFor(promo.term);
    items.unshift({
      ...sp,
      id: `${ownerId}_ds_${dayKey}_promo`,
      category: "misc", quality: "蓝", slot: "bag",
      sellable: true, cherish: 0,
      price: Math.max(1, Math.round(sp.price * discount)),
      sellPrice: Math.max(1, Math.round(Math.max(1, Math.round(sp.price * discount)) / 2)),
      dailyShop: dayKey,
    });
  }
  return { items, promo };
}

/**
 * 每日刷新判定+产出：npcState[key].dailyShopDay 记刷新日，条目带
 * dailyShop=dayKey 记位。同日已刷过→null；否则剔除过日旧货、挂上今日新货，
 * 返回 {npc, room, npcState, promo, logs} 由调用方落 changes。
 * 买走的条目已从 carriedItems 划走，不会因重刷回来——台账与货架同源。
 */
export function refreshDailyShop(state, npc, now = new Date()) {
  if (!isDailyShopNpc(npc)) return null;
  const dayKey = dailyShopDayKey(now);
  const key = npc.id ?? npc.name;
  const rec = state.npcState?.[key];
  const hasToday = (npc.carriedItems || []).some((i) => i.dailyShop === dayKey);
  // 今天已上过摊→null：哪怕货被买空/偷空也不回补——否则买空再开摊就是白嫖补货。
  if (rec?.dailyShopDay === dayKey) return null;
  // 今日货已在摊但台账没记上（老档/丢账）：只补记刷新日，不重复上货——
  // 否则同 seed 同 id 的条目会在 carriedItems 里出双份。
  if (hasToday) {
    return {
      npc,
      room: state.room || null,
      npcState: { ...(state.npcState || {}), [key]: { ...(rec || {}), name: npc.name, dailyShopDay: dayKey } },
      promo: promoForDay(dayKey),
      logs: [],
    };
  }
  const { items, promo } = genDailyStock(dayKey, key);
  const carriedItems = [...(npc.carriedItems || []).filter((i) => !i.dailyShop), ...items];
  const nextNpc = { ...npc, carriedItems };
  const room = state.room
    ? { ...state.room, npcs: (state.room.npcs || []).map((n) => (n === npc || n.id === npc.id ? nextNpc : n)) }
    : null;
  const npcState = {
    ...(state.npcState || {}),
    [key]: { ...(rec || {}), name: npc.name, dailyShopDay: dayKey },
  };
  const logs = [
    { t: "sys", text: `  铁伯推着叮叮车吱呀停下，${npc.name}掀开布帘吆喝——今日新货上摊。` },
    ...(promo ? [{ t: "sys", text: `  节气大促·${promo.term}：特供上架，摊上货色统统七折！` }] : []),
  ];
  return { npc: nextNpc, room, npcState, promo, logs };
}
