// WO-10 原型创招器：把判官签发的 BESTOW_SKILL 天机券编译成真实可上阵的武学。
// 命中 SKILL_CATALOG 出真品；自创招式按 moveArchetypes 九大原型派生完整 move。
// 全程纯函数，禁 Date.now/Math.random。
import { SKILL_CATALOG, makeSkillEntry, makeLearnedMoveSkill, SKILL_TYPE } from "../../data/kungfu/qucuoKungfu.js";
import { MOVE_ARCHETYPES, resolveArchetype } from "../combat/moveArchetypes.js";
import { QUALITY } from "../economy/equipment.js";

// 内功/轻功 passiveBonus 品阶表：参照 catalog 既有武学的中位口径
// （maxHp 白8/绿12/蓝18/紫28/橙40/红60；speedBonus 绿1/蓝1/紫2/橙2/红3）
const MAXHP_BY_QUALITY = { 白: 8, 绿: 12, 蓝: 18, 紫: 28, 橙: 40, 红: 60 };
const SPEED_BY_QUALITY = { 白: 0, 绿: 1, 蓝: 1, 紫: 2, 橙: 2, 红: 3 };

function qualityCap(q) {
  const i = QUALITY.indexOf(q);
  return i === -1 ? 0 : i;
}

function findCatalogSkill(name) {
  if (!name) return null;
  for (const list of Object.values(SKILL_CATALOG)) {
    if (!Array.isArray(list)) continue;
    const hit = list.find((s) => s.name === name);
    if (hit) return hit;
  }
  return null;
}

// warrant: { warrantId, factId, op:"BESTOW_SKILL", quality, growthMode, origin }
//   growthMode "独门" → 完整版（makeLearnedMoveSkill）；其余/缺省 → 成长型（stage 入门, upgradable）
// sealFill: { name, archetype?, skillType?, desc }
//   skillType "内功"/"轻功" → 按品阶表赋 passiveBonus，不走招式原型
// 返回 skill 记录；入参残缺返回 null。
export function compileEmergentSkill(warrant, sealFill) {
  if (!warrant || !sealFill || !sealFill.name) return null;
  const quality = warrant.quality || "白";

  // 图鉴命中：出真品目录武学（数值以 catalog 为准，与铸物同一条原则）
  const catalogHit = findCatalogSkill(sealFill.name);
  if (catalogHit) {
    const entry = makeSkillEntry(catalogHit);
    entry.provenance = { ...(warrant.origin || {}), factId: warrant.factId || "" };
    return entry;
  }

  const skillType = sealFill.skillType;
  // ── 内功/轻功：无招式本体，按品阶表赋被动加成 ──
  if (skillType === SKILL_TYPE.NEIGONG || skillType === SKILL_TYPE.QINGGONG || skillType === "内功" || skillType === "轻功") {
    const passiveBonus = {};
    if (skillType === "内功" || skillType === SKILL_TYPE.NEIGONG) {
      passiveBonus.maxHp = MAXHP_BY_QUALITY[quality] ?? 8;
    } else {
      passiveBonus.speedBonus = SPEED_BY_QUALITY[quality] ?? 1;
    }
    return {
      id: `kf_emg_${sealFill.name}`,
      name: sealFill.name,
      type: skillType === SKILL_TYPE.NEIGONG ? SKILL_TYPE.NEIGONG : skillType === SKILL_TYPE.QINGGONG ? SKILL_TYPE.QINGGONG : skillType,
      quality,
      level: 1, exp: 0, maxExp: 100,
      stage: "入门",
      active: false,
      passiveBonus,
      source: "奇遇",
      upgradable: true,
      desc: sealFill.desc || "",
      provenance: { ...(warrant.origin || {}), factId: warrant.factId || "" },
    };
  }

  // ── 招式：原型派生。archetype 不在九大原型内默认回退「硬攻」（手册锁死）──
  const archetype = MOVE_ARCHETYPES[sealFill.archetype] ? sealFill.archetype : "硬攻";
  const cap = qualityCap(quality);
  const effects = resolveArchetype(archetype, cap);
  const move = {
    id: `mv_emg_${sealFill.name}`,
    name: sealFill.name,
    quality,
    archetype,
    desc: sealFill.desc || "",
    ...effects,
  };

  if (warrant.growthMode === "独门") {
    const learned = makeLearnedMoveSkill({ ...move, type: effects.type, sourceSkill: sealFill.name }, "奇遇");
    learned.provenance = { ...(warrant.origin || {}), factId: warrant.factId || "" };
    return learned;
  }

  // 成长型功法：入门起步、可用潜能升阶（T2/T3 大奇遇产物，升阶结算在后续工单）
  return {
    id: `kf_emg_${sealFill.name}`,
    name: sealFill.name,
    type: SKILL_TYPE.MOVE,
    moveType: effects.type,
    quality,
    level: 1, exp: 0, maxExp: 100,
    stage: "入门",
    upgradable: true,
    active: false,
    archetype,
    source: "奇遇",
    move: { ...move, sourceSkill: sealFill.name },
    desc: sealFill.desc || "",
    provenance: { ...(warrant.origin || {}), factId: warrant.factId || "" },
  };
}
