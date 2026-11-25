// ── WO-22B-P1 契约值守扫描器（无 AI，纯 deterministic）──────────────────────
// 底稿 WO-22：超时未办在跨时辰推进时触发违约结算——扣威望、往该 NPC 心账记一笔
// 「怨」，若对方品阶 >= 3（levelCap）或性情刚烈，向飞鸽队列压入一封斥责信。
// 本模块只做「值守扫描」这一半：跨时辰扫 varTree.世界.契约，到期未 settled 的
// 契约机械连锁记账。履约判定（P3）、契约来信 prompt 换块（P4）不在此范围。
//
// 键名口径：契约落在 varTree.世界.契约[NPC名][pactKey]（materializeFacts
// BIND_OR_SETTLE_PACT 已在此写账）——手册写的「世界.江湖契约」不另建并行键。
// 时间口径：state.time 单位是格，1 格 = 1 小时（pigeon LETTER_TUNE 注释：
// 一日 24 格、6 时辰 12 格）；sealVerifier 立约时 bindTurn 记的就是 timeNow，
// 故 deadline = bindTurn + deadlineHours（格），直接可比。
import { createHeartLedgerEntry, dedupeHeartLedgerId, capHeartLedgerEntries } from "../../domain/rules/memory/npcLedger.js";
import { pigeonDelayShichen } from "./logic.js";
import { findNpcObject } from "./inbound.js";
import { isFierceNpc as isFierce } from "./pactLetter.js"; // 一处定义两侧共用（裁决顺手去重）

// 起步数额（手册未定，最小起步并在 docs 写明）：每桩违约扣威望 5。
export const PACT_BREACH_PRESTIGE_COST = 5;
// 品阶门槛：底稿「品阶 >= 3 或性情刚烈」。品阶即 npc.levelCap（npcGeneration
// 注释：品阶直接存在 NPC 身上的 levelCap 字段）。
export const PACT_BREACH_LETTER_TIER = 3;

// 扫一遍契约账，产出 { changes, logs } 或 null。纯函数：不掷骰、不读时钟、不调 AI。
export function scanPactBreaches(state, { importedRegistry = null } = {}) {
  const pacts = state.varTree?.世界?.契约;
  if (!pacts || typeof pacts !== "object") return null;
  const now = state.time || 0;
  const due = [];
  for (const [npcName, byKey] of Object.entries(pacts)) {
    if (!byKey || typeof byKey !== "object") continue;
    for (const [pactKey, pact] of Object.entries(byKey)) {
      if (!pact || typeof pact !== "object" || !pact.promise) continue;
      if (pact.settled) continue;             // 已了结（履约/结案）不触发
      if (pact.breachTurn != null) continue;  // 幂等：同契约只罚一次
      if (!Number.isFinite(pact.deadlineHours) || pact.deadlineHours <= 0) continue; // 无期限永不到期
      if (!Number.isFinite(pact.bindTurn)) continue;
      if (now < pact.bindTurn + pact.deadlineHours) continue; // 未到期不触发
      due.push({ npcName, pactKey, pact });
    }
  }
  if (!due.length) return null;

  const letters = [];
  const ledgerPatchOps = [];
  const logs = [];
  for (const { npcName, pactKey, pact } of due) {
    const npc = findNpcObject(state, npcName, importedRegistry);
    const rawEntry = createHeartLedgerEntry({
      tag: "怨",
      summary: `逾期未践「${String(pact.promise).slice(0, 20)}」之约`,
      turn: now,
      place: state.room?.name || "",
      witnesses: ["主角", npcName],
    });
    if (rawEntry) {
      const existing = Array.isArray(state.varTree?.角色?.[npcName]?.心账) ? state.varTree.角色[npcName].心账 : [];
      const entry = dedupeHeartLedgerId(rawEntry, existing);
      ledgerPatchOps.push({ npcName, entry, existing });
    }
    const tier = Number.isFinite(npc?.levelCap) ? npc.levelCap : 0;
    if (tier >= PACT_BREACH_LETTER_TIER || isFierce(npc)) {
      const { delay } = pigeonDelayShichen(state, npcName);
      letters.push({
        id: `letter_pact_${npcName}_${pactKey}`, // id 含 NPC 名：不同 NPC 信件 id 互不相撞，applyInboundLetter 按 id 移除不误伤
        npcName,
        arriveTime: now + delay * 2,
        sentAt: now,
        pactMeta: {
          reason: "逾期催问",
          pactKey,
          promise: pact.promise,
          deadlineHours: pact.deadlineHours,
          rewardHint: pact.rewardHint || "",
        },
      });
    }
    logs.push({ t: "narrator", text: `  你在${pact.place || "此地"}应下${npcName}的「${pact.promise}」——期限已过，江湖上难免有人记着这笔账。` });
  }

  return {
    changes: {
      varTree: (previous) => {
        let tree = previous || {};
        // ① 威望扣减：与 questRewards 同口径 clamp -100~100（worldRules 走同一
        // varTree 写入边界，不另开通道）。
        const cost = PACT_BREACH_PRESTIGE_COST * due.length;
        const prestige = Math.max(-100, Math.min(100, (Number(tree?.世界?.威望) || 0) - cost));
        tree = { ...tree, 世界: { ...tree.世界, 威望: prestige } };
        // ② 契约打 breachTurn 幂等标记（不删原文、不改 settled——违约与履约
        // 是两种结局，违约后 P3 不得再履约由 pact.breachTurn 供判官读取）。
        const pactsNext = { ...(tree.世界?.契约 || {}) };
        for (const { npcName, pactKey } of due) {
          pactsNext[npcName] = {
            ...(pactsNext[npcName] || {}),
            [pactKey]: { ...(pactsNext[npcName]?.[pactKey] || {}), breachTurn: now },
          };
        }
        tree = { ...tree, 世界: { ...tree.世界, 契约: pactsNext } };
        // ③ 心账怨：逐人追加（cap 16 与写径同口径）。
        let chars = { ...(tree.角色 || {}) };
        for (const { npcName, entry } of ledgerPatchOps) {
          const cur = chars[npcName] || {};
          const list = Array.isArray(cur.心账) ? cur.心账 : [];
          chars[npcName] = { ...cur, 心账: capHeartLedgerEntries([...list, entry]) };
        }
        tree = { ...tree, 角色: chars };
        // ④ 斥责信压入既有来信待发队列；按信 id 幂等（已在途不重复压）。
        if (letters.length) {
          const pending = Array.isArray(tree.世界?.来信待发) ? tree.世界.来信待发 : [];
          const fresh = letters.filter((l) => !pending.some((p) => p.id === l.id));
          if (fresh.length) {
            tree = { ...tree, 世界: { ...tree.世界, 来信待发: [...pending, ...fresh] } };
          }
        }
        return tree;
      },
    },
    logs,
  };
}

// 世界规则壳：跨时辰推进时才扫（deps 按时辰分桶），扫到即罚、幂等不重罚。
// firstRun 不扫——读档/开局瞬间不补罚，下一格时间推进自然补扫，行为与
// npcLetterRule 等既有规则同口径。
export const pactWatchRule = {
  id: "pact.watch",
  deps: (state) => [Math.floor((state.time || 0) / 2), state.varTree?.世界?.契约],
  run(state, { firstRun, importedRegistry } = {}) {
    if (firstRun) return null;
    return scanPactBreaches(state, { importedRegistry });
  },
};
