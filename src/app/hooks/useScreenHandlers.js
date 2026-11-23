import { useCallback } from "react";
import { featureCtx } from "../runtime/gameRuntime.js";
import { gameActions, gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { consumeItem, pickGroundItem } from "../../features/items/logic.js";
import {
  giftNpc,
  learnNpcSkill as learnNpcSkillLogic,
  lookNpc,
  stealFromNpc,
  talkToNpc,
  tradeWithNpc,
} from "../../features/npc/logic.js";
import { inviteCompanion } from "../../features/npc/inviteCompanion.js";
import { toggleEquip } from "../../domain/rules/economy/equipment.js";
import { getPresentNpcs } from "../../domain/rules/state/fields.js";
import { startTrace, step as traceStep, endTrace } from "../../infra/actionTrace.js";
import { isNpcAngry, stealSuccessRate } from "../../domain/rules/combat/stealSystem.js";

export function useScreenHandlers({
  act, setActiveTarget, setInteractMode, setTalkTarget,
  noteAction, setTradingShop, captureUndo,
}) {
  // Store 直读（路线一）：log 走 gameActions；time/inv 在使用点现取。
  const { setLog } = gameActions;
  const addLog = (lines) => setLog((p) => [...p, ...lines]);
  const handleNpcLook = useCallback((npc) => applyResult(featureCtx(), () => {
    captureUndo();
    const result = lookNpc(gameStore.getState(), npc);
    applyResult(featureCtx(), result);
    setActiveTarget(npc.name);
    const ctx = featureCtx();
    if (ctx?.lookNpcInBackground) { ctx.lookNpcInBackground(npc, result.extraReplies || []); return; }
    act("look " + npc.id, result.extraReplies || [], { keepUndo: true, inspect: true });
  }, { feature: "npc.lookNpc" }), [act, captureUndo]);

  const handleNpcTalk = useCallback((npc) => applyResult(featureCtx(), () => {
    captureUndo();
    const result = talkToNpc(gameStore.getState(), npc);
    applyResult(featureCtx(), result);
    if (result.completedEscort) return;
    if (npc.cannotSpeak) {
      setActiveTarget(npc.name);
      return;
    }
    setInteractMode("talk");
    setTalkTarget(npc.name);
    setActiveTarget(npc.name);
  }, { feature: "npc.talkToNpc" }), [captureUndo]);

  const handleNpcGift = useCallback((npc, item) => applyResult(featureCtx(), () => {
    captureUndo();
    setActiveTarget(npc.name);
    applyResult(featureCtx(), giftNpc(gameStore.getState(), npc, item));
  }, { feature: "npc.giftNpc" }), [captureUndo]);

  const handleInviteCompanion = useCallback((npc) => applyResult(featureCtx(), () => {
    captureUndo();
    const result = inviteCompanion(gameStore.getState(), npc);
    if (!result.changes) return;
    setActiveTarget(npc.name);
    applyResult(featureCtx(), result);
  }, { feature: "npc.inviteCompanion" }), [captureUndo]);

  const handleConsumeItem = useCallback((item) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), consumeItem(gameStore.getState(), item));
  }, { feature: "items.consumeItem" }), [captureUndo]);

  const handleCollectGround = useCallback((item) => applyResult(featureCtx(), () => {
    const result = pickGroundItem(gameStore.getState(), item, { tallyTime: gameStore.getState().time });
    if (!result.changes) return;
    captureUndo();
    applyResult(featureCtx(), result);
  }, { feature: "items.pickGroundItem" }), [captureUndo]);

  const handleNpcTrade = useCallback((npc) => applyResult(featureCtx(), () => {
    captureUndo();
    const result = tradeWithNpc(gameStore.getState(), npc);
    if (result.shop) setTradingShop(result.shop);
    else applyResult(featureCtx(), result);
  }, { feature: "npc.tradeWithNpc" }), [captureUndo]);

  const handleNpcLearnSkill = useCallback((npc) => applyResult(featureCtx(), () => {
    captureUndo();
    const result = learnNpcSkillLogic(gameStore.getState(), npc);
    if (result.changes) setActiveTarget(npc.name);
    applyResult(featureCtx(), result);
  }, { feature: "npc.learnNpcSkill" }), [captureUndo]);

  const handleNpcSteal = useCallback((npc) => applyResult(featureCtx(), () => {
    captureUndo();
    const state = gameStore.getState();
    if (isNpcAngry(state.varTree, npc?.name)) {
      applyResult(featureCtx(), stealFromNpc(state, npc));
      return;
    }
    const agility = state.char?.special?.身法 ?? 0;
    const _st = startTrace(`偷窃 ${npc?.name || "?"}`, `偷窃 ${npc?.name || "?"}`);
    const poolAll = npc?.carriedItems || [];
    const poolUsable = poolAll.filter(it => !it.stolen);
    traceStep(_st, "随身物池", poolUsable.length ? "info" : "block",
      poolAll.length
        ? `共${poolAll.length}件，可偷${poolUsable.length}件：${poolUsable.map(i => `${i.name}(${i.category || "?"}/${i.quality || "?"})`).join("、") || "无"}`
        : `carriedItems 为空或未固化 —— 这种情况偷不到任何物件，只可能偷到招式。若此人本该有随身物，说明固化/回填没生效。`);
    const favorability = state.varTree?.角色?.[npc?.name]?.好感度 ?? 0;
    const stealBonus = state.skills?.some((skill) => skill?.name === "讨饭手") ? 0.1 : 0;
    traceStep(_st, "身法与好感", "info",
      `身法${agility}，好感${favorability} → 成功率约 ${(stealSuccessRate(favorability, agility, stealBonus) * 100).toFixed(0)}%`);
    const result = stealFromNpc(state, npc);
    const steal = result.steal;
    if (result.kind === "blocked") {
      traceStep(_st, "判定", "block", steal?.reason || "此地没有这位人物。");
      applyResult(featureCtx(), result);
      endTrace(_st, "偷窃未进行");
      return;
    }
    traceStep(_st, "掷骰", steal.success ? "pass" : "block",
      `成功率${(steal.rate * 100).toFixed(0)}% → ${steal.success ? "得手" : "被察觉"}`);
    if (steal.success) {
      traceStep(_st, "产出分流", "info",
        `结局=${steal.outcome === null ? "对方一无所有" : steal.outcome === "move" ? "偷到招式" : "偷到物件"}`
        + (steal.outcome === "item" ? `：${steal.item.name}(${steal.item.category})` : "")
        + (steal.outcome === "move" ? `：${steal.move.name}` : ""));
    }
    if (result.noteAction) noteAction(result.noteAction);
    applyResult(featureCtx(), result);
    if (result.kind === "caught") {
      endTrace(_st, `被${npc.name}察觉，好感-${steal.favorabilityLoss}`);
    } else {
      endTrace(_st, result.kind === "empty"
        ? `得手但${npc.name}身无长物`
        : result.kind === "item" ? `顺走「${steal.item.name}」` : `偷师「${steal.move.name}」`);
    }
  }, { feature: "npc.stealFromNpc" }), [noteAction, captureUndo]);

  const giftToCharacter = useCallback((charName) => applyResult(featureCtx(), () => {
    const { inv } = gameStore.getState();
    if (inv.length === 0) {
      addLog([{ t: "err", text: `  背包空空如也，没有什么可以送给${charName}的。` }]);
      return;
    }
    const itemNames = inv.map(i => typeof i === "string" ? i : i.name);
    const choice = window.prompt(`要把哪件东西送给${charName}？\n${itemNames.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\n输入序号：`);
    const idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= itemNames.length) return;
    const state = gameStore.getState();
    const npc = getPresentNpcs(state).find(({ name }) => name === charName);
    captureUndo();
    setInteractMode("action");
    applyResult(featureCtx(), giftNpc(state, npc, inv[idx]));
  }, { feature: "npc.giftToCharacter" }), [captureUndo]);

  const handleToggleEquip = useCallback((it) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), { changes: { inv: (v) => toggleEquip(v, it.id) } });
    noteAction("equipToggle");
  }, { feature: "equipment.toggleEquip" }), [captureUndo]);

  const claimMilestone = useCallback((charName, threshold) => applyResult(featureCtx(), () => {
    captureUndo();
    applyResult(featureCtx(), { changes: { claimedMilestones: (prev) => new Set(prev).add(`${charName}:${threshold}`) } });
  }, { feature: "quest.claimMilestone" }), [captureUndo]);

  return {
    handleNpcLook,
    handleNpcTalk,
    handleNpcGift,
    handleInviteCompanion,
    handleConsumeItem,
    handleCollectGround,
    handleNpcTrade,
    handleNpcLearnSkill,
    handleNpcSteal,
    giftToCharacter,
    handleToggleEquip,
    claimMilestone,
  };
}
