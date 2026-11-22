import { makeItem } from "../economy/equipment.js";
import { GROUND_ITEMS_INNER } from "../map/groundItems.js";
import { makeItemSmart } from "../../data/items/catalog.js";

const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

export const innerGroundItemsRule = {
  id: "map.inner-ground-items",
  deps: (state) => [state.room?.name, state.innerRoomName, state.inv],
  run(state) {
    if (!state.room?.name) return null;
    const innerKey = state.innerRoomName ? `${state.room.name}·${state.innerRoomName}` : null;
    const specs = innerKey ? GROUND_ITEMS_INNER[innerKey] || [] : [];
    if (!specs.length) return null;

    const haveGround = new Set((state.room.items || [])
      .map((item) => (typeof item === "string" ? item : item.name)));
    const haveInventory = new Set((state.inv || [])
      .map((item) => (typeof item === "string" ? item : item.name)));
    const items = specs
      .filter((spec) => !haveGround.has(spec.name) && !haveInventory.has(spec.name))
      .map((spec) => makeGameItem(spec));
    if (!items.length) return null;

    return {
      changes: {
        room: (previous) => {
          const currentItems = previous.items || [];
          const names = new Set(currentItems
            .map((item) => (typeof item === "string" ? item : item.name)));
          const toAdd = items.filter((item) => !names.has(item.name));
          return toAdd.length ? { ...previous, items: [...currentItems, ...toAdd] } : previous;
        },
      },
    };
  },
};
