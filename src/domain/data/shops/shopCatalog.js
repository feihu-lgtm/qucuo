import { shopsA } from "./shopCatalogA.js";
import { shopsB } from "./shopCatalogB.js";
import { shopsSnowland } from "./shopCatalogSnowland.js";

// 所有固定商店货品清单。key 对应 qucuoBuildings.js 的 shopKey 字段。
// 货品价格由 makeItem → priceForQuality 统一计算，卖出 = 买价 / 2。
export const QUCUO_SHOPS = { ...shopsA, ...shopsB, ...shopsSnowland };
