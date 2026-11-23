// 已入册角色注册表
// ============================================================================
// 【为什么独立于存档】导入的角色卡是玩家的资产，不是某一局游戏的状态——跟
// presetSystem.js 里那个"独立于任何单个预设的全局片段库"同一个道理。存进存档
// 会有两个麻烦：读旧档时导入的人凭空消失，以及每个槽位各存一份同样的人设。
// 所以这里跟 saves.js 平行，走自己的 IndexedDB 库（与 scanStore 同库不同前缀）。
//
// 读取方向：
//   worldbook.js 的 npcLore        ← getImportedNpcLore()
//   characterMilestones.js         ← getImportedMilestones()
//   room.npcs 注入（品阶/六维/carry）← getImportedStats(name)
// 这三处都是"静态预设 + 导入追加"的合并关系，导入的排在后面，同名时以导入为准
// （玩家自己刚导的，意图比预设更明确）。

import { persist, _reg } from "./importedStore.js";
import { normalizePlacement, toPoolLike } from "./importedPlacement.js";

// 存储层与 pending 键的公开面原样中转，消费方 import 路径不用动。
export { subscribeImported, getImportedRevision, init } from "./importedStore.js";
export { PLACEMENT_MODES, normalizePlacement, getImportedForDistrict, getImportedResidentNames }
  from "./importedPlacement.js";
export { setPendingPlayerCard, getPendingPlayerCard, clearPendingPlayerCard,
         setPendingStarterCompanion, getPendingStarterCompanion, clearPendingStarterCompanion }
  from "./pendingCard.js";

/**
 * 落册。同名的覆盖旧的。
 * @param {Array} npcs cardScan 产出、玩家审改过的人物数组
 * @param {object} meta { cardName, fileName }
 */
export function registerImported(npcs, meta = {}) {
  if (!Array.isArray(npcs) || !npcs.length) return 0;
  const byName = new Map(_reg().chars.map(c => [c.name, c]));
  for (const n of npcs) {
    if (!n?.name) continue;
    byName.set(n.name, {
      name: n.name,
      aliases: Array.isArray(n.aliases) ? n.aliases : [],
      entry: n.entry || "",
      // 原卡正文一字不动地留着，只给审改界面对照用，不进任何 prompt。
      // 【为什么要留】entry 是 AI 重写过的凝练版（120 字、第三人称、剥掉小标题与
      // 占位符），玩家要判断它写得准不准，手边就得有原文。落册后再回看也一样。
      rawEntry: n.rawEntry || "",
      entryFromAi: !!n.entryFromAi,
      brief: n.brief || n.name,
      appearance: n.appearance || "",
      attitude: n.attitude || "",
      levelCap: Number.isFinite(n.levelCap) ? n.levelCap : 1,
      special: n.special || {},
      neigong: Number.isFinite(n.neigong) ? n.neigong : null,
      waigong: Number.isFinite(n.waigong) ? n.waigong : null,
      moves: (n.moves && typeof n.moves === "object") ? n.moves : null,
      carry: Array.isArray(n.carry) ? n.carry : [],
      portrait: n.portrait || "",
      affection: Number.isFinite(n.affection) ? n.affection : 0,
      milestones: Array.isArray(n.milestones) ? n.milestones : [],
      placement: normalizePlacement(n.placement),
      from: { cardName: meta.cardName || "", fileName: meta.fileName || "", at: Date.now() },
    });
  }
  _reg().chars = Array.from(byName.values());
  persist();
  return npcs.length;
}

/**
 * 入册的世界观条目（地理／势力／规矩／物件）。
 * 【为什么跟人物走同一条路】它们同样是"有关键词、被提到就注入"的条目，
 * matchNpcLore 的三源触发对它们一样适用。虽然那个函数叫 npcLore，机制其实是
 * 通用的关键词点灯，不必为地理另造一套。区别只在 entry 的写法上不带人名括号。
 */
export function registerImportedWorld(items, meta = {}) {
  if (!Array.isArray(items) || !items.length) return 0;
  const byLabel = new Map((_reg().world || []).map(w => [w.label, w]));
  for (const w of items) {
    if (!w?.label || !w?.content) continue;
    byLabel.set(w.label, {
      label: w.label,
      kind: w.kind || "unknown",
      keys: Array.isArray(w.keys) ? w.keys : [],
      content: w.content,
      from: { cardName: meta.cardName || "", at: Date.now() },
    });
  }
  _reg().world = Array.from(byLabel.values());
  persist();
  return items.length;
}

export function removeImported(name) {
  _reg().chars = _reg().chars.filter(c => c.name !== name);
  persist();
}

export function clearImported() {
  _reg().chars = [];
  persist();
}

/**
 * 供 worldbook.js 合并。返回的形状与 presets/qucuo.js 的 npcLore 完全一致：
 * { name, aliases, entry }。外貌锚点与初见态度拼进 entry 尾部，跟预设里
 * 那些手写条目的写法保持一致（预设里就是把外貌锚点写在人设正文里的）。
 */
export function getImportedNpcLore() {
  // isWorld 标记：这些条目走同一条关键词点灯的路（那个判断对地理一样适用），
  // 但**不能跟人物混在同一个注入块里**。buildNpcLoreBlock 给人物写的外壳是
  //「此刻在场人物设定（这些人真的站在这个场景里）」和「仅被提及、并不在场的
  // 人物设定（…绝不能让他们凭空出现、开口说话…）」——地理条目落进后者，说书人
  // 就会读到「锦官城 是一个被提及但不在场的人物，不能让他开口说话」。
  // 实测确认过这个输出。机制可以共用，外壳文案不能。
  const world = (_reg().world || []).map(w => ({
    name: w.label,
    aliases: w.keys.filter(k => k !== w.label),
    entry: `- ${w.label}：${w.content}`,
    isWorld: true,
  }));
  return [...world, ..._reg().chars.map(c => {
    const tail = [
      c.appearance ? `\n  外貌锚点：${c.appearance}` : "",
      c.attitude ? `\n  初见态度：${c.attitude}` : "",
    ].join("");
    return {
      name: c.name,
      aliases: c.aliases,
      entry: `- ${c.name}（${c.brief}）：${c.entry}${tail}`,
    };
  })];
}

/**
 * 供 characterMilestones.js 合并。返回 { 角色名: { 阈值: {title, brief} } }，
 * 与 CHARACTER_MILESTONES 的结构一致。
 */
export function getImportedMilestones() {
  const out = {};
  for (const c of _reg().chars) {
    if (!c.milestones?.length) continue;
    const m = {};
    for (const x of c.milestones) {
      if (!x?.threshold || !x.title) continue;
      // text 必须是数组：CharacterPage 里直接 .text.map()，undefined 会抛错
      m[x.threshold] = { title: x.title, brief: x.brief || "", text: Array.isArray(x.text) ? x.text : [] };
    }
    if (Object.keys(m).length) out[c.name] = m;
  }
  return out;
}

/**
 * 入册角色的专属出招表，形状与 npcSignatureMoves.js 的 NPC_SIGNATURE_MOVES 一致：
 *   { 角色名: { 攻击:{archetype,name,desc}, 防御:{...}, 状态:{...}, 回气:{...} } }
 * deriveSignatureMoveset 会拿它跟内置表合并。没配招式的角色不出现在这张表里，
 * 于是仍然回退到按品阶随机的老逻辑。
 */
export function getImportedSignatureMoves() {
  const out = {};
  for (const c of _reg().chars) {
    if (!c.moves || typeof c.moves !== "object") continue;
    const slots = {};
    for (const [slot, m] of Object.entries(c.moves)) {
      if (!m || (!m.name && !m.archetype)) continue;
      slots[slot] = {
        archetype: m.archetype,
        name: m.name || undefined,
        desc: m.desc || undefined,
        ...(m.effects && typeof m.effects === "object" ? { effects: m.effects } : {}),
      };
    }
    if (Object.keys(slots).length) out[c.name] = slots;
  }
  return out;
}

/** 供 room.npcs 强制注入时取数值（品阶/七维/一句话身份） */
export function getImportedStats(name) {
  const c = _reg().chars.find(x => x.name === name
    || (x.aliases || []).includes(name));
  if (!c) return null;
  return { name: c.name, levelCap: c.levelCap, special: c.special, brief: c.brief };
}

/**
 * 返回某入册角色档案；asPoolNpc=true 时返回 room.npcs hydration 使用的 NPC 池形状。
 */
export function getImportedNpc(name, { asPoolNpc = false } = {}) {
  const c = _reg().chars.find(x => x.name === name
    || (x.aliases || []).includes(name));
  if (!c) return null;
  if (asPoolNpc) return toPoolLike(c, c.placement?.mode === "resident" ? c.placement.innerRoom : null);
  return {
    name: c.name,
    aliases: c.aliases || [],
    brief: c.brief || c.name,
    levelCap: c.levelCap ?? 1,
    special: c.special || {},
    neigong: Number.isFinite(c.neigong) ? c.neigong : undefined,
    waigong: Number.isFinite(c.waigong) ? c.waigong : undefined,
    moves: c.moves || null,
    carry: c.carry || [],
    portrait: c.portrait || "",
    appearance: c.appearance || "",
    attitude: c.attitude || "",
    affection: c.affection || 0,
    entry: c.entry || "",
  };
}
