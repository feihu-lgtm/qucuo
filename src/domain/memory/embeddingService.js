// 向量嵌入服务
// ------------------------------------------------------------------
// 把一段文本变成一个向量（Float32Array），供 recallEngine 做余弦相似度召回。
// 默认对接 SiliconFlow 的 BAAI/bge-m3（OpenAI 兼容的 /embeddings 接口格式），
// 但只要是同一种请求/响应结构的服务都能用，endpoint/model 都在设置面板里填。
//
// 三条硬原则：
//   1. 降级优先——没开开关、没填 key、或调用失败，一律返回 null，绝不抛错阻断游戏主流程。
//   2. 多 Key 轮询——embeddingKey 支持用逗号/换行分隔多个 key，轮流用，摊平限流。
//   3. 指纹校验——换了 embedding 模型，旧向量维度/语义空间不兼容，靠 fingerprint 标记，
//      召回时对不上就跳过那条旧记忆，而不是拿错误向量去算相似度（见 recallEngine）。

// SiliconFlow 默认地址（用户不填 endpoint 时兜底）
const DEFAULT_ENDPOINT = "https://api.siliconflow.cn/v1/embeddings";

// 多 Key 轮询的游标（模块级，跨调用累加）
let keyCursor = 0;

function pickKey(rawKey) {
  const keys = String(rawKey || "")
    .split(/[\s,]+/)
    .map(k => k.trim())
    .filter(Boolean);
  if (!keys.length) return "";
  const k = keys[keyCursor % keys.length];
  keyCursor++;
  return k;
}

// 当前 embedding 配置的指纹。模型名不同 → 向量不可混用。
// 存记忆时记下这个指纹，召回时只用指纹一致的记忆。
export function embeddingFingerprint(cfg) {
  return `${cfg.embeddingModel || "unknown"}`;
}

// 是否满足最低启用条件（开关开 + 有 endpoint 能推断 + 有 key + 有 model）
export function embeddingReady(cfg) {
  if (!cfg || !cfg.embeddingEnabled) return false;
  const hasKey = String(cfg.embeddingKey || "").trim().length > 0;
  const hasModel = String(cfg.embeddingModel || "").trim().length > 0;
  return hasKey && hasModel;
}

// 取单段文本的向量。成功返回 Float32Array，任何异常/未就绪返回 null（降级）。
export async function getEmbedding(cfg, text) {
  if (!embeddingReady(cfg)) return null;
  const clean = String(text || "").trim();
  if (!clean) return null;

  const endpoint = cfg.embeddingEndpoint?.trim() || DEFAULT_ENDPOINT;
  const key = pickKey(cfg.embeddingKey);
  if (!key) return null;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: cfg.embeddingModel,
        input: clean,
        encoding_format: "float",
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "embedding 接口返回错误");
    const vec = data?.data?.[0]?.embedding;
    if (!Array.isArray(vec) || !vec.length) throw new Error("embedding 响应结构异常");
    return Float32Array.from(vec);
  } catch (err) {
    // 降级：单次 embedding 失败不应影响这一轮游戏，静默返回 null，
    // 由上层（recallWithVisibility / 记忆写入）决定跳过召回或跳过入库。
    console.warn("[embedding] 取向量失败，本次降级跳过：", err.message || err);
    return null;
  }
}

// 批量取向量（入库补算历史记忆时可能用到）。逐条串行，避免瞬时并发打爆限流。
export async function getEmbeddingsBatch(cfg, texts) {
  const out = [];
  for (const t of texts) {
    out.push(await getEmbedding(cfg, t));
  }
  return out;
}
