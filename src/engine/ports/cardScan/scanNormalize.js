// 结果清洗与兜底（从 cardScan.js 拆出，纯搬运）
// AI 输出一律过一遍清洗：数值钳到合法区间、字段截长度、缺项补兜底。
// 每条带 source 标记，UI 据此显示"AI 抽的"还是"默认值"。

import {
  sanitizeSpecial, sanitizeLevelCap, sanitizeAffection,
  sanitizeMilestones, sanitizeBrief, sanitizeGongfu, sanitizeMoves, sanitizeLore,
  BODY_PUBLIC_KEYS, BODY_PRIVATE_KEYS,
  FALLBACK_SPECIAL, FALLBACK_LEVEL_CAP, FALLBACK_MILESTONES,
} from "../../../domain/rules/cards/scanPrompts.js";

export function normalizeStage2(out, batch, playerName) {
  const arr = Array.isArray(out?.人物) ? out.人物 : (Array.isArray(out) ? out : []);
  return batch.map((p, i) => {
    const raw = arr.find(x => Number(x?.i) === i) || arr[i] || null;
    if (!raw) return fallbackNpc(p, playerName);
    const brief = sanitizeBrief(raw.brief);
    const levelCap = sanitizeLevelCap(raw.levelCap);
    return {
      name: p.name,
      aliases: p.aliases,
      // entry 是真正注入给说书人的那段，走 AI 重写的凝练版；AI 没出到就拿原卡
      // 正文清洗后顶上（比整段三千字灌进去好，但会残留第二人称，UI 会标出来）。
      // rawEntry 保留原卡正文一字不动，只在审改界面给玩家对照，不进任何 prompt。
      entry: sanitizeLore(raw.人设, { playerName, charName: p.name })
        || sanitizeLore(p.entry, { playerName, charName: p.name }),
      entryFromAi: !!String(raw.人设 || "").trim(),
      rawEntry: p.entry || "",
      brief: brief || sanitizeBrief(p._parts?.[0]) || p.name,
      briefWhy: String(raw.brief_why || "").slice(0, 20),
      levelCap,
      levelCapWhy: String(raw.levelCap_why || "").slice(0, 20),
      special: sanitizeSpecial(raw.special),
      specialWhy: String(raw.special_why || "").slice(0, 20),
      neigong: sanitizeGongfu(raw.neigong, levelCap),
      waigong: sanitizeGongfu(raw.waigong, levelCap),
      gongfuWhy: String(raw.neiwai_why || "").slice(0, 20),
      moves: sanitizeMoves(raw.moves, levelCap),
      movesWhy: String(raw.moves_why || "").slice(0, 20),
      carry: [],          // 卡里没有随身物，默认空 → 运行时走 rollNpcCarry 四池兜底
      portrait: "",       // 立绘由玩家在审改界面挑
      appearance: String(raw.外貌锚点 || "").slice(0, 100),
      attitude: String(raw.初始态度 || "").slice(0, 50),
      affection: sanitizeAffection(raw.好感初值),
      affectionWhy: String(raw.好感初值_why || "").slice(0, 20),
      milestones: sanitizeMilestones(raw.里程碑),
      mergedFrom: p._parts,
      groupedBy: p._from,
      source: "ai",
    };
  });
}

export function fallbackNpc(p, playerName) {
  return {
    name: p.name,
    aliases: p.aliases,
    // AI 整批失败，没有凝练版可用，只能拿原卡正文清洗后顶上
    entry: sanitizeLore(p.entry, { playerName, charName: p.name }),
    entryFromAi: false,
    rawEntry: p.entry || "",
    brief: sanitizeBrief(p._parts?.[0]) || p.name,
    briefWhy: "",
    levelCap: FALLBACK_LEVEL_CAP,
    levelCapWhy: "",
    special: { ...FALLBACK_SPECIAL },
    specialWhy: "",
    neigong: sanitizeGongfu(null, FALLBACK_LEVEL_CAP),
    waigong: sanitizeGongfu(null, FALLBACK_LEVEL_CAP),
    gongfuWhy: "",
    moves: sanitizeMoves(null, FALLBACK_LEVEL_CAP),
    movesWhy: "",
    carry: [],
    portrait: "",
    appearance: "",
    attitude: "",
    affection: 0,
    affectionWhy: "",
    milestones: FALLBACK_MILESTONES.map(m => ({ ...m })),
    mergedFrom: p._parts,
    groupedBy: p._from,
    source: "fallback",
  };
}

export function normalizeStage3(out) {
  const bp = {};
  for (const k of BODY_PUBLIC_KEYS) {
    bp[k] = String(out?.bodyProfile?.[k] || "").slice(0, 40);
  }
  const bpPriv = {};
  for (const k of BODY_PRIVATE_KEYS) {
    bpPriv[k] = String(out?.bodyProfilePrivate?.[k] || "").slice(0, 40);
  }
  return {
    name: String(out?.name || "").slice(0, 12),
    nameWhy: String(out?.name_why || "").slice(0, 20),
    bodyProfile: bp,
    bodyProfilePrivate: bpPriv,
    special: sanitizeSpecial(out?.special),
    specialWhy: String(out?.special_why || "").slice(0, 20),
    persona: String(out?.persona || "").slice(0, 200),
    missing: [...BODY_PUBLIC_KEYS.filter(k => !bp[k]), ...BODY_PRIVATE_KEYS.filter(k => !bpPriv[k])],
    source: "ai",
  };
}

export function fallbackPlayer() {
  const bp = {};
  for (const k of BODY_PUBLIC_KEYS) bp[k] = "";
  const bpPriv = {};
  for (const k of BODY_PRIVATE_KEYS) bpPriv[k] = "";
  return {
    name: "", nameWhy: "",
    bodyProfile: bp,
    bodyProfilePrivate: bpPriv,
    special: { ...FALLBACK_SPECIAL }, specialWhy: "",
    persona: "",
    missing: [...BODY_PUBLIC_KEYS, ...BODY_PRIVATE_KEYS],
    source: "fallback",
  };
}
