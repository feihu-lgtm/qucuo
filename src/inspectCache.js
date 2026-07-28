// 查看内容缓存
// "查看武学"、"查看物品"这类操作，输出的说书人描述文本只取决于
// 这件东西本身（名字+品质+数值），跟当前时间、地点、剧情进度完全无关。
// 同一把"鱼定枪"不管在哪查看，描述应该是一回事——没必要每次都重新调用 LLM，
// 既浪费 token 也让玩家多等一次加载。

const CACHE_KEY = "wuxia_mud_inspect_cache";
const MAX_ENTRIES = 300; // 防止无限增长；玩家一局游戏里查看的武学/物品种类不会太多

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    // 存储满了或其他异常，缓存写入失败不影响主流程，静默跳过即可
    console.warn("查看缓存写入失败", e);
  }
}

// 缓存键只由"影响描述内容"的字段决定：kind、name、修炼进度/品质数值。
// 时间、地点、好感度等完全不参与——这是这个缓存能生效的前提假设，
// 如果以后某天需要让描述带上下文相关的味道（比如同一把剑在不同人手里描述不同），
// 这个假设就不成立了，届时应该关掉这个缓存而不是往键里硬塞更多字段。
function buildKey(kind, name, extra, itemObj) {
  const parts = [kind, name, extra || ""];
  if (itemObj && typeof itemObj === "object") {
    parts.push(itemObj.quality || "", itemObj.atk ?? "", itemObj.def ?? "");
  }
  return parts.join("::");
}

export function getCachedInspect(kind, name, extra, itemObj) {
  const cache = loadCache();
  const key = buildKey(kind, name, extra, itemObj);
  return cache[key] || null;
}

export function setCachedInspect(kind, name, extra, itemObj, text) {
  const cache = loadCache();
  const key = buildKey(kind, name, extra, itemObj);
  cache[key] = { text, cachedAt: Date.now() };

  // 超出上限时，丢弃最旧的条目（按 cachedAt 排序后砍掉前面一批）
  const keys = Object.keys(cache);
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys.sort((a, b) => cache[a].cachedAt - cache[b].cachedAt);
    const toDrop = sorted.slice(0, keys.length - MAX_ENTRIES);
    toDrop.forEach(k => delete cache[k]);
  }

  saveCache(cache);
}

export function clearInspectCache() {
  localStorage.removeItem(CACHE_KEY);
}

export function inspectCacheSize() {
  return Object.keys(loadCache()).length;
}
