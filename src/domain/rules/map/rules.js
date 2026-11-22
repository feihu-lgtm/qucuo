import { makeItem } from "../economy/equipment.js";
import { GROUND_ITEMS_INNER } from "../map/groundItems.js";
import { makeItemSmart } from "../../data/items/catalog.js";

const makeGameItem = (spec) => makeItemSmart(spec, makeItem);
const itemKey = (item) => typeof item === "string" ? item : item.name;
const matches = (item, spec) => spec.id ? item?.id === spec.id : itemKey(item) === spec.name;

export const innerGroundItemsRule = {
  id: "map.inner-ground-items",
  deps: (state) => [state.room?.name, state.innerRoomName, state.inv],
  run(state) {
    if (!state.room?.name) return null;
    const innerKey = state.innerRoomName ? `${state.room.name}·${state.innerRoomName}` : null;
    const specs = innerKey ? GROUND_ITEMS_INNER[innerKey] || [] : [];
    if (!specs.length) return null;

    const items = specs
      .filter((spec) => !(state.room.items || []).some((item) => matches(item, spec))
        && !(state.inv || []).some((item) => matches(item, spec)))
      .map((spec) => ({ spec, item: spec.id ? { ...makeGameItem(spec), id: spec.id } : makeGameItem(spec) }));
    if (!items.length) return null;

    return {
      changes: {
        room: (previous) => {
          const currentItems = previous.items || [];
          const toAdd = items.filter(({ spec }) => !currentItems.some((entry) => matches(entry, spec))).map(({ item }) => item);
          return toAdd.length ? { ...previous, items: [...currentItems, ...toAdd] } : previous;
        },
      },
    };
  },
};
