import { expect, it, vi } from "vitest";
import { createScheduler } from "../../core/commandScheduler.js";
import { gameActions, gameStore, initGameStore } from "../../core/gameStore.js";
import { PHASE, turnMonitor } from "../../core/turnMonitor.js";
import { playTurn } from "../../engine/playTurn.js";
import { bindTurnAi } from "../../engine/ports/ai.js";
import { createCoalescedCheck, createWorldRules } from "../../engine/worldRules.js";
import { estateAnnouncementRule } from "../../features/quest/rules.js";
import { applyResult } from "../../features/run.js";
import { useAiInspect } from "./useAiInspect.js";
import { useTurn } from "./useTurn.js";

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal(),
  useCallback: fn => fn,
  useMemo: fn => fn(),
  useState: value => [value, vi.fn()],
  useRef: current => ({ current }),
  useEffect: vi.fn(),
}));
vi.mock("../../engine/playTurn.js", async (importOriginal) => ({
  ...await importOriginal(),
  playTurn: vi.fn(),
}));
vi.mock("../../domain/prompt/inspectCache.js", () => ({
  getCachedInspect: () => ({ text: "旧钥匙上系着褪色的红绳。" }),
  setCachedInspect: vi.fn(),
}));

it("keeps the key inspection's estate announcement open until its narration commits", async () => {
  const [room, char] = [{ name: "曲措乡", npcs: [] }, { name: "行旅" }];
  initGameStore({ flags: [], inv: ["溪边小屋钥匙"], questProgress: {}, room, char });
  const featureCtxRef = { current: null };
  const waitTimerRef = { current: null };
  const state = gameStore.getState();
  const commands = createScheduler();
  useTurn({
    ...state, apiCfg: {}, preset: {}, convo: [], addLog: vi.fn(),
    featureCtxRef, waitTimerRef, turnGenerationRef: { current: 0 }, dispatchCommand: commands.dispatch,
    pendDirRef: {}, outerDepartRef: {}, pickupJudgmentRef: {}, collectGrantedRef: {},
    varTreeRef: { current: {} }, timeRef: { current: 1 },
    setInput: vi.fn(), setCmdHistory: vi.fn(), setHistIdx: vi.fn(), setLoading: vi.fn(),
    setWaitSecs: vi.fn(), noteAction: vi.fn(),
  });
  const gate = Promise.withResolvers();
  playTurn.mockImplementation(async ({ _trace }) => {
    const ai = bindTurnAi({ chat: () => gate.promise }, _trace);
    await ai.chat([], { model: "estate-model", callLabel: "主叙事" });
    turnMonitor.transition(_trace, PHASE.COMMIT);
    return { ok: true };
  });
  let narration;
  const runner = createWorldRules([estateAnnouncementRule], {
    getState: gameStore.getState,
    applyResult: result => applyResult({
      act: (...args) => { narration = featureCtxRef.current.act(...args); },
    }, result),
  });
  const scheduler = createCoalescedCheck(runner.check);
  const unsubscribe = gameStore.subscribe(scheduler.schedule);
  try {
    const { inspectItem } = useAiInspect({ char, addLog: vi.fn(), setFlags: gameActions.setFlags });
    await inspectItem("item", "溪边小屋钥匙");
    expect(gameStore.getState().flags).toContain("tutorial_estate_announced");
    expect(playTurn).toHaveBeenCalledOnce();
    const pending = turnMonitor.getSnapshot().current;
    gate.resolve({ text: "四宅任务已开启。" });
    const [outcome] = await Promise.allSettled([narration]);
    expect.soft(pending).toMatchObject({ phase: PHASE.AI_WAIT, background: false, model: "estate-model" });
    expect(outcome).toEqual({ status: "fulfilled", value: undefined });
    const completed = turnMonitor.getSnapshot().current;
    expect(completed.phases).toEqual([PHASE.MACHINE, PHASE.AI_WAIT, PHASE.COMMIT, PHASE.DONE]);
    expect(completed.nodes).toContainEqual(expect.objectContaining({
      kind: "ai", model: "estate-model", pipeline: expect.objectContaining({ turnId: completed.id }),
    }));
    const rules = turnMonitor.getTrees().find(tree => tree.background && tree.source === "world-rules");
    expect(completed.parentId).toBe(rules.id);
    expect(rules.nodes).toContainEqual(expect.objectContaining({ layer: "rules", label: estateAnnouncementRule.id }));
  } finally {
    clearInterval(waitTimerRef.current);
    unsubscribe();
    scheduler.dispose();
    turnMonitor.clear();
  }
});

it.each([
  ["failed", { ok: false, error: new Error("report failed") }],
  ["stale", { ok: false, stale: true }],
])("runs the duel-report fallback for a %s turn", async (_label, result) => {
  initGameStore({
    flags: [], inv: [], questProgress: {}, room: { name: "鱼定村", npcs: [] },
    char: { name: "行旅" }, varTree: { 角色: {}, 世界: {} },
  });
  const addLog = vi.fn();
  const featureCtxRef = { current: null };
  const waitTimerRef = { current: null };
  const commands = createScheduler();
  playTurn.mockReset().mockResolvedValue(result);
  useTurn({
    ...gameStore.getState(), apiCfg: {}, preset: {}, convo: [], addLog,
    featureCtxRef, waitTimerRef, turnGenerationRef: { current: 0 }, dispatchCommand: commands.dispatch,
    captureUndo: vi.fn(),
    pendDirRef: {}, outerDepartRef: {}, pickupJudgmentRef: {}, collectGrantedRef: {},
    varTreeRef: { current: {} }, timeRef: { current: 1 },
    setInput: vi.fn(), setCmdHistory: vi.fn(), setHistIdx: vi.fn(), setLoading: vi.fn(),
    setWaitSecs: vi.fn(), noteAction: vi.fn(),
  });

  const reportFallback = vi.fn();
  await featureCtxRef.current.act("切磋结束，写战报", [], {
    duelReport: { rounds: [{ round: 1, text: "一招既定" }] },
    duelReportFallback: reportFallback,
  });

  expect(reportFallback).toHaveBeenCalledOnce();
});
