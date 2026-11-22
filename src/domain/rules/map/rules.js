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
    const district = state.room.name;
    // 旧存档迁移：此前注入的房间级地上物没记归属，按登记表认回它本来的房间。
    const homeByName = new Map();
    for (const [key, list] of Object.entries(GROUND_ITEMS_INNER)) {
      const [d, inner] = key.split("·");
      if (d === district && inner) for (const spec of list) homeByName.set(spec.name, inner);
    }
    const needsRetag = (state.room.items || []).some((item) => (
      typeof item === "object" && item && !item.innerRoom && homeByName.has(item.name)
    ));
    const retag = (items) => items.map((item) => (
      typeof item === "object" && item && !item.innerRoom && homeByName.has(item.name)
        ? { ...item, innerRoom: homeByName.get(item.name) } : item
    ));
    const innerKey = state.innerRoomName ? `${district}·${state.innerRoomName}` : null;
    const specs = innerKey ? GROUND_ITEMS_INNER[innerKey] || [] : [];
    if (!specs.length) {
      return needsRetag ? { changes: { room: (previous) => ({ ...previous, items: retag(previous.items || []) }) } } : null;
    }

    const items = specs
      .filter((spec) => !(state.room.items || []).some((item) => matches(item, spec))
        && !(state.inv || []).some((item) => matches(item, spec)))
      .map((spec) => ({ spec, item: { ...(spec.id ? { ...makeGameItem(spec), id: spec.id } : makeGameItem(spec)), innerRoom: state.innerRoomName } }));
    if (!items.length && !needsRetag) return null;

    return {
      changes: {
        room: (previous) => {
          const currentItems = retag(previous.items || []);
          const toAdd = items.filter(({ spec }) => !currentItems.some((entry) => matches(entry, spec))).map(({ item }) => item);
          return (toAdd.length || needsRetag) ? { ...previous, items: [...currentItems, ...toAdd] } : previous;
        },
      },
    };
  },
};
