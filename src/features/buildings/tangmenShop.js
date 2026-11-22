import { buyFactionShopItem, factionShopOffer } from "./factionShop.js";

export const TANGMEN_SHOP = "唐门暗器";

// 锦官城外堂和唐堡内库共用「唐门暗器」货池，规则见 factionShop.js。
export const tangmenShopOffer = (varTree, outlet) => factionShopOffer(TANGMEN_SHOP, varTree, outlet);

export const buyTangmenItem = (state, itemName, now) => buyFactionShopItem(state, TANGMEN_SHOP, itemName, now);
