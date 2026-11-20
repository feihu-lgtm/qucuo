import { innerBlockedNoticeText, blockedNoticeText, passableExits } from "../../domain/map/blockedNotice.js";
import { QUCUO_MAP } from "../../domain/map/qucuoMap.js";
import { showNotice } from "../../store/uiStore.js";

export function showOuterNoExitNotice(outerLock, dir, roomName, options) {
  if (outerLock.noExit) {
    const exits = passableExits(QUCUO_MAP[roomName]?.exits, { ...options, layer: "outer" });
    showNotice(blockedNoticeText(dir, exits));
  }
}

export function resolveInnerBlockedSummary(innerResult, dir, districtName, roomName, options) {
  const blockedText = innerResult.logs?.find(entry => entry.t === "sys")?.text || "";
  if (!blockedText.includes("内里这个方向没有去处")) return "门锁着";
  showNotice(innerBlockedNoticeText(dir, districtName, roomName, options));
  return "内层此路不通";
}
