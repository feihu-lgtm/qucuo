import { add, applyWrite, set, updateField } from "../../domain/rules/state/applyWrite.js";
import { effectiveMaxHp } from "../../domain/data/kungfu/qucuoKungfu.js";
import { CATALOG_INDEX, useConsumable as resolveConsumable } from "../../domain/data/items/catalog.js";
import { tallyAdd } from "../../domain/rules/memory/tally.js";
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
    changes.char = updateField("char", (char) => {
      const writes = [];
      if (result.hpDelta) writes.push(set("char.hp", [
        Math.min(effectiveMaxHp(char.hp[1], state.skills), char.hp[0] + result.hpDelta), char.hp[1],
      ]));
      if (result.combatBuff) writes.push(set(
        "char.pendingCombatBuff", mergeCombatBuff(char.pendingCombatBuff, result.combatBuff),
      ));
      return writes;
    });
  }
  if (result.sixDimBuffs?.length) {
    const flags = result.sixDimBuffs.map((buff) => makeBuffFlag(buff.attr, buff.val, state.time, buff.duration));
    changes.flags = updateField("flags", (previous) => set("flags", [...(previous || []), ...flags]));
  }
  changes.inv = updateField("inv", (previous) => {
    const next = [...previous];
    const index = next.findIndex((entry) => itemNameOf(entry) === itemName);
    if (index !== -1) next.splice(index, 1);
    return set("inv", next);
  });
  changes.time = updateField("time", add("time", 1));
  return { changes, logs: [{ t: "item", text: `  ⊙ ${result.note}` }] };
}

export function pickGroundItem(state, item, { tallyTime = state.time } = {}) {
  const itemName = itemNameOf(item);
  const matches = (entry) => (
    typeof item === "object" && item?.id != null
      ? typeof entry === "object" && entry?.id === item.id
      : itemNameOf(entry) === itemName
  );
  const groundItem = (state.room.items || []).find(matches);
  if (groundItem === undefined) return {};
  return {
    changes: {
      varTree: (previous) => {
        const next = JSON.parse(JSON.stringify(previous || {}));
        if (!next.世界) next.世界 = { 威望: 0 };
        return applyWrite({ varTree: next }, set("世界.起居注", tallyAdd(next.世界.起居注, "pickGround", tallyTime))).state.varTree;
      },
      inv: updateField("inv", (previous) => set("inv", [...previous, groundItem])),
      room: (previous) => {
        const items = [...(previous.items || [])];
        const index = items.findIndex(matches);
        if (index !== -1) items.splice(index, 1);
        return { ...previous, items };
      },
      time: updateField("time", add("time", 1)),
    },
    logs: [{ t: "item", text: `  ✓ 你拾起「${itemName}」，收入囊中。` }],
  };
}
