// 活世界扩展包注册聚合入口（WO-25C）。
// 当前为空注册表——曲措首批业务剧本数据归 WO-25G，本文件只做聚合接线。
// 用法：const registry = buildDefaultRegistry(); 之后交给 evalWorld/worldPulse 内核消费。
import { createLivingWorldRegistry, registerWorldPack, validateWorldPacks } from "../../rules/livingWorld/worldRegistry.js";
import { qucuoCorePack } from "./qucuoCorePack.js";
import { snowlandSectsPack } from "./snowlandSectsPack.js";
import { bashuSectsPack } from "./bashuSectsPack.js";

// 默认注册表：曲措首批核心扩展包（WO-25G）+ 静态校验兜底。
// 校验失败抛错——数据包写错就该在启动时炸出来，不放进运行时祸害存档。
export function buildDefaultRegistry() {
  const registry = createLivingWorldRegistry();
  registerWorldPack(registry, qucuoCorePack);
  // WO-25L：雪域三宗 + 巴蜀门派两大片区扩展包——纯数据接入，evalWorld/worldPulse/projectWorld 零修改。
  registerWorldPack(registry, snowlandSectsPack);
  registerWorldPack(registry, bashuSectsPack);
  const errors = validateWorldPacks(registry);
  if (errors.length > 0) throw new Error(`活世界扩展包静态校验失败：${errors.join("；")}`);
  return registry;
}

export { createLivingWorldRegistry, registerWorldPack, validateWorldPacks };
