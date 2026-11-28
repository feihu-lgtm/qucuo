// 活世界扩展包注册聚合入口（WO-25C）。
// 当前为空注册表——曲措首批业务剧本数据归 WO-25G，本文件只做聚合接线。
// 用法：const registry = buildDefaultRegistry(); 之后交给 evalWorld/worldPulse 内核消费。
import { createLivingWorldRegistry, registerWorldPack, validateWorldPacks } from "../../rules/livingWorld/worldRegistry.js";

export function buildDefaultRegistry() {
  return createLivingWorldRegistry();
}

export { createLivingWorldRegistry, registerWorldPack, validateWorldPacks };
