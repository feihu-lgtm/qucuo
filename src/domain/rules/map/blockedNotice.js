import { DIRS } from "../../../utils/mudHelpers.js";
import { getDistrictAnchor, getInnerRoom, isInnerExitUnlocked, visibleInnerExits } from "./innerMap.js";
import { isNodeUnlocked } from "../../data/map/qucuoMap.js";

export function passableExits(exitsObj, { layer, districtName, questProgress, flags, inv, char, varTree } = {}) {
  const completedQuests = new Set(Object.entries(questProgress || {})
    .filter(([, progress]) => progress?.status === "completed" || progress?.done)
    .map(([id]) => id));
  return Object.fromEntries(Object.entries(exitsObj || {}).filter(([, dest]) => {
    if (layer === "outer") return isNodeUnlocked(dest, { completedQuests, flags });
    if (layer === "inner") {
      const unlockCondition = getInnerRoom(districtName, dest)?.unlockCondition;
      return !unlockCondition || isInnerExitUnlocked(unlockCondition, { questProgress, flags, inv, char, varTree });
    }
    return true;
  }));
}

export function blockedNoticeText(dir, exitsObj) {
  const exits = Object.keys(exitsObj || {}).map(exitDir => DIRS[exitDir] || exitDir);
  return [`此路不通 · 往${DIRS[dir] || dir}没有路`, exits.length ? `可走：${exits.join("、")}` : ""]
    .filter(Boolean).join("\n");
}

export function innerBlockedNoticeText(dir, districtName, roomName, options) {
  const currentRoom = roomName || getDistrictAnchor(districtName);
  const exits = visibleInnerExits(districtName, currentRoom, options);
  return blockedNoticeText(dir, passableExits(exits, { ...options, layer: "inner", districtName }));
}
