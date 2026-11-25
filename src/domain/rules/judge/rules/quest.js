// ── quest_advance 白名单核验 + 契约履约核验（S4 纯搬家：原 judgeTurn.js B1/履约段原样移入）──
import { findNpc } from "./shared.js";

// B1 任务推进扩展律：候选只能由系统 helper（questAdvanceCandidates）现场生成并进 envelope；
// 小模型提议的 questId+flag 必须精确命中本轮候选，自编/提前阶段/错地点一律
// 安静丢弃——叙事到位判定归 intake 提议，上下文合法性归判官裁决。
export function processQuestAdvance(J, proposals) {
  const { envelope, facts, notes, nextFactId } = J;
  const questCandidates = Array.isArray(envelope.questCandidates) ? envelope.questCandidates : [];
  const signedQuestFlags = new Set();
  for (const proposal of proposals) {
    if (proposal?.kind !== "quest_advance") continue;
    const hit = questCandidates.find((c) => c.questId === proposal.questId && c.flag === proposal.flag);
    if (!hit) {
      notes.push(`任务推进提议未过白名单（${proposal.questId || "?"}/${proposal.flag || "?"}），丢弃`);
      continue;
    }
    if (signedQuestFlags.has(hit.flag)) continue;
    signedQuestFlags.add(hit.flag);
    facts.push({
      id: nextFactId(), op: "ADVANCE_QUEST",
      questId: hit.questId, flag: hit.flag, questTitle: hit.title,
      // 「主角」是判官全链统一的系统主角代号（talk/give/sealVerifier 同口径），不用玩家实名
      witnesses: ["主角"],
    });
  }
}

// 履约核验（WO-22B-P3）：判官只在「玩家行为客观满足 promise 且对象 NPC 在场」
// 时签 settle——严禁模型正文自证，证据只取本 verdict 已签硬事实/在场名册/当前地。
// 窄规则最小类：
//   A 交付/送还某物：本回合已签 TRANSFER_ITEM player→该 NPC，且 promise 含该物名；
//   B 到达/在场重逢：promise 含当前据点名（≥2 字）且 NPC 在场。
// 违约 breachTurn 不签（P1 已罚）；无法结构化核验的 promise 不签，notes 留痕。
export function processPactSettle(J) {
  const { facts, notes, nextFactId, talkOnly, varTree, npcs, inv } = J;
  const pactsByNpc = varTree?.世界?.契约 || {};
  for (const [pactNpc, byKey] of Object.entries(pactsByNpc)) {
    if (!byKey || typeof byKey !== "object") continue;
    const npcObj = findNpc(npcs, pactNpc);
    for (const [pactKey, pact] of Object.entries(byKey)) {
      if (!pact || typeof pact !== "object" || !pact.promise) continue;
      if (pact.settled) continue;
      if (pact.breachTurn != null) continue; // 违约后不可再履约（P1 口径）
      if (!npcObj) continue; // 不在场不裁——notes 都不留，避免每轮刷屏
      if (talkOnly) continue; // 纯搭话回合零硬事实，履约无从谈起
      const promise = String(pact.promise);
      let fulfilled = false;
      let evidence = "";
      // A 交付/送还：本 verdict 已签的 TRANSFER_ITEM player→pactNpc
      for (const f of facts) {
        if (f.op !== "TRANSFER_ITEM" || f.to !== pactNpc) continue;
        const invHit = (inv || []).find((it) => it && typeof it === "object" && it.id && it.id === f.itemId);
        const itemName = f.itemName || invHit?.name || "";
        if (itemName && itemName.length >= 2 && promise.includes(itemName)) {
          fulfilled = true;
          evidence = `交付「${itemName}」`;
          break;
        }
      }
      // B 类「到达/在场重逢」已按初审裁决删除——promise 含地名过宽
      // （「去贡措海取回剑谱」在贡措海做任何事都会误履约），宁可 false negative。
      if (fulfilled) {
        facts.push({
          id: nextFactId(), op: "BIND_OR_SETTLE_PACT", npc: pactNpc,
          settle: true, settleKey: pactKey,
          note: `履约：${evidence}`, witnesses: ["主角", pactNpc],
        });
        notes.push(`履约核验通过：${pactNpc}「${promise.slice(0, 18)}」（${evidence}）——签 settle`);
      } else {
        notes.push(`履约无法核验不签：${pactNpc}「${promise.slice(0, 18)}」——非交付/重逢可核验类或无本回合硬证据`);
      }
    }
  }
}
