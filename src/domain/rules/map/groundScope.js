// 地上物品的内外层归属。
//
// room.items 挂在外层据点上，一个据点的所有内层房间共用这一份数组。房间级地上物
// （GROUND_ITEMS_INNER）注入时没有记下自己在哪间房，一旦刷出来，就在整个据点的
// 每一间房里都「在」：顶峰·雪山崖底的霜天月，站在峰道入口也看得到、捡得到；AI
// 在藏经阁写叙事，拿到的地上物品清单是山门的。
//
// 这里给每件地上物品记一个 innerRoom 归属，规则与 NPC 的可见性一致
// （见 isNpcVisibleInInnerRoom）：
//   1. 物品带 innerRoom → 只在那间房里。
//   2. 物品不带 innerRoom（旧存档、外层写入、任务采集物）→ 归锚点房间。
//   3. 据点没有内层地图，或玩家不在任何内层房间 → 不过滤。
// 读地上物品一律经过 getGroundItems；往地上放东西一律经过 tagGroundItem /
// placeGroundItems / mergeGroundItems；从地上拿东西一律经过 removeGroundItems。

import { getDistrictAnchor, hasInnerMap } from "./innerMap.js";

export const groundItemName = (item) => (typeof item === "string" ? item : item?.name);

export function isGroundItemHere(districtName, innerRoomName, item) {
  if (!hasInnerMap(districtName) || !innerRoomName) return true;
  const home = typeof item === "object" && item ? item.innerRoom : null;
  if (home) return home === innerRoomName;
  return innerRoomName === getDistrictAnchor(districtName);
}

// 当前所在房间看得到的地上物品。
export function getGroundItems({ room, innerRoomName } = {}) {
  return (room?.items || []).filter((item) => isGroundItemHere(room?.name, innerRoomName, item));
}

// 给物品打上当前房间的归属；字符串物品转成对象，名字兼作 id。
export function tagGroundItem(item, districtName, innerRoomName) {
  const base = typeof item === "string" ? { name: item, id: item } : { ...item };
  if (!hasInnerMap(districtName) || !innerRoomName) return base;
  return { ...base, innerRoom: innerRoomName };
}

// 往当前房间的地上放东西。
export function placeGroundItems(items, newItems, districtName, innerRoomName) {
  return [...(items || []), ...(newItems || []).map((item) => tagGroundItem(item, districtName, innerRoomName))];
}

// 从当前房间的地上拿走东西：每个名字只拿本房间看得到的一件，别的房间同名的东西不动。
export function removeGroundItems(items, names, districtName, innerRoomName) {
  const wanted = [...(names || [])];
  return (items || []).filter((item) => {
    if (!isGroundItemHere(districtName, innerRoomName, item)) return true;
    const index = wanted.indexOf(groundItemName(item));
    if (index === -1) return true;
    wanted.splice(index, 1);
    return false;
  });
}

// AI 报回的地上物品名单只代表它此刻所在的这间房：别的房间的东西原样保留，
// 本房间的东西以 AI 名单为准。已有物件按名字沿用原对象（保住 id、品质、归属）。
export function mergeGroundItems(prevItems, reportedItems, districtName, innerRoomName) {
  const prev = prevItems || [];
  if (!Array.isArray(reportedItems)) return prev;
  const elsewhere = prev.filter((item) => !isGroundItemHere(districtName, innerRoomName, item));
  const here = prev.filter((item) => isGroundItemHere(districtName, innerRoomName, item));
  const merged = reportedItems.map((item) => {
    const existing = here.find((old) => groundItemName(old) === groundItemName(item));
    return existing || tagGroundItem(item, districtName, innerRoomName);
  });
  return [...elsewhere, ...merged];
}
