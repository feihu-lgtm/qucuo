// ── WO-23C1 宿敌赐号纯函数层（无 AI）──────────────────────────────────────
// 系统决定何时赐号/写不写，AI 只起名。这里放全部 deterministic 判定：
//  · findEpithetCandidates：结算前后宿敌谱快照 diff，找「首次入谱或 tier 晋升
//    且 epithet 空」的 active entry——同一 entry 只赐一次的判定也在这。
//  · validateEpithetOutput：AI 产出三字段的形状/内容校验，不合格拒写。

// diff 前后两份宿敌谱（varTree.世界.宿敌谱 形状），返回需要赐号的 entry 列表。
// 只认 active；tier 必须严格变大才算晋升；epithet 已有值不再赐（只赐一次）。
export function findEpithetCandidates(before, after) {
  if (!after || typeof after !== "object") return [];
  const out = [];
  for (const [faction, group] of Object.entries(after)) {
    const entries = group?.entries;
    if (!entries || typeof entries !== "object") continue;
    for (const [entryId, entry] of Object.entries(entries)) {
      if (!entry || typeof entry !== "object" || !entry.id || !entry.name) continue;
      if (entry.status !== "active") continue;
      if (String(entry.epithet || "").trim()) continue; // 已有号——只赐一次
      const beforeEntry = before?.[faction]?.entries?.[entryId];
      const isNew = !beforeEntry;
      const tierUp = beforeEntry && Number.isFinite(beforeEntry.tier) && Number.isFinite(entry.tier) && entry.tier > beforeEntry.tier;
      if (!isNew && !tierUp) continue;
      out.push({ faction, entryId, entry, isNew, tierUp });
    }
  }
  return out;
}

const EPITHET_RE = /^[一-龥]{2,8}$/;
const FORBIDDEN = /杀|死|尸|屌|操|屎|fuck|shit/i;

// 校验 AI 赐号产出。返回 {ok, reason}。
//  · epithet 2-8 个中文字符，无数字英文无禁词，不含玩家名，不与谱内他人重复；
//  · tauntLine/rumorSnippet 长度上限 40/60，不得声称未给的战绩——最小口径：
//    禁止出现「胜你/赢你/打败你/杀你」等自述胜绩句式（系统没给这种事实）。
export function validateEpithetOutput(out, { playerName = "", existingEpithets = [] } = {}) {
  if (!out || typeof out !== "object") return { ok: false, reason: "shape" };
  const epithet = String(out.epithet || "").trim();
  if (!EPITHET_RE.test(epithet)) return { ok: false, reason: "epithet_shape" };
  if (FORBIDDEN.test(epithet)) return { ok: false, reason: "epithet_forbidden" };
  if (playerName && epithet.includes(playerName)) return { ok: false, reason: "epithet_player_name" };
  if (existingEpithets.some((e) => e && e === epithet)) return { ok: false, reason: "epithet_duplicate" };
  const taunt = String(out.tauntLine || "").trim();
  const rumor = String(out.rumorSnippet || "").trim();
  if (taunt.length > 40) return { ok: false, reason: "taunt_too_long" };
  if (rumor.length > 60) return { ok: false, reason: "rumor_too_long" };
  for (const text of [taunt, rumor]) {
    if (/胜了你|赢了你|打败你|杀了你|取你性命|要你命/.test(text)) return { ok: false, reason: "unearned_victory_claim" };
  }
  return { ok: true, epithet, tauntLine: taunt, rumorSnippet: rumor };
}

// 谱内全部非空 epithet 清单（查重用）。
export function collectEpithets(roster, excludeId = "") {
  const out = [];
  for (const group of Object.values(roster || {})) {
    const entries = group?.entries;
    if (!entries || typeof entries !== "object") continue;
    for (const e of Object.values(entries)) {
      if (e && e.id !== excludeId && String(e.epithet || "").trim()) out.push(String(e.epithet).trim());
    }
  }
  return out;
}

// 写入 changes 构造（纯函数，可测）：只补 epithet/tauntLine/rumorSnippet 三字段，
// 其余字段原样保留；落笔前目标状态异常（非 active/已有号/条目消失）返回原树。
export function buildEpithetWriteChanges(faction, entryId, valid) {
  return (prev) => {
    const book = prev?.世界?.宿敌谱 || {};
    const group = book[faction];
    const target = group?.entries?.[entryId];
    if (!target || target.status !== "active" || String(target.epithet || "").trim()) return prev;
    return {
      ...(prev || {}),
      世界: {
        ...(prev?.世界 || {}),
        宿敌谱: {
          ...book,
          [faction]: {
            ...group,
            entries: {
              ...(group.entries || {}),
              [entryId]: { ...target, epithet: valid.epithet, tauntLine: valid.tauntLine, rumorSnippet: valid.rumorSnippet },
            },
          },
        },
      },
    };
  };
}
