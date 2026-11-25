// ── 判官共享 helper/常量（S4 纯搬家：原 judgeTurn.js 顶部原样移入，零行为变化）──

export const QUALITY_ORDER = ["白", "绿", "蓝", "紫", "橙", "红"];

// 性情对收拒的修正：冷傲难动、豪爽易热、精明看价、温善心软、暴烈吃软不吃硬。
const PERSONA_MOD = [
  [/冷傲|孤傲|清冷/, -0.15],
  [/豪爽|直率|爽朗|豪迈/, 0.15],
  [/精明|算计|市侩/, -0.05],
  [/温善|和善|仁慈|热心/, 0.1],
  [/暴烈|暴躁|烈性/, -0.1],
  [/狡猾|多疑|阴鸷/, -0.1],
];

export function personaMod(personality) {
  const text = String(personality || "");
  let mod = 0;
  for (const [re, m] of PERSONA_MOD) if (re.test(text)) mod += m;
  return mod;
}

export function affectionOf(varTree, npcName) {
  const v = varTree?.角色?.[npcName]?.好感度;
  return Number.isFinite(v) ? v : 0;
}

// 好感档位修正：过命 +0.25 / 亲近 +0.15 / 熟络 +0.05 / 芥蒂 -0.2
export function affectionMod(aff) {
  if (aff >= 80) return 0.25;
  if (aff >= 60) return 0.15;
  if (aff >= 40) return 0.05;
  if (aff <= 0) return -0.05;
  return 0;
}

// 搭话 stance → 好感增量（WO-16A）：覆盖 schema 全部 enum，未知/无法判断按 0。
// perfunctory=0 不产事实（空事实不进账本）；forceful 负数走负向社交。
export const TALK_STANCE_DELTA = { sincere: 2, clever: 1, casual: 1, perfunctory: 0, forceful: -1, hostile: -3 };

// fit 档位的过关门槛：越离谱越难成；气运（luck 0-10）每点降 3% 门槛。
export const FIT_GATE = { natural: 0.25, stretch: 0.55, absurd: 0.85 };

export function findNpc(npcs, name) {
  return (npcs || []).find((n) => n?.name === name) || null;
}

export function knowsEntry(entry, npcName) {
  const w = entry?.witnesses;
  if (!Array.isArray(w) || w.length === 0) return true;
  return w.includes("*") || w.includes(npcName);
}
