import { DIRS } from "../../utils/mudHelpers.js";
import { getDistrictAnchor, visibleInnerExits } from "./innerMap.js";

export function blockedNoticeText(dir, exitsObj) {
  const exits = Object.keys(exitsObj || {}).map(exitDir => DIRS[exitDir] || exitDir);
  return [`此路不通 · 往${DIRS[dir] || dir}没有路`, exits.length ? `可走：${exits.join("、")}` : ""]
    .filter(Boolean).join("\n");
}

export function innerBlockedNoticeText(dir, districtName, roomName, options) {
  return blockedNoticeText(dir, visibleInnerExits(districtName, roomName || getDistrictAnchor(districtName), options));
}
