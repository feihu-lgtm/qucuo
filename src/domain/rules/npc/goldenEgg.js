import { loadCopy } from "../../../copy/loadCopy.js";

// 元朵朵·金鸟金蛋每日签到：每游戏日（time/24 取整）一次，金鸟飞进来下一颗金蛋。
// 这里是纯数据与判定——状态读写走 features/npc/goldenEgg.js。
//
// 有 API 时开什么由 AI 自由随机（goldenEgg.prize 调用，见 app/calls/hookCalls.js）：
// 系统先按气运掷定品阶，AI 只出名字/类别/描述/朵朵反应，数值与价格由 makeItem 按品阶算。
// 无 API 或 AI 失败时退回下面的加权奖池（GOLDEN_EGG_POOL），朵朵的反应用手写兜底句。
//
// 奖池只有三类：money（银两直接加 char.money）/ item（CATALOG_INDEX 真实词条，
// makeNamedItem 实例化进 inv，自带 buyPrice/sellPrice，能卖回朵朵店里）/
// empty（空蛋整蛊）。权重全写在这张表里，调概率只动 weight。

export const GOLDEN_EGG_POOL = [
  // 银两档——大头，图个彩头。
  { id: "coin_small", kind: "money", amount: 3, weight: 30, label: "碎银三两" },
  { id: "coin_mid", kind: "money", amount: 10, weight: 18, label: "一锭银十两" },
  { id: "coin_big", kind: "money", amount: 40, weight: 5, label: "金锭一坨" },
  // 好物档——名字必须命中 CATALOG_INDEX，实例化自带价格，可入随身交易经济。
  { id: "it_candy", kind: "item", itemName: "松子糖", weight: 10, label: "松子糖" },
  { id: "it_salve", kind: "item", itemName: "金疮药", weight: 10, label: "金疮药" },
  { id: "it_pingankou", kind: "item", itemName: "豆种玉平安扣", weight: 8, label: "豆种玉平安扣" },
  { id: "it_jade", kind: "item", itemName: "翡翠玉镯·温润", weight: 4, label: "翡翠玉镯·温润" },
  { id: "it_emei", kind: "item", itemName: "玉柄峨眉刺", weight: 1, label: "玉柄峨眉刺" },
  // 稀有档：整蛊情趣物（朵朵当场羞到跳脚）与卡券（凭卡强开亲密门槛）。
  { id: "it_fake", kind: "item", itemName: "假阳具", weight: 2, blush: true, label: "假阳具" },
  { id: "it_ticket", kind: "item", itemName: "女眷一次卡·不可拒绝", weight: 2, label: "女眷一次卡·不可拒绝" },
  // 空蛋整蛊——朵朵自己都绷不住那种。
  { id: "empty", kind: "empty", weight: 14, label: "空蛋" },
];

// 「女眷一次卡·不可拒绝」的行囊识别名——resolveIntent 亲密判门按名认卡。
export const INTIMATE_TICKET_NAME = "女眷一次卡·不可拒绝";

// 朵朵的反应分档：大奖肉疼 / 空蛋嘲笑 / 小奖得意。kind→反应档。
export function eggTier(entry) {
  if (!entry || entry.kind === "empty") return "empty";
  if (entry.blush) return "blush"; // 情趣物：朵朵羞到跳脚
  if (entry.kind === "money") return entry.amount >= 40 ? "jackpot" : "small";
  return entry.weight <= 4 ? "jackpot" : "small";
}

// 游戏日序号：time 以小时计，24 小时一天。time 缺失按第 0 天，不让存档异常卡死签到。
export function eggGameDay(time) {
  return Math.floor((Number.isFinite(time) ? time : 0) / 24);
}

// 加权抽一条奖池项。
export function rollGoldenEgg(rng = Math.random) {
  const total = GOLDEN_EGG_POOL.reduce((s, e) => s + e.weight, 0);
  let roll = rng() * total;
  for (const entry of GOLDEN_EGG_POOL) {
    roll -= entry.weight;
    if (roll < 0) return entry;
  }
  return GOLDEN_EGG_POOL[0];
}

// npcState 里存签到日的固定键——按玩家不按 NPC 实例，朵朵换房间也不重计。
// 存 { lastDay: 游戏日序号 }；旧档里按真实日期存的 { lastDate } 没有 lastDay，视为未领，不挡今天。
export const GOLDEN_EGG_STATE_KEY = "duoduoGoldenEgg";

export function eggAlreadyClaimed(npcState, time) {
  const lastDay = npcState?.[GOLDEN_EGG_STATE_KEY]?.lastDay;
  return Number.isFinite(lastDay) && lastDay === eggGameDay(time);
}

// ── 朵朵临场反应兜底 ─────────────────────────────────────────────────────
// 有 API 时她的反应随 goldenEgg.prize 一并由 AI 写出；这里只留无 API / AI 失败时的手写句。

// 无 API 兜底：按反应档各备几条手写句，随机挑。
const FALLBACK = {
  jackpot: [
    "朵朵眼睁睁看着金锭落进你掌心，小脸一垮，捂着自己的荷包直跺脚——那是她的鸟！她的金蛋！",
    "她倒吸一口凉气，扑上去差点把金蛋抢回来，硬生生憋成一句：算、算你运气好。",
  ],
  small: [
    "朵朵得意洋洋地抱起胳膊，鼻子里哼出一声：看吧，跟着本小姐，有肉吃。",
    "她得意地拍拍金鸟的脑袋：我家的鸟从不叫人空着手回去。",
    "朵朵把下巴抬得老高：这点彩头算什么，明儿还来。",
  ],
  blush: [
    "朵朵瞄见蛋壳里那物件，腾地一下脸红到耳根，一把把蛋扣住嚷嚷这不是她的——越描越黑，最后跺着脚把东西硬塞给你。",
    "她看清开出的是什么，「呀」地一声捂住脸，从指缝里挤出一句：拿、拿走！就当没见过！",
  ],
  empty: [
    "朵朵愣了一下，随即笑得直不起腰，指着空蛋壳上气不接下气：空、空的！你的手气比我的鸟还抠！",
    "她捂着嘴憋了半天没憋住，噗嗤笑出声：金鸟也会看人下菜碟呀。",
  ],
};

export function eggFallbackLine(tier, rng = Math.random) {
  const lines = FALLBACK[tier] || FALLBACK.small;
  return lines[Math.floor(rng() * lines.length) % lines.length];
}

// ── AI 自由开奖（goldenEgg.prize）─────────────────────────────────────────

const EGG_PRIZE_SYS = loadCopy("goldenEgg.sys.txt");
export const EGG_PRIZE_CATEGORIES = ["weapon", "armor", "accessory", "misc"];
export const EGG_PRIZE_MOODS = ["jackpot", "small"];

// 「现成物件」名单：奖池里寻常的具名物件（不含情趣物与卡券，那两样只留在无 API 兜底奖池）。
export const EGG_CATALOG_PICKS = GOLDEN_EGG_POOL
  .filter((e) => e.kind === "item" && !e.blush && e.itemName !== INTIMATE_TICKET_NAME)
  .map((e) => e.itemName);

export function eggPrizePrompt({ quality, picks = EGG_CATALOG_PICKS }) {
  const user = `今日金鸟落在元朵朵肩头，下了一颗金蛋，玩家当场就要开。
系统掷定的品阶：${quality}（白、绿、蓝、紫、橙、红，由低到高）。
现成物件（可挑可不挑）：${picks.join("、") || "无"}

只输出 JSON：
{"name":"物件名，不超过八个字","category":"weapon|armor|accessory|misc 四选一（兵器/护身之物/随身饰物/其余杂物）","desc":"一两句说书人描述，讲它的模样或来历","mood":"jackpot|small","reaction":"朵朵当场的反应，不超过六十字"}`;
  return { sys: EGG_PRIZE_SYS, user };
}

// 原生结构化输出 schema：五键全必填、无联合类型，满足 strict 通道。
export const EGG_PRIZE_SCHEMA = {
  name: "golden_egg_prize",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["name", "category", "desc", "mood", "reaction"],
    properties: {
      name: { type: "string" },
      category: { type: "string", enum: EGG_PRIZE_CATEGORIES },
      desc: { type: "string" },
      mood: { type: "string", enum: EGG_PRIZE_MOODS },
      reaction: { type: "string" },
    },
  },
};

const stripText = (v, max) => String(v ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);

// 把 AI 回包裁成能落账的奖品；名字空了就判无效（由调用方退回兜底奖池）。
export function parseEggPrize(data) {
  if (!data || typeof data !== "object") return null;
  const name = stripText(data.name, 12).replace(/[「」『』"“”]/g, "");
  if (!name) return null;
  return {
    name,
    category: EGG_PRIZE_CATEGORIES.includes(data.category) ? data.category : "misc",
    desc: stripText(data.desc, 120),
    mood: EGG_PRIZE_MOODS.includes(data.mood) ? data.mood : "small",
    reaction: stripText(data.reaction, 120),
  };
}
