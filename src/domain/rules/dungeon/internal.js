// 地宫引擎内部共用件（不对外）：纯工具函数与通用构建器。

import { ensureNpcCombatData } from "../npc/npcGeneration.js";
import { random } from "../../../utils/rng.js";

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function pickRandom(list) {
  if (!Array.isArray(list) || !list.length) return null;
  return list[Math.floor(random() * list.length) % list.length];
}

export function normalizeHp(hp) {
  const max = Math.max(1, Number(hp?.[1]) || 100);
  const cur = clamp(Number(hp?.[0] ?? max) || 1, 1, max);
  return [cur, max];
}

export function floorInfo(cfg, floorNum) {
  return cfg.floors.find((f) => f.floor === floorNum) || cfg.floors[cfg.floors.length - 1];
}

export function mergeLoot(loot, delta = {}) {
  const items = [...loot.items];
  for (const item of delta.items || []) {
    // 物品对象带着品类/品阶/描述走全流程——拍扁成名字会让结算端把
    // 非名录装备（OC 私物等）统统材质化成白档杂物。
    if (typeof item === "string") { if (item) items.push(item); continue; }
    if (item?.name) {
      items.push({ name: item.name, category: item.category, quality: item.quality, desc: item.desc });
    }
  }
  return {
    money: loot.money + (delta.money || 0),
    exp: loot.exp + (delta.exp || 0),
    pot: loot.pot + (delta.pot || 0),
    items,
  };
}

export function buildCombatNpc(tpl, prefix) {
  return ensureNpcCombatData({
    id: `${prefix}_${tpl.id}`,
    name: tpl.name,
    role: tpl.role || tpl.title || "江湖旅人",
    region: tpl.region || "中原",
    levelCap: tpl.levelCap ?? 2,
    desc: tpl.desc || tpl.brief || "",
    personality: tpl.personality,
    carry: tpl.carry || [],
    ocAdventurer: tpl.ocAdventurer,
    npcRef: tpl.npcRef,
    rainbowStyle: tpl.rainbowStyle,
  }, { levelCap: tpl.levelCap ?? 2 });
}

// 七维检定成功率公式（纯函数，同时供 UI 展示预估概率）。
export function calcDungeonCheckRate(statValue, dc = 5) {
  const val = Number(statValue) || 5;
  return clamp(Math.round(35 + (val - dc) * 12), 15, 95);
}
