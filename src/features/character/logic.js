import { ITEM_CATEGORY, makeItem, QUALITY } from "../../domain/rules/economy/equipment.js";
import { makeItemSmart } from "../../domain/data/items/catalog.js";

const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

function cardCarryToInvItems(carry, seed = "") {
  const items = (carry || [])
    .map((item, index) => {
      const spec = typeof item === "string" ? { name: item } : item;
      const base = makeGameItem(spec);
      if (!base || !base.name) return null;
      return { ...base, id: `cardcarry_${seed}${index}`, equipped: false, stolen: false };
    })
    .filter(Boolean);
  for (const category of [ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY]) {
    const ofCategory = items.filter((item) => item.category === category);
    if (!ofCategory.length) continue;
    ofCategory.sort((a, b) => QUALITY.indexOf(b.quality) - QUALITY.indexOf(a.quality));
    ofCategory[0].equipped = true;
  }
  return items;
}

export function applyCharacterCard(state, fromCard, seed = "") {
  const changes = {};
  if (Array.isArray(fromCard?.skills) && fromCard.skills.length) {
    changes.skills = fromCard.skills.map((skill) => ({ ...skill }));
  }
  const cardItems = cardCarryToInvItems(fromCard?.carry, seed);
  if (cardItems.length) {
    const takenCategories = new Set(cardItems.filter((item) => item.equipped).map((item) => item.category));
    changes.inv = (previous) => [
      ...(previous || []).map((item) => (
        item && typeof item === "object" && item.equipped && takenCategories.has(item.category)
          ? { ...item, equipped: false }
          : item
      )),
      ...cardItems,
    ];
  }
  return { changes, carriedCount: cardItems.length };
}
