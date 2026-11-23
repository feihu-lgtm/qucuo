// 角色入册 —— 跳过 AI 时的默认值装配
// ============================================================================
// 免费反代 5 次/分钟、随时 429，外部服务挂了也要能入册。这里集中两份默认装配：
// fillPlayer 补齐玩家档案里 AI 不产出的项；buildFallbackResult 把勾中的人物全部
// 填成默认 NPC（称谓级 1、空套装、两级里程碑），供「跳过 AI」那步直接进审改。

import { EMPTY_SPECIAL } from "./importShared.js";
import { sanitizeMoves, TIER_NEIGONG } from "../../../domain/rules/cards/scanPrompts.js";
import { BODY_PUBLIC, BODY_PRIVATE } from "./widgets.jsx";

// 玩家档案补齐 AI 不产出的那几项（性别、内外功、说话示范）
export function fillPlayer(base, personaFallback = "") {
  const bp = {};
  for (const [k] of BODY_PUBLIC) bp[k] = base?.bodyProfile?.[k] || "";
  const priv = {};
  for (const [k] of BODY_PRIVATE) priv[k] = base?.bodyProfilePrivate?.[k] || "";
  return {
    name: base?.name || "", nameWhy: base?.nameWhy || "",
    gender: "男",
    bodyProfile: bp,
    bodyProfilePrivate: priv,
    special: base?.special || { ...EMPTY_SPECIAL },
    specialWhy: base?.specialWhy || "",
    neigong: 5, waigong: 5,
    // 主角的初始武学与装备：卡里没有，扫描也不产出，默认空。玩家在「设置主角」
    // 那步点「AI 现编武学 / AI 配装备」现生成，或手填。
    skills: Array.isArray(base?.skills) ? base.skills : [],
    carry: Array.isArray(base?.carry) ? base.carry : [],
    persona: base?.persona || personaFallback || "",
    dialogueExamples: undefined,
    source: base?.source || "fallback",
  };
}

// 「跳过 AI」的默认结果：人物全部填默认值；world 由调用方用 initWorld 挂好开关传入
export function buildFallbackResult({ people, asPlayer, parsed, openingIdx, world }) {
  return {
    genre: "", multiPerson: parsed.multiPerson || [],
    world,
    npcs: people.map(p => ({
      name: p.name, aliases: p.aliases, entry: p.entry,
      brief: p.name, levelCap: 1,
      special: { ...EMPTY_SPECIAL },
      neigong: TIER_NEIGONG[1], waigong: TIER_NEIGONG[1],
      moves: sanitizeMoves(null, 1),
      carry: [], portrait: "",
      appearance: "", attitude: "", affection: 0,
      milestones: [
        { threshold: 30, title: "面善", brief: "他开始主动与你搭话", text: [] },
        { threshold: 60, title: "交心", brief: "他说起了从不与人提的事", text: [] },
      ],
      mergedFrom: p._meta?.mergedFrom || [], source: "fallback",
    })),
    player: asPlayer ? fillPlayer(null, parsed?.personaCandidate) : null,
    opening: asPlayer && parsed.card.openings.length
      ? { index: openingIdx, original: parsed.card.openings[openingIdx], rewritten: parsed.card.openings[openingIdx], source: "original" }
      : null,
    report: { calls: 0, failures: [], fromCache: [] },
  };
}
