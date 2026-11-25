// ── S3 自由行动破费查价链（纯函数）──────────────────────────────────
// 顺序：①驻场商铺货架同名贵品价 → ②货架同类货价 → ③物件志（catalog 具名）价
//       → ④priceForQuality(category,"白") ——都查不到由调用方落 risk 默认。
// 货架 = 在场商户 NPC（QUCUO_SHOPS[name]）的静态铺货 buildShopInventory；
// 不掷当日滚动 stock——查价只需「这家店这类货卖多少」的确定性锚。

import { QUCUO_SHOPS, buildShopInventory } from "../../data/shops/qucuoShops.js";
import { CATALOG_INDEX } from "../../data/items/catalog.js";
import { priceForQuality } from "../economy/equipment.js";

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
  // ③ 物件志具名价（基价按具名条目的 category+quality 公式，不取倍率后高价——破费是常价锚）
  if (wanted && CATALOG_INDEX[wanted]) {
    const entry = CATALOG_INDEX[wanted];
    const p = priceForQuality(entry.category || "misc", entry.quality || "白");
    if (p.buyPrice > 0) return { price: p.buyPrice, source: `物件志（${wanted}）` };
  }
  // ④ 白档公式兜底
  const fallback = priceForQuality(category || "misc", "白");
  if (fallback.buyPrice > 0) return { price: fallback.buyPrice, source: `${category || "misc"}白档基准` };
  return null;
}
