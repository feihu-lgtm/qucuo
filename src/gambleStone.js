// gambleStone.js — 赌石系统「系统裁决层」
// 铁律：所有数值（种水/品相/裂缝/报价/成交/委托结果）由本模块 seededRand 骰定并写死，
// AI 只拿到结果做叙事，绝不参与裁决。对照主文档《赌石_玉器与原石设计.md》§4 职责划分。

import { QUALITY, rollQuality } from "./equipment.js";

// ---------- 基础：可复现随机（出生固化用） ----------
// mulberry32：给一个种子，产出确定性的伪随机序列。同一石头同一种子 → 每次结果一致。
export function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
}
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function weightedPick(rng, entries) {
  // entries: [[value, weight], ...]
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [v, w] of entries) { r -= w; if (r < 0) return v; }
  return entries[entries.length - 1][0];
}

// ---------- 场口（产地，影响涨垮概率权重，接主文档 §2.2） ----------
export const CHANG_KOU = {
  熊曲老坑: { label: "熊曲老坑", risk: "稳中偏好", jadeBias: 1, crackBias: 0.8, entryFee: 300,
    hint: "熊曲上游雪山冰川碛下来的老料，皮壳老结，种老多出冰种以上。" },
  鹰曲新场: { label: "鹰曲新场", risk: "波动大", jadeBias: 0, crackBias: 1.15, entryFee: 200,
    hint: "鹰曲峡谷冲刷的新料，皮薄水灵，忽好忽垮，赌性最烈。" },
  狼曲水石: { label: "狼曲水石", risk: "小赌怡情", jadeBias: -0.5, crackBias: 0.95, entryFee: 120,
    hint: "狼曲河床滚料，皮被水磨得干净，种嫩偏多，偶有惊喜。" },
  雪山老坑: { label: "雪山老坑", risk: "大赌大暴", jadeBias: 2, crackBias: 1.3, entryFee: 800,
    hint: "雪山派禁地私采的料，一块难求，顶级玻璃种概率最高，垮起来血本无归。" },
};

// ---------- 皮壳（决定外形与看皮线索，接主文档 §2.3） ----------
export const SKINS = {
  wusha: { label: "黑乌砂", clue: "容易解涨、抢手货，但也常一刀全裂——高风险高回报。" },
  huangsha: { label: "黄盐砂", clue: "沙翻得好有立体感，看砂粒匀不匀，匀则种好。" },
  yansha: { label: "白盐砂", clue: "有白雾则上等，无雾则种嫩——关键看有没有雾。" },
  laoxiang: { label: "老象皮", clue: "风化典型则玻璃底，起皱带刺是好兆头。" },
  tiexiu: { label: "铁锈皮", clue: "不怕底灰只怕无色，一有色必又翠又水。" },
  songhua: { label: "松花蟒带", clue: "松花是绿色暗示，蟒带是有色带走向——最强的有色线索。" },
};

// ---------- 种水档（6 档，对应肉图 jade_1..6） ----------
export const JADE_TIERS = [
  { key: 1, code: "bai", label: "灰白豆种", quality: "白" },
  { key: 2, code: "lv", label: "淡豆绿糯种", quality: "绿" },
  { key: 3, code: "lan", label: "飘蓝花冰种", quality: "蓝" },
  { key: 4, code: "zi", label: "紫罗兰种", quality: "紫" },
  { key: 5, code: "cheng", label: "黄翡玻璃种", quality: "橙" },
  { key: 6, code: "hong", label: "帝王绿玻璃种", quality: "红" },
];
export const GRADE = { chun: "纯", bai: "白", za: "杂" };
const GRADE_MULT = { chun: 1.0, bai: 0.55, za: 0.2 }; // 品相系数：纯值钱、杂几乎废
const CRACK_LOSS = 0.4;   // 该料位裂 → 价值 ×0.4
const SLOT_POS = ["top", "mid", "bot"];

// ---------- 石头出生固化 ----------
// 进料场买石时调用一次，seededRand 骰定全部真相并写死。AI 全程读不到真相。
export function birthStone(changKouKey, luck = 5, seedStr = "") {
  const ck = CHANG_KOU[changKouKey] || CHANG_KOU.鹰曲新场;
  const seed = seedFromString(`${changKouKey}|${seedStr}|${Date.now()}|${Math.random()}`);
  const rng = makeRng(seed);

  // 种水档：气运 + 场口 jadeBias 抬升高档概率
  const effLuck = Math.max(0, Math.min(10, luck + ck.jadeBias));
  const jadeTier = rollJadeTier(rng, effLuck);

  // 皮壳：随机（可按场口微调，这里先均匀）
  const skin = pick(rng, Object.keys(SKINS));

  // 三个料位各骰两层：品相(纯/白/杂) + 裂缝(好/裂)
  // 另出生固化：cutShape(1-6 随机刀口形状) + windowSeed(取料局部偏移)，均写死不可变。
  const slots = SLOT_POS.map((pos) => {
    const grade = weightedPick(rng, gradeWeights(jadeTier, effLuck));
    const crackChance = 0.28 * ck.crackBias;
    const crack = rng() < crackChance;
    const cutShape = 1 + Math.floor(rng() * 6);   // 刀口形状 cut_1..6，出生即定
    return { pos, grade, crack, opened: false, cutShape, windowSeed: Math.floor(rng() * 1e9) };
  });

  return {
    id: `stone_${seed.toString(36)}`,
    changKou: changKouKey,
    skin,
    jadeTier: jadeTier.key,
    jadeCode: jadeTier.code,
    quality: jadeTier.quality,   // 这块料的品质天花板（成品上限）
    slots,
    price: ck.entryFee,          // 进场买石花的钱（沉没成本，用于涨垮判断）
    _seed: seed,
  };
}

function rollJadeTier(rng, effLuck) {
  // 高气运偏向高档种水；低气运多低档
  const t = effLuck / 10;
  const w = [
    [JADE_TIERS[0], 40 - 30 * t],
    [JADE_TIERS[1], 25 - 5 * t],
    [JADE_TIERS[2], 18],
    [JADE_TIERS[3], 10 + 8 * t],
    [JADE_TIERS[4], 5 + 15 * t],
    [JADE_TIERS[5], 2 + 12 * t],
  ].map(([v, wt]) => [v, Math.max(0.5, wt)]);
  return weightedPick(rng, w);
}
function gradeWeights(jadeTier, effLuck) {
  // 高档种水 + 高气运 → 更容易出「纯」
  const bonus = (jadeTier.key - 1) * 0.04 + effLuck * 0.02;
  return [
    ["chun", 0.30 + bonus],
    ["bai", 0.40],
    ["za", Math.max(0.1, 0.30 - bonus)],
  ];
}

// ---------- 看皮（悟性影响线索可信度，接主文档 §2.3） ----------
// 返回给 AI 演相石口诀用的线索文字 + 场口暗示（悟性高才读得准）
export function readSkinClue(stone, wit = 5) {
  const skin = SKINS[stone.skin];
  const ck = CHANG_KOU[stone.changKou];
  const canReadChangKou = wit >= 7; // 悟性高才认得出场口
  return {
    skinLabel: skin.label,
    skinClue: skin.clue,
    changKouHint: canReadChangKou ? ck.hint : null,
    // 悟性高时给「雾」暗示（雾走叙事不做图层）
    mistHint: wit >= 6 ? (stone.quality === "红" || stone.quality === "橙" ? "皮下隐约透白雾，怕是种老的上等料" : "皮下无雾，种怕是嫩了些") : null,
  };
}

// ---------- 开一刀（系统裁决切涨切垮，AI 只演过程） ----------
export function cutSlot(stone, pos) {
  const slot = stone.slots.find((s) => s.pos === pos);
  if (!slot || slot.opened) return null;
  slot.opened = true;
  const tier = JADE_TIERS[stone.jadeTier - 1];
  const base = qualityBaseValue(tier.quality);
  let value = base * GRADE_MULT[slot.grade];
  if (slot.crack) value *= CRACK_LOSS;
  slot.value = Math.round(value);
  return {
    pos,
    grade: slot.grade,          // 纯/白/杂 → 决定露哪张肉图
    gradeLabel: GRADE[slot.grade],
    crack: slot.crack,          // 有裂 → 叠裂缝层 + 播爆裂特效
    value: slot.value,
    jadeCode: tier.code,        // 露哪张肉图 jade_{key}_{code}_{grade}
    // 供 AI 叙事的既定结果（AI 不得更改）
    outcome: slot.crack ? "裂" : (slot.grade === "chun" ? "涨" : slot.grade === "za" ? "垮" : "平"),
  };
}
function qualityBaseValue(quality) {
  // 品质基线价（红档最贵）
  const idx = QUALITY.indexOf(quality);
  return [100, 300, 800, 2000, 5000, 15000][idx] ?? 100;
}

// 三刀开完的整块估值 + 涨垮判断
export function appraiseStone(stone) {
  const opened = stone.slots.filter((s) => s.opened);
  const total = opened.reduce((a, s) => a + (s.value || 0), 0);
  const allOpened = opened.length === 3;
  const verdict = total > stone.price * 1.5 ? "大涨" : total > stone.price ? "涨" : total > stone.price * 0.5 ? "平" : "垮";
  return { total, allOpened, verdict, cost: stone.price };
}

// ---------- 竞价者（轻量临时对象，不污染 room.npcs，接主文档 §2.6） ----------
// 性格系数决定报价高低与可信度
// 竞价者名单：name 必须与在场 NPC 一致（否则在场匹配失败）——
// 游走分身走 npcPool.js 的 gambleBidder（李若由/才旦/苏宛/差役/雪山/黑风），
// 兰姐走 schedule 分时段注入，温掌柜是 residentNpcs 驻场庄家（性转女掌柜版）。
// 本轮换人（交接文档§三）：fushang→liruoyou、xiaofan→caidan、muming→suwan，新增 wen 庄家位。
export const BIDDER_TYPES = {
  liruoyou: { name: "李若由", mult: 0.95, cash: 20000, kind: "cash",
    bio: "玉泉小栈的经营者、商人之女，来料场进货淘石。出价贴着市价，利润算得死，见裂立刻压价退出。" },
  chaiyi: { name: "锦官差役", mult: 1.0, cash: 15000, kind: "cash", onlyWeapon: true,
    bio: "略高于行价，但只收武器胚料；散场会走到赢家身边递句话——不是邀请，是备案。" },
  xueshan: { name: "雪山弟子", mult: 0.7, cash: 3000, kind: "barter",
    bio: "出价不高，以物易物——付丹药、练功秘籍残页。急需提武功的划算。" },
  heifeng: { name: "黑风寨采买", mult: 0.6, cash: 2000, kind: "favor",
    bio: "出价最低，但加一句人情债——巴桑哥记着，下次去黑风寨不用通报。" },
  caidan: { name: "才旦", mult: 0.7, cash: 4000, kind: "cash",
    bio: "鱼定村长之女，替村里置办石料，账算得滴水不漏。嘴上永远贬低你的窗口，但她肯出价=石里有货（反向信号最可信）。" },
  suwan: { name: "苏宛", mult: 0.85, cash: 4500, kind: "cash",
    bio: "苏记茶货铺的姑娘，温掌柜的干侄女。出价爽快嘴又甜，只是抬起价来有点蹊跷——像是替姑母的场子暖局。" },
  lanjie: { name: "兰姐", mult: 0.85, cash: 12000, kind: "condition", rare: true,
    bio: "百花门主，出价未必最高，带附加条件——料我要了，打磨费我出，另请你喝桂花酿。附加条件有时比银子值钱。" },
  wen: { name: "温掌柜", mult: 0.55, cash: 999999, kind: "boss",
    bio: "料场庄家、回收兜底。价低于市面但照单全收——「裂了的料有裂了的用处，天底下没有真废的东西，只有不认账的人。」" },
};

// Deal-or-No-Deal 式定价地基：基准 = 剩余期望 × 折价系数
export function biddingBase(stone) {
  const app = appraiseStone(stone);
  const openedValue = app.total;
  const remain = stone.slots.filter((s) => !s.opened).length;
  // 剩格越多方差越大 → 折价越狠（风险贴现）
  const discount = 0.55 + 0.12 * (3 - remain);
  // 已开料越好 → 对剩余的期望越高
  const remainExpect = remain * qualityBaseValue(stone.quality) * 0.15;
  return Math.round((openedValue + remainExpect) * discount);
}

// 生成本轮在场的竞价者（含偶现概率 + 各自报价，系统裁决）
export function rollBidders(stone, luck = 5) {
  const base = biddingBase(stone);
  const rng = makeRng(seedFromString(stone.id + "|" + stone.slots.filter(s => s.opened).length));
  const app = appraiseStone(stone);
  const out = [];
  for (const [key, t] of Object.entries(BIDDER_TYPES)) {
    if (t.rare && rng() > 0.5) continue;         // 偶现者过滤
    if (t.onlyWeapon && stone.quality === "白") continue;
    let offer = Math.round(base * t.mult * (0.9 + rng() * 0.2)); // ±噪声
    offer = Math.min(offer, t.cash);              // 报价不超过兜里的钱
    // 庄家兜底（boss=温掌柜）：必出、从不拒收，回收价至少石头进价六成——
    // 「从不让人空手出门」，三刀全垮也有这条退路。
    if (t.kind === "boss") offer = Math.max(offer, Math.round(stone.price * 0.6));
    // 托儿标记（老板的局）：随机一个非噪声买家被安插为托儿
    out.push({
      key, name: t.name, avatar: t.avatar, kind: t.kind, bio: t.bio,
      offer: t.kind === "noise" ? 0 : offer,
      cash: t.cash,
      isShill: false, // 识破做局暂搁，先留字段
    });
  }
  // 见裂压价：整块有裂时，cash 型买家报价打折
  if (stone.slots.some((s) => s.opened && s.crack)) {
    out.forEach((b) => { if (b.kind === "cash") b.offer = Math.round(b.offer * 0.7); });
  }
  return out.sort((a, b) => b.offer - a.offer);
}

// ---------- 谈价：AI 只回两个系统认得的字段，系统 clamp/校验（守铁律，本文 §九） ----------
// aiResponse: { narrative, priceMult, addItem }
export function settleNegotiation(bidder, aiResponse, carryItems = []) {
  const raw = Number(aiResponse?.priceMult);
  const mult = isFinite(raw) ? Math.max(0.8, Math.min(1.5, raw)) : 1.0; // clamp 死区间
  const finalOffer = Math.min(Math.round(bidder.offer * mult), bidder.cash);
  // 校验追加物品：必须在该竞价者 carry 里、且是合法物品
  let addItem = null;
  if (aiResponse?.addItem) {
    const found = carryItems.find((it) => it.id === aiResponse.addItem || it.name === aiResponse.addItem);
    if (found) addItem = found;
  }
  return { narrative: aiResponse?.narrative || "", finalOffer, addItem, mult };
}

// ---------- 委托做装备（30 被偷 / 10 失败 / 60 成功，接主文档 §2.4/§3） ----------
export function rollCommission(stone, luck, feePaid, feeThreshold = 200) {
  const rng = Math.random();
  if (rng < 0.30) return { result: "stolen", item: null };   // 料被偷
  if (rng < 0.40) return { result: "failed", item: null };   // 料废了
  // 成功：有效 luck' = 气运 + 品质档加成 + floor(手工费/阈值)
  const qIdx = QUALITY.indexOf(stone.quality);
  const effLuck = Math.max(0, Math.min(10, luck + qIdx + Math.floor(feePaid / feeThreshold)));
  return { result: "success", quality: rollQuality(effLuck) };
}

// ---------- 供前端渲染：某料位露哪张肉图 ----------
export function slotJadeSprite(stone, slot) {
  const tier = JADE_TIERS[stone.jadeTier - 1];
  return `jade_${tier.key}_${tier.code}_${slot.grade}.png`;
}
export function skinSprite(stone) { return `skin_${stone.skin}.png`; }
export function crackSprite(pos) { return `crack_${pos}.png`; }
