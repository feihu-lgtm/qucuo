// 云端原文召回查询（infra 网络编排）——WO-20C
// ------------------------------------------------------------------
// 硬门（缺一即返 null 零网络）：
//   1. storageConfig.driver === "cloud"——local/file 绝不发网；
//   2. hubBinding 三件套完整（host/spaceId/hubToken）；
//   3. lineage 非空——无谱系绝不退 maxTurn 云查，宁可只用本地，防跨时间线串味。
// 降级：失败/超时/非 2xx/坏形状一律静默返 []，绝不阻断回合。
// 隐私口径：查询文本与明文段落会发往 hub——与上行同一致意（FTS 索引必需明文），
// 密钥/存档密文绝不混入本路径；绝不发送 embedding/queryEmbedding 字段。

import { hubBinding, hubQueryProse } from "./cloudProtocol.js";
import { loadStorageConfig } from "./storageConfig.js";

export const CLOUD_PROSE_TIMEOUT_MS = 1500;

// 云查询资格：driver cloud + 绑定完整 → binding；否则 null。
export function cloudProseQueryBinding(cfg = loadStorageConfig()) {
  if (cfg?.driver !== "cloud") return null;
  const binding = hubBinding(cfg);
  return binding?.bound ? binding : null;
}

// 查询云端段落 hits（原始形状，映射/合并交给 domain 纯函数）。
// 返回 [] 语义=「无云补」——可能是没资格、没命中、失败、超时，调用方无需区分。
export async function queryCloudProseHits({ query = "", viewer = "", lineage = null, currentTurn = null, topK = 5, timeoutMs = CLOUD_PROSE_TIMEOUT_MS, location = "" } = {}) {
  try {
    if (!Array.isArray(lineage) || !lineage.length) return []; // 谱系硬门
    const binding = cloudProseQueryBinding();
    if (!binding) return [];
    const race = new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), timeoutMs));
    const res = await Promise.race([
      hubQueryProse(binding, { query, viewer, location, lineage, currentTurn, topK }),
      race,
    ]);
    if (!res || res.timeout || !res.ok) return [];
    return Array.isArray(res.hits) ? res.hits : [];
  } catch (_) {
    return [];
  }
}
