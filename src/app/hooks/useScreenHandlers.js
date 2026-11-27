import { useCallback } from "react";
import { featureCtx } from "../runtime/gameRuntime.js";
import { gameActions, gameStore, getGameEpoch, isGameEpochStale } from "../../store/gameStore.js";
import { sessionUiStore, setInputCapsule } from "../../store/sessionUiStore.js";
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
import { recruitOC, applyRecruit, hirePriceFor } from "../../features/npc/ocRecruit.js";
import { recruitNemesis } from "../../features/npc/recruitNemesis.js";
import { openGoldenEgg } from "../../features/npc/goldenEgg.js";
import { eggPrizePending, markEggPrizeOpen, runEggPrize } from "./eggBackfill.js";
import { OC_BY_NAME } from "../../domain/rules/npc/npcCarry.js";
import { stationCompanion, unstationCompanion } from "../../domain/rules/companion/companion.js";
import { companionReunionLine } from "../../features/npc/companionChatter.js";
import { askStoryteller } from "../../engine/ports/storyteller.js";
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
    // W-INPUT：点「对话」改生成一次性 @胶囊（发完即焚），不再常驻 pinning——
    // 旧 interactMode/talkTarget 常驻会在底栏撤销后变成看不见的排他对象，回不去。
    setInputCapsule({ kind: "target", name: npc.name });
  }, { feature: "npc.talkToNpc" }), [captureUndo]);

  const handleNpcGift = useCallback((npc, item) => applyResult(featureCtx(), () => {
    captureUndo();
    setActiveTarget(npc.name);
    // WO-16F-F4a：判官链激活（与 runTurn 闸门同源 judgePipelineEnabled && extractionEnabled）
    // 时普通送礼走先裁后落——feature 不前置扣物/写好感，settle 回合判官裁定后落账。
    const cfg = sessionUiStore.getState().apiCfg;
    const deferToJudge = !!(cfg?.judgePipelineEnabled && cfg?.extractionEnabled);
    applyResult(featureCtx(), giftNpc(gameStore.getState(), npc, item, undefined, { deferToJudge }));
  }, { feature: "npc.giftNpc" }), [captureUndo]);

  // 撤销只有一格：被拒绝、什么都没改的操作不能抢先存撤销点，否则会把上一步真改动的
  // 撤销点顶掉，玩家点「回滚一步」只回到原地（判定结果先算，有 changes 才存）。
  const handleInviteCompanion = useCallback((npc) => applyResult(featureCtx(), () => {
    const result = inviteCompanion(gameStore.getState(), npc);
    // 被拒（任务撞车等）只有日志没有 changes：不存撤销点，但拒绝理由照样给玩家看
    if (!result.changes) { if (result.logs?.length) applyResult(featureCtx(), { logs: result.logs }); return; }
    captureUndo();
    setActiveTarget(npc.name);
    applyResult(featureCtx(), result);
  }, { feature: "npc.inviteCompanion" }), [captureUndo]);

  // WO-23C4 宿敌收服：eligibility 系统判定（tier<=2 且心账恩>怨），AI 完全不参与；
  // 被拒无 changes 不存撤销点，成功经 applyResult 单一边界落账。
  const handleRecruitNemesis = useCallback((ref) => applyResult(featureCtx(), () => {
    const result = recruitNemesis(gameStore.getState(), ref);
    if (!result.changes) { if (result.logs?.length) applyResult(featureCtx(), { logs: result.logs }); return; }
    captureUndo();
    applyResult(featureCtx(), result);
  }, { feature: "npc.recruitNemesis" }), [captureUndo]);

  // 元朵朵·金鸟金蛋：开场两行与签到日立刻落定（防连点重领），奖品由 AI 在系统掷定的品阶里
  // 自由随机后补到；无 API / AI 失败退回加权奖池。回包落账走 applyResult 统一边界。
  const handleGoldenEgg = useCallback((npc) => applyResult(featureCtx(), () => {
    // 连点防重领：签到账后移到奖品落账帧（Review 修①），异步窗口靠内存 pending 闸。
    if (eggPrizePending()) {
      addLog([{ t: "sys", text: "  金鸟还在路上，蛋还没开完——莫急。" }]);
      return;
    }
    const opened = openGoldenEgg(gameStore.getState(), npc);
    if (opened.changes) captureUndo();
    setActiveTarget(npc.name);
    applyResult(featureCtx(), opened);
    if (opened.quality) {
      markEggPrizeOpen();
      runEggPrize(opened.quality, {
        apply: (result) => applyResult(featureCtx(), result, { feature: "npc.goldenEggPrize", background: true }),
      });
    }
  }, { feature: "npc.goldenEgg" }), [captureUndo]);

  // OC 冒险者四路招募：recruitOC 判门成功则 applyRecruit 落盘，失败只写系统日志
  const handleOcRecruit = useCallback((npc, route) => applyResult(featureCtx(), () => {
    const adv = OC_BY_NAME[npc.name];
    if (!adv) return;
    // hire 路的按钮即全价档价（菜单文案已标出价多少），offer 不传会被当 0 必拒
    const res = recruitOC(gameStore.getState(), adv, route, route === "hire" ? { offer: hirePriceFor(adv) } : {});
    if (!res.ok) { addLog([{ t: "sys", text: `  ${res.reason}` }]); return; }
    captureUndo();
    setActiveTarget(npc.name);
    applyResult(featureCtx(), applyRecruit(gameStore.getState(), adv, res.effect));
  }, { feature: "npc.ocRecruit" }), [captureUndo]);

  // 伙伴留在当前房间（出战位不收留守）；唤回=清 stationed 归队
  // 伙伴可留守到任意房间：spot 缺省留当前房、null=唤回随行、给房间则落位过去
  const handleStationCompanion = useCallback((key, spotOverride) => applyResult(featureCtx(), () => {
    const { companionState, room, innerRoomName, time } = gameStore.getState();
    const spot = spotOverride === null ? null
      : { since: time || 0, ...(spotOverride || { district: room?.name, roomId: innerRoomName || room?.name, roomName: innerRoomName || room?.name }) };
    const next = spot ? stationCompanion(companionState, key, spot) : unstationCompanion(companionState, key);
    // 被拒（出战位上的伙伴不能留守）返回同一引用：不存撤销点，免得顶掉上一步真改动的撤销点
    if (next === companionState) {
      if (spot) addLog([{ t: "sys", text: "  出战位上的伙伴不能留守，先换下出战位。" }]);
      return;
    }
    captureUndo();
    applyResult(featureCtx(), { changes: { companionState: next } });
  }, { feature: "npc.stationCompanion" }), [captureUndo]);

  const handleRecallCompanion = useCallback((npc) => applyResult(featureCtx(), () => {
    captureUndo();
    const { companionState } = gameStore.getState();
    // 唤回用 stationedNpcsFor 折进 npc.id 的真槽位键——写死 imported_ 前缀对内置伙伴（雪豹等）找不着
    const slotKey = npc.id || `imported_${npc.name}`;
    applyResult(featureCtx(), { changes: { companionState: unstationCompanion(companionState, slotKey) } });
    setActiveTarget(npc.name);
    applyResult(featureCtx(), { logs: [{ t: "sys", text: `  ${npc.name}收拾行装，跟上了你的脚步。` }] });
    // 重逢台词：按留守时长+好感现写开口第一句（无 API 走兜底），记日志 + 进记忆
    const epoch = getGameEpoch();
    const cur = gameStore.getState();
    companionReunionLine({
      companionState, slotKey, now: cur.time, state: cur,
      favor: Number(cur.varTree?.角色?.[npc.name]?.好感度 ?? 0), ask: askStoryteller,
    }).then((r) => {
      if (!r || isGameEpochStale(epoch)) return;
      addLog([{ t: "desc", text: `  ${r.speaker}：“${r.line}”` }]);
      featureCtx().io?.jotNote?.({ text: `${r.speaker}见你回来接她，说道：“${r.line}”`, owner: [r.speaker] });
    }).catch(() => {});
  }, { feature: "npc.recallCompanion" }), [captureUndo]);

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

  // WO-16F-F2c：skipCaptureUndo 可选——判官链叙事后接续的交互不覆盖本回合撤销点。
  const handleNpcTrade = useCallback((npc, { skipCaptureUndo = false } = {}) => applyResult(featureCtx(), () => {
    const result = tradeWithNpc(gameStore.getState(), npc);
    // 交易被拒（如追杀令冷遇）没有 shop/changes，只是拒绝日志：不得白烧唯一撤销点。
    if (!skipCaptureUndo && (result.shop || result.changes)) captureUndo();
    if (result.shop) {
      // 日更摊刷新带来的落账（换货 room/npcState + 吆喝日志）与开摊分开应用。
      if (result.changes || result.logs?.length) applyResult(featureCtx(), { changes: result.changes, logs: result.logs });
      setTradingShop(result.shop);
    } else applyResult(featureCtx(), result);
  }, { feature: "npc.tradeWithNpc" }), [captureUndo]);

  const handleNpcLearnSkill = useCallback((npc) => applyResult(featureCtx(), () => {
    // WO-16F-F4b：谓词与 runTurn 闸门同源（judgePipelineEnabled && extractionEnabled）——
    // 错位最多退化 legacy 前置硬结算，绝不双结算。
    const cfg = sessionUiStore.getState().apiCfg;
    const deferToJudge = !!(cfg?.judgePipelineEnabled && cfg?.extractionEnabled);
    const result = learnNpcSkillLogic(gameStore.getState(), npc, { deferToJudge });
    if (result.changes) {
      captureUndo();
      setActiveTarget(npc.name);
    }
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
    handleRecruitNemesis,
    handleOcRecruit,
    handleGoldenEgg,
    handleStationCompanion,
    handleRecallCompanion,
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
