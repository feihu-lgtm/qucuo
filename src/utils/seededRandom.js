// 日期种子随机数：给定 dayIdx + 地点名，生成当天稳定的伪随机序列
// 同一天同一地点每次调用 getScheduledNpcs 都得到完全一样的 NPC 列表

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (Math.imul(h, 0x01000193)) >>> 0;
  }
  return h;
}

export function seededRand(dayIdx, locationName) {
  const seed = (dayIdx * 1000003 + hashString(locationName)) >>> 0;
  return mulberry32(seed);
}

// 加权随机采样（不重复），rng 是 seededRand 返回的函数
export function weightedSample(items, weightKey, count, rng) {
  const pool = items.map(item => ({ item, w: item[weightKey] || 0 })).filter(x => x.w > 0);
  const result = [];
  while (result.length < count && pool.length > 0) {
    const total = pool.reduce((s, x) => s + x.w, 0);
    if (total === 0) break;
    let r = rng() * total;
    let idx = 0;
    for (idx = 0; idx < pool.length; idx++) {
      r -= pool[idx].w;
      if (r <= 0) break;
    }
    idx = Math.min(idx, pool.length - 1);
    result.push(pool[idx].item);
    pool.splice(idx, 1);
  }
  return result;
}
