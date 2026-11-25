import { priceForQuality, CATEGORY_LABEL } from "../economy/equipment.js";
import { SERVICE_MENUS } from "../../data/buildings/menuData.js";

const foodPrice = () => SERVICE_MENUS.饭馆.find((dish) => dish.name === "青稞糌粑").price;
const weaponPrice = () => priceForQuality("weapon", "白").buyPrice;
export const GIFT_WEIGHT = {
  modest: /乞丐|流浪汉/,
  wealthy: /土司本人|土司之女|^土司$/,
  baseline: {
    modest: foodPrice,
    ordinary: () => priceForQuality("misc", "白").buyPrice,
    wealthy: weaponPrice,
  },
  bands: [
    { ratio: 0, label: "薄礼", range: [1, 2], reaction: "礼貌致谢，礼轻情意重，仍记一份心意" },
    { ratio: 0.5, label: "寻常", range: [2, 4], reaction: "自然领情，略显亲切" },
    { ratio: 1.5, label: "厚礼", range: [4, 6], reaction: "明显动容，具体说出这份礼对自己为何有用" },
    { ratio: 4, label: "重金", range: [6, 9], reaction: "郑重承情，表现出礼物非同寻常，但不凭空许诺回报" },
  ],
};

export function computeGiftWeight(npc, gift) {
  const identity = [npc?.name, npc?.brief, npc?.title].filter(Boolean);
  const station = identity.some((text) => GIFT_WEIGHT.modest.test(text)) ? "modest"
    : identity.some((text) => GIFT_WEIGHT.wealthy.test(text)) ? "wealthy" : "ordinary";
  const value = gift.amount ?? priceForQuality(gift.category, gift.quality).buyPrice;
  const ratio = value / GIFT_WEIGHT.baseline[station]();
  return GIFT_WEIGHT.bands.findLast((band) => ratio >= band.ratio);
}

// 人物偏好：按称谓/简介猜他偏爱哪类物件。回礼时对方对白会自然带出，
// 送中类别好感加上沿（见 settle/softRules.js gift.deltas）。
// 顺序有讲究：先看职业（猎户/掌柜/厨娘……），后看称谓——「大娘」「姑娘」
// 这类泛称谓排最后，否则厨娘出身的大娘会被当成爱首饰。
const GIFT_PREFER = [
  [/猎户|镖师|武师|侠客|剑客|刀客|侍卫|山贼|头目|寨主|捕快|兵/, "weapon"],
  [/僧|喇嘛|和尚|庙祝|道士|法师/, "accessory"],
  [/掌柜|老板|账房|商人|伙计/, "misc"],
  [/厨|饭馆|面档/, "misc"],
  [/书生|先生|学者|大夫|医师|药师/, "misc"],
  [/姑娘|小姐|闺女|女儿|婶|大娘|老板娘|姐/, "accessory"],
];

export function giftPreference(npc) {
  const text = [npc?.title, npc?.brief, npc?.name].filter(Boolean).join(" ");
  for (const [re, cat] of GIFT_PREFER) if (re.test(text)) return cat;
  return null;
}

export function giftPreferenceLabel(npc) {
  const cat = giftPreference(npc);
  return cat ? CATEGORY_LABEL[cat] : null;
}
