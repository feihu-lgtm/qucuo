// 已入册角色 · 落脚方式与在场判定（从 importedRegistry.js 拆出）
// ============================================================================
import { _reg } from "./importedStore.js";

// ── 落脚方式 ────────────────────────────────────────────────────────────────
// 三种，对应本作已有的三套机制：
//   mention  只在人设层存在。被提到时注入设定，但不会主动出现在任何据点。
//            适合"远方的人""传闻里的人"。这是默认值——导入一张卡不该擅自
//            改变世界上有谁在哪。
//   resident 驻场。进了指定据点必定在场，不受权重与时段影响，等同
//            residentNpcs.js 的语义。可再锁一个内层房间（走 lockInnerRoom）。
//   wander   游走。按 routineWeights 权重 + timeSlot 时段随机出现，等同
//            npcPool.js 的语义。内层落点由 MudRPG 现有的 seededRand 逻辑分配。
export const PLACEMENT_MODES = ["mention", "resident", "wander"];

export function normalizePlacement(p) {
  const mode = PLACEMENT_MODES.includes(p?.mode) ? p.mode : "mention";
  const out = { mode, district: null, innerRoom: null, weights: {}, timeSlot: [0, 23] };
  if (mode === "resident") {
    out.district = p?.district || null;
    out.innerRoom = p?.innerRoom || null;
    if (!out.district) out.mode = "mention";   // 没选据点的驻场是无效配置，退回不落地
  } else if (mode === "wander") {
    const w = {};
    for (const [k, v] of Object.entries(p?.weights || {})) {
      const n = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
      if (n > 0) w[k] = n;
    }
    out.weights = w;
    const lo = Math.max(0, Math.min(23, Math.round(Number(p?.timeSlot?.[0]) || 0)));
    const hi = Math.max(0, Math.min(23, Math.round(Number(p?.timeSlot?.[1] ?? 23))));
    out.timeSlot = lo <= hi ? [lo, hi] : [hi, lo];
    if (!Object.keys(w).length) out.mode = "mention";   // 没给任何据点权重同理
  }
  return out;
}

/**
 * 某据点此刻该出现哪些入册角色。返回的是 pool-like 形状，调用方再过
 * toRoomNpcWithCombat 转成 room.npcs 条目。
 * @param {string} district 据点名
 * @param {number} time 全局回合数（MudRPG 的 time），内部换算成 0-23 小时
 * @param {number} dayIdx 天序，用于游走判定的稳定随机
 */
export function getImportedForDistrict(district, time = 0, rand = null) {
  if (!district) return [];
  const hour = ((time % 24) + 24) % 24;
  const out = [];
  for (const c of _reg().chars) {
    const pl = c.placement || { mode: "mention" };
    if (pl.mode === "resident") {
      if (pl.district !== district) continue;
      out.push(toPoolLike(c, pl.innerRoom));
    } else if (pl.mode === "wander") {
      const w = pl.weights?.[district] || 0;
      if (w <= 0) continue;
      const [lo, hi] = pl.timeSlot || [0, 23];
      if (hour < lo || hour > hi) continue;
      // 权重当出现概率用（0-100）。传了 rand 就用调用方的稳定随机源（同一天
      // 落点不跳），没传退化到 Math.random——只在预览类场景发生。
      const r = typeof rand === "function" ? rand(c.name) : Math.random();
      if (r * 100 > w) continue;
      out.push(toPoolLike(c, null));
    }
  }
  return out;
}

/**
 * carry 归一。这一步不能省——applyNpcDefaults 里是
 *   npc.carry.map(c => makeGameItem({ name: c.name, category: c.category, quality: c.quality }))
 * 它读的是**对象的字段**，而入册界面挑物品时存的是名字字符串数组。直接传过去
 * 的话 c.name 是 undefined，玩家精心挑的那把刀会变成一件无名杂物（只在"挑了
 * 东西"时触发，挑空反而正常——空数组不传，走四池随机）。
 *
 * carry 的元素允许两种形态：
 *   "霜牙"                        在册物品，只存名字。makeItemSmart 会按名字查
 *                                 CATALOG 把数值词条全补上，绿档霜牙不会被说成红档。
 *   { name, category, quality,    自造物品，CATALOG 里查不到，makeItemSmart 会退到
 *     desc, sixDim, effect }      makeItem(spec) 用这里传的字段建。
 */
function normalizeCarry(list) {
  const out = [];
  for (const c of list) {
    if (typeof c === "string") {
      const n = c.trim();
      if (n) out.push({ name: n });          // 只给名字，其余交给 catalog 补全
      continue;
    }
    if (c && typeof c === "object" && c.name) {
      out.push({
        name: String(c.name).slice(0, 20),
        category: c.category || "misc",
        quality: c.quality || "白",
        ...(c.desc ? { desc: String(c.desc).slice(0, 200) } : {}),
        ...(c.sixDim && Object.keys(c.sixDim).length ? { sixDim: { ...c.sixDim } } : {}),
        ...(c.effect ? { effect: { ...c.effect } } : {}),
        ...(Number.isFinite(c.atkMul) ? { atkMul: c.atkMul } : {}),
        ...(Number.isFinite(c.defMul) ? { defMul: c.defMul } : {}),
      });
    }
  }
  return out;
}

// 转成 npcPool 条目的形状。字段名必须与 toRoomNpcWithCombat 的白名单对得上，
// 否则 levelCap / personality / lockInnerRoom 会在转换中被剥掉。
export function toPoolLike(c, lockInnerRoom) {
  const o = {
    id: `imported_${c.name}`,
    name: c.name,
    brief: c.brief || c.name,
    personality: [c.attitude, c.appearance].filter(Boolean).join("；") || "",
    levelCap: c.levelCap ?? 1,
    // 空对象会顶掉 applyNpcDefaults 的随机七维（`npc.special || generate…`
    // 对 {} 判真），所以没配过就干脆不带这个字段
    special: (c.special && Object.keys(c.special).length) ? c.special : undefined,
    affectionable: true,
    imported: true,
  };
  // 内外功要带上：applyNpcDefaults 里气血走 hpFromNeigong(neigong, 体魄)、
  // 攻击走 atkFromWaigong(waigong)，不传就只能按品阶取默认值，玩家调的白调。
  if (Number.isFinite(c.neigong)) o.neigong = c.neigong;
  if (Number.isFinite(c.waigong)) o.waigong = c.waigong;
  if (Array.isArray(c.carry) && c.carry.length) o.carry = normalizeCarry(c.carry);
  if (c.portrait) o.portrait = c.portrait;
  if (lockInnerRoom) o.lockInnerRoom = lockInnerRoom;
  return o;
}

/**
 * 入册的驻场角色名单。供 commitRound 的"幽灵过滤"使用——驻场者有固定归属，
 * 不该被 AI 在别的据点凭空刷出来，跟 getAllResidentNpcNames() 同一个用途。
 */
export function getImportedResidentNames() {
  return _reg().chars
    .filter(c => c.placement?.mode === "resident")
    .map(c => c.name);
}
