// UI 组件判断设备的唯一入口：订阅视口变化，返回 { width, height, isMobile, isPortraitPhone }。
// 判断规则与断点在 utils/viewport.js。
import { useSyncExternalStore } from "react";
import { readViewport, subscribeViewport } from "../../utils/viewport.js";

const SERVER = { width: 0, height: 0, isMobile: false, isPortraitPhone: false };
let cache = SERVER;
let cacheKey = "";

function snapshot() {
  const v = readViewport();
  const key = `${v.width}x${v.height}`;
  if (key !== cacheKey) { cacheKey = key; cache = v; }
  return cache;
}

export function useViewport() {
  return useSyncExternalStore(subscribeViewport, snapshot, () => SERVER);
}
