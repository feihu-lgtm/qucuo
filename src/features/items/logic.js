import { effectiveMaxHp } from "../../domain/kungfu/qucuoKungfu.js";
import { CATALOG_INDEX, useConsumable as resolveConsumable } from "../../domain/items/catalog.js";
import { tallyAdd } from "../memory/logic.js";
import { makeBuffFlag, mergeCombatBuff } from "../../utils/buffSystem.js";

function itemNameOf(item) {
  return typeof item === "object" ? item?.name : item;
}

export function consumeItem(state, item) {
  const itemName = itemNameOf(item);
  const consumable = (typeof item === "object" && item?.consumable)
    || CATALOG_INDEX[itemName]?.consumable
    || null;
  if (!consumable) return { logs: [{ t: "sys", text: `  ${itemName}并非可服用之物。` }] };

  const result = resolveConsumable(consumable, state.char);
  if (!result.ok) return { logs: [{ t: "sys", text: `  ${result.reason}` }] };

  const changes = {};
  if (result.hpDelta || result.combatBuff) {
    changes.char = (previous) => {
      let next = previous;
      if (result.hpDelta) {
        next = {
          ...next,
          hp: [
            Math.min(effectiveMaxHp(next.hp[1], state.skills), next.hp[0] + result.hpDelta),
            next.hp[1],
          ],
        };
      }
      if (result.combatBuff) {
        next = {
          ...next,
          pendingCombatBuff: mergeCombatBuff(next.pendingCombatBuff, result.combatBuff),
        };
      }
      return next;
    };
  }
  if (result.sixDimBuffs?.length) {
    const flags = result.sixDimBuffs.map((buff) => makeBuffFlag(buff.attr, buff.val, state.time, buff.duration));
    changes.flags = (previous) => [...(previous || []), ...flags];
  }
  changes.inv = (previous) => {
    const next = [...previous];
    const index = next.findIndex((entry) => itemNameOf(entry) === itemName);
    if (index !== -1) next.splice(index, 1);
    return next;
  };
  changes.time = (time) => time + 1;
  return { changes, logs: [{ t: "item", text: `  ⊙ ${result.note}` }] };
}

export function pickGroundItem(state, item, { tallyTime = state.time } = {}) {
  const itemName = itemNameOf(item);
  return {
    changes: {
      varTree: (previous) => {
        const next = JSON.parse(JSON.stringify(previous || {}));
        if (!next.世界) next.世界 = { 威望: 0 };
        next.世界.起居注 = tallyAdd(next.世界.起居注, "pickGround", tallyTime);
        return next;
      },
      inv: (previous) => [...previous, item],
      room: (previous) => {
        const items = [...(previous.items || [])];
        let index = items.findIndex((entry) => (
          typeof item === "object" && item.id != null
            ? typeof entry === "object" && entry.id === item.id
            : entry === item
        ));
        if (index === -1) index = items.findIndex((entry) => itemNameOf(entry) === itemName);
        if (index !== -1) items.splice(index, 1);
        return { ...previous, items };
      },
      time: (time) => time + 1,
    },
    logs: [{ t: "item", text: `  ✓ 你拾起「${itemName}」，收入囊中。` }],
  };
}
