// ============================================================================
// 记账（bookkeep）—— 回合末的后台小模型调用，四阶段的最后一棒
// ----------------------------------------------------------------------------
// 主模型只负责叙事；叙事写完后，这个便宜的调用把"值得留下的事"落成两笔账：
//   1. memory：≤50字客观事实摘要（沿用主叙事 prompt 里 memory 字段的同一套规矩），
//      返回值里带着，交既有小纸条/事实管线去存，本模块不落库。
//   2. ledger：在场 NPC 的旧账新条目，每人每轮至多一句，经 applyBookkeep
//      写进 varTree.角色[name].旧账（npcLedger.js）。
// AI 关/失败一律返回空账，绝不抛错——记账是锦上添花，丢一轮不碍事。
// ============================================================================

import { define } from "../prompt/registry.js";
import { withAI } from "../prompt/withAI.js";
import { applyLedgerUpdate, LEDGER_LINE_MAX } from "./npcLedger.js";

export const MEMORY_MAX = 50;

const EMPTY_RESULT = { memory: "", ledger: {} };

function clampLine(s, max) {
  const t = typeof s === "string" ? s.trim() : "";
  if (!t) return "";
  return t.length > max ? t.slice(0, max) : t;
}

// 从 AI 回复里挖出最像答案的那个 JSON 对象；截断/缺尾时返回 null 走字段级打捞。
function tryParseObject(raw) {
  const s = raw.indexOf("{");
  if (s < 0) return null;
  const e = raw.lastIndexOf("}");
  const candidate = e > s ? raw.slice(s, e + 1) : raw.slice(s);
  try {
    const v = JSON.parse(candidate);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

// 截断回复的兜底：直接正则抠 "memory":"..."（允许串没收尾，截到结尾为止）
function salvageMemory(raw) {
  const m = raw.match(/"memory"\s*:\s*"((?:[^"\\]|\\.)*)("|$)/);
  if (!m) return "";
  let s = m[1];
  try { s = JSON.parse(`"${s}"`); } catch { /* 半截转义就按原文用 */ }
  return s;
}

// 截断回复的兜底：按人名正则抠 "名":[ ... ]，数组没闭合就只收里面完整的 "..."
function salvageLedgerLines(raw, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = raw.match(new RegExp(`"${esc}"\\s*:\\s*\\[([^\\]]*)`));
  if (!m) return [];
  const inner = m[1];
  try {
    const arr = JSON.parse(`[${inner}]`);
    return Array.isArray(arr) ? arr : [];
  } catch {
    const lines = [];
    for (const sm of inner.matchAll(/"((?:[^"\\]|\\.)*)"/g)) lines.push(sm[1]);
    return lines;
  }
}

function firstLine(val) {
  const cand = Array.isArray(val) ? val[0] : val;
  return clampLine(cand, LEDGER_LINE_MAX);
}

/**
 * 解析记账回复 → { memory, ledger:{人名:[一句]} }。
 * 不在场的人丢掉、每人只收第一句、行长截 40 字、垃圾输入返回空账；永不抛错。
 * @param {string} text          AI 原始回复
 * @param {string[]} presentNames 本轮在场 NPC 名（白名单）
 */
export function parseBookkeep(text, presentNames = []) {
  const raw = String(text ?? "").trim();
  if (!raw) return { ...EMPTY_RESULT, ledger: {} };

  const allowed = new Set(
    (Array.isArray(presentNames) ? presentNames : []).filter((n) => typeof n === "string" && n),
  );
  const obj = tryParseObject(raw);

  const memory = clampLine(
    typeof obj?.memory === "string" ? obj.memory : salvageMemory(raw),
    MEMORY_MAX,
  );

  const ledger = {};
  const src = obj && typeof obj.ledger === "object" && obj.ledger ? obj.ledger : null;
  if (src) {
    for (const [name, val] of Object.entries(src)) {
      if (!allowed.has(name)) continue;
      const line = firstLine(val);
      if (line) ledger[name] = [line];
    }
  } else {
    for (const name of allowed) {
      const line = firstLine(salvageLedgerLines(raw, name));
      if (line) ledger[name] = [line];
    }
  }
  return { memory, ledger };
}

export function registerBookkeepCalls() {
  define("block", "bookkeep.turn.sys", {
    label: "回合记账系统指令",
    slot: "sys",
    text: () => `你是幕后记账的小账房。看完这一轮发生的事，把值得留下的客观事实落成账，只输出一个 JSON，不要解释、不要 markdown：
{"memory":"≤50字客观事实或空串","ledger":{"人名":["一句≤40字的新账"]}}
- memory：用不超过50字的纯客观事实概括本轮发生了什么（谁做了什么、得到或失去了什么、去了何处、结下或了断了什么、许下或应承了什么）。写清人名地名，不用"那人""某处"这类含糊指代；只记事实，不写情绪、心理、评述；纯私密不宜外传的事不要写；没什么可记就写空串。
- ledger：只给在场人物记旧账（恩怨、人情、承诺、怒气缘由），每人至多一句新账，没有新事就不写这个人；只能写在场名单里的人。
- 一律用"少侠"称呼玩家角色，不要用"你/我/玩家"。`,
  });

  define("block", "bookkeep.turn.user", {
    label: "本轮叙事与在场人物旧账",
    slot: "user",
    text: (ctx) => {
      const names = ctx.presentNames || [];
      const ledgers = ctx.ledgers || {};
      const ledgerBlock = names
        .map((n) => {
          const lines = (ledgers[n] || []).map((l) => `  · ${l}`).join("\n");
          return `${n}${lines ? `\n${lines}` : "（无旧账）"}`;
        })
        .join("\n");
      return `回合数：${ctx.turn ?? 0}
在场人物：${names.join("、") || "（无）"}

【本轮结算】
${ctx.settleSummary || "（无）"}

【本轮叙事】
${ctx.narration || "（无）"}

【各人物旧账（已入账的，不要重复记）】
${ledgerBlock || "（无）"}`;
    },
  });

  define("call", "bookkeep.turn", {
    label: "回合记账",
    tokenLimitKey: "extraction",
    defaultMaxTokens: 1200,
    join: "",
    blocks: ["bookkeep.turn.sys", "bookkeep.turn.user"],
    vet: (text, ctx) => ({ ok: true, value: parseBookkeep(text, ctx.presentNames || []) }),
    offline: () => ({ memory: "", ledger: {} }),
  });
}

registerBookkeepCalls();

/**
 * 跑一轮记账。AI 关/调用失败/回复不可用时都返回 { memory:"", ledger:{} }。
 * @param {{ai: object, apiCfg: object, ctx: {narration: string, settleSummary: string, presentNames: string[], ledgers: Object<string,string[]>, turn: number}}} args
 * @returns {Promise<{memory: string, ledger: Object<string,string[]>}>}
 */
export async function runBookkeep({ ai, apiCfg, ctx }) {
  try {
    const res = await withAI("bookkeep.turn", ctx || {}, { ai, apiCfg, throwOnError: false });
    if (!res?.ok || !res.data) return { memory: "", ledger: {} };
    return res.data;
  } catch {
    return { memory: "", ledger: {} };
  }
}

/**
 * 把记账结果里的各人物新账写进 varTree（旧账追加见 npcLedger.js）。
 * memory 摘要只随 result 返回、不在这里落库，交既有小纸条管线去存。
 * @param {object} varTree
 * @param {{memory: string, ledger: Object<string,string[]>}} result
 * @param {number} turn
 * @returns {object} 新 varTree
 */
export function applyBookkeep(varTree, result, turn) {
  let next = varTree ?? {};
  for (const [name, lines] of Object.entries(result?.ledger || {})) {
    next = applyLedgerUpdate(next, name, lines, turn);
  }
  return next;
}
