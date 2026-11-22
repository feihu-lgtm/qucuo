// 任务数据里的地点（stage.at、collect.at）一律写到内层房间：「据点·内层房间」。
// 例：「白塔·白塔地宫」「鱼定土司·库房」。没有内层地图的据点只写据点名。
//
// 此前地点写法混用：有的只写据点（「白塔」「黑风寨」），有的只写内层房间名
//（「贡措海密室」「狼曲河谷」）。只写内层名的永远等不到 stage.at === room.name，
// 没有发布人的这类阶段在任务面板里根本不出现；只写据点的，采集物不知道该放在
// 哪间房，只能堆在锚点。
//
// 内层房间名本身可能带「·」（如「村口·广场」），所以只按第一个「·」切，
// 且前半必须是已登记的据点。

import { QUCUO_MAP } from "../../data/map/qucuoMap.js";
import { getInnerRoom, hasInnerMap } from "../map/innerMap.js";

export function parseQuestPlace(at) {
  const text = String(at || "").trim();
  if (!text) return null;
  const cut = text.indexOf("·");
  if (cut > 0) {
    const district = text.slice(0, cut);
    if (QUCUO_MAP[district] || hasInnerMap(district)) return { district, inner: text.slice(cut + 1) };
  }
  return { district: text, inner: null };
}

export function questPlaceDistrict(at) {
  return parseQuestPlace(at)?.district || null;
}

// 玩家此刻是否站在这个任务地点：据点相同；地点写了内层房间且据点有内层地图时，内层房间也要相同。
export function isAtQuestPlace(at, roomName, innerRoomName) {
  const place = parseQuestPlace(at);
  if (!place || place.district !== roomName) return false;
  if (!place.inner || !hasInnerMap(place.district)) return true;
  return place.inner === innerRoomName;
}

// 数据校验用：地点是否写到了内层（据点有内层地图时必须写内层，且房间真实存在）。
export function questPlaceProblem(at) {
  const place = parseQuestPlace(at);
  if (!place) return "地点为空";
  if (!QUCUO_MAP[place.district]) return `据点「${place.district}」不在大地图上`;
  if (!hasInnerMap(place.district)) return place.inner ? `据点「${place.district}」没有内层地图，不该写内层` : null;
  if (!place.inner) return `据点「${place.district}」有内层地图，地点必须写到内层房间`;
  if (!getInnerRoom(place.district, place.inner)) return `「${place.district}」里没有内层房间「${place.inner}」`;
  return null;
}
