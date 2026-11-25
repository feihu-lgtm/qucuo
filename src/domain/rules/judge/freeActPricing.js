// ── S3 自由行动破费查价链（纯函数）──────────────────────────────────
// 顺序：①驻场商铺货架同名贵品价 → ②货架同类货价 → ③物件志（catalog 具名）价
//       → ④priceForQuality(category,"白") ——都查不到由调用方落 risk 默认。
// 货架 = 在场商户 NPC（QUCUO_SHOPS[name]）的静态铺货 buildShopInventory；
// 不掷当日滚动 stock——查价只需「这家店这类货卖多少」的确定性锚。

import { QUCUO_SHOPS, buildShopInventory } from "../../data/shops/qucuoShops.js";
import { CATALOG_INDEX } from "../../data/items/catalog.js";
import { priceForQuality } from "../economy/equipment.js";

// 中文数字解析（破费原话数额）：三两/十五两/一百二十两 与阿拉伯数字并认。
const CN_DIGITS = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const CN_UNITS = { 十: 10, 百: 100, 千: 1000, 万: 10000 };
function parseCnNumeral(str) {
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  let total = 0, section = 0, num = 0, seen = false;
  for (const ch of str) {
    if (ch in CN_DIGITS) { num = CN_DIGITS[ch]; seen = true; }
    else if (ch in CN_UNITS) {
      const u = CN_UNITS[ch];
      seen = true;
      if (u === 10000) { total += (section + num) * u; section = 0; }
      else section += (num || 1) * u;
      num = 0;
    } else return NaN;
  }
  const out = total + section + num;
  return seen && Number.isFinite(out) ? out : NaN;
}

// 原话写数额按原话：「掏出 30 两」「花三两请客」都认；没写返回 null。
// 数额歧义：「买一两茶叶，付5两银子」里前一个是货量——全量扫描，
// 支付动词（付/掏/掷/赏/出/花/给/递）近旁（前三字内）的匹配优先，其余按文序取先。
const PAY_VERBS = new Set([..."付掏掷赏出花给递"]);
export function parseStatedExpense(text) {
  const re = /([零一二三四五六七八九十百千万\d]+)\s*(?:两|银|钱)/g;
  const src = String(text || "");
  let m; let first = null; let paid = null;
  while ((m = re.exec(src))) {
    const n = parseCnNumeral(m[1]);
    if (!(Number.isFinite(n) && n > 0)) continue;
    if (first == null) first = n;
    const before = src.slice(Math.max(0, m.index - 3), m.index);
    if (paid == null && [...before].some((ch) => PAY_VERBS.has(ch))) paid = n;
  }
  return paid ?? first;
}

export function resolveFreeActExpense({ text = "", itemName = "", category = "misc", presentNpcNames = [] } = {}) {
  // ①② 驻场货架
  const shelves = [];
  for (const name of presentNpcNames || []) {
    if (!QUCUO_SHOPS[name]) continue;
    const inv = buildShopInventory(name);
    if (inv?.items?.length) shelves.push(...inv.items);
  }
  const wanted = String(itemName || "").trim();
  if (shelves.length) {
    // 同名：itemName 精确命中，或玩家原话里点了货架上的货名
    const sameName = shelves.find((it) => (wanted && it.name === wanted) || (it.name && String(text).includes(it.name)));
    if (sameName?.buyPrice > 0) return { price: sameName.buyPrice, source: `货架同名（${sameName.name}）` };
    // 同类
    const sameCat = shelves.find((it) => it.category === category);
    if (sameCat?.buyPrice > 0) return { price: sameCat.buyPrice, source: `货架同类（${sameCat.name}）` };
  }
  // ③ 物件志具名价（基价按具名条目的 category+quality 公式，不取倍率后高价——破费是常价锚）。
  // intake 常给 item:"无" 而原文点名货物——此时扫原文里出现的具名（>=2 字防单字误撞）。
  // 最长优先——「柳青鸢的菊花茶」不得被短名「青鸢」截胡（茶 18 不得按武器 330 签）
  const cnName = (wanted && CATALOG_INDEX[wanted]) ? wanted
    : Object.keys(CATALOG_INDEX).filter((n) => n.length >= 2 && String(text).includes(n)).sort((a, b) => b.length - a.length)[0] || "";
  if (cnName) {
    const entry = CATALOG_INDEX[cnName];
    const p = priceForQuality(entry.category || "misc", entry.quality || "白");
    if (p.buyPrice > 0) return { price: p.buyPrice, source: `物件志（${cnName}）` };
  }
  // ④ 白档公式兜底
  const fallback = priceForQuality(category || "misc", "白");
  if (fallback.buyPrice > 0) return { price: fallback.buyPrice, source: `${category || "misc"}白档基准` };
  return null;
}
