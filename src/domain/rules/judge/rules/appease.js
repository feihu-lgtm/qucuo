// ── appease 赔罪收拒裁决（S4 纯搬家：原 judgeTurn.js appease 分支原样移入）──
import { CATALOG_INDEX } from "../../../data/items/catalog.js";
import { computeGiftWeight } from "../../npc/giftWeight.js";
import { personaMod, affectionMod } from "./shared.js";

export function handleAppease(J, action, npc, aff, stanceMod) {
  const { roll, facts, notes, nextFactId } = J;
  const inv = Array.isArray(J.inv) ? J.inv : [];
  // WO-16F-F3：perfunctory 一票否决——敷衍赔罪不受理，零 facts 不掷骰。
  if (action.stance === "perfunctory") {
    notes.push(`${npc.name}面前几句敷衍，赔罪不受理（perfunctory 否决）`);
    if (J.lastActionOutcome) { J.lastActionOutcome.rejected = true; J.lastActionOutcome.kind = "appease"; J.lastActionOutcome.target = npc.name; }
    return;
  }
  const giftKey = action.itemId || (action.item && action.item !== "无" ? action.item : "");
  const item = giftKey
    ? inv.find((it) => (typeof it === "string"
      ? it === giftKey
      : it?.id === giftKey || it?.name === giftKey))
    : null;
  if (giftKey && !item) {
    notes.push(`赔罪所奉之物「${giftKey}」不在囊中，仅按空手言和裁定`);
  }
  const itemObj = item
    ? (typeof item === "string" ? { name: item, ...(CATALOG_INDEX[item] || {}) } : item)
    : null;
  const weight = itemObj ? computeGiftWeight(npc, itemObj) : null;
  const giftMod = itemObj ? (weight?.ratio >= 2 ? 0.2 : weight?.ratio >= 1 ? 0.15 : 0.1) : 0;

  const score = 0.5 + personaMod(npc.personality) + affectionMod(aff) + stanceMod + giftMod;
  if (roll() < Math.max(0.05, Math.min(0.95, score))) {
    J.accept.value = true;
    if (item) {
      facts.push({
        id: nextFactId(), op: "TRANSFER_ITEM",
        itemId: (typeof item === "object" ? item.id : null) || action.itemId || "",
        itemName: itemObj?.name || giftKey,
        from: "player", to: npc.name, witnesses: ["主角", npc.name],
      });
    }
    facts.push({
      id: nextFactId(), op: "MUTATE_SOCIAL", npc: npc.name,
      affectionDelta: 3, ledgerKind: "见", reason: item ? `奉${itemObj?.name || giftKey}赔罪言和` : "赔罪言和", witnesses: ["主角", npc.name],
      // WO-16F-F3：detail 明示正文方向——renderJudgeVerdict 逐字渲染进定案单，
      // 主叙事不得写成余怒未消。
      detail: item ? `赔罪诚恳且对方收下${itemObj?.name || giftKey}，怒气消解，好感回暖` : "赔罪奏效，怒气消解，好感回暖",
      // WO-16F-F3：成功消气 + 消解对方最近一条未了「怨」（不删原文，只打标记）。
      angerRelease: true, grudgeResolve: true,
    });
  } else {
    notes.push(`${npc.name}余怒未消，赔罪未收下`);
    // W-FIX2（第 19 式）：掷骰失败同样补 rejected 信号——赔罪被拒后 UI/旁白
    // 需要确定性拒收事实，与 perfunctory 否决同口径。
    if (J.lastActionOutcome) { J.lastActionOutcome.rejected = true; J.lastActionOutcome.kind = "appease"; J.lastActionOutcome.target = npc.name; }
  }
}
