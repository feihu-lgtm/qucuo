import { expect, it, vi } from "vitest";
import { createScheduler } from "../../engine/commands/commandScheduler.js";
import { gameActions, gameStore, initGameStore } from "../../store/gameStore.js";
import { PHASE, turnMonitor } from "../../infra/turnMonitor.js";
import { playTurn } from "../../engine/playTurn.js";
import { bindTurnAi } from "../../engine/ports/ai.js";
import { createCoalescedCheck, createWorldRules } from "../../engine/worldRules.js";
import { estateAnnouncementRule } from "../../domain/rules/quests/rules.js";
import { applyResult } from "../../features/run.js";
import { useAiInspect } from "./useAiInspect.js";
import { useTurn } from "./useTurn.js";
import { featureCtx } from "../runtime/gameRuntime.js";

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
vi.mock("../../infra/inspectCache.js", () => ({
  getCachedInspect: () => ({ text: "旧钥匙上系着褪色的红绳。" }),
  setCachedInspect: vi.fn(),
}));

it("keeps the key inspection's estate announcement open until its narration commits", async () => {
  const [room, char] = [{ name: "曲措乡", npcs: [] }, { name: "行旅" }];
  const effectiveSpecialNow = { 魅力: 10 };
  const onTurnsInvalidated = vi.fn(() => vi.fn());
  initGameStore({ flags: [], inv: ["溪边小屋钥匙"], questProgress: {}, room, char });
  const waitTimerRef = { current: null };
  const state = gameStore.getState();
  const commands = createScheduler();
  useTurn({
    ...state, apiCfg: {}, preset: {}, convo: [], addLog: vi.fn(),
    effectiveSpecialNow, onTurnsInvalidated,
    waitTimerRef, turnGenerationRef: { current: 0 }, dispatchCommand: commands.dispatch,
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
      gameActions,
      act: (...args) => { narration = featureCtx().act(...args); },
    }, result),
  });
  const scheduler = createCoalescedCheck(runner.check);
  const unsubscribe = gameStore.subscribe(scheduler.schedule);
  try {
    const { inspectItem } = useAiInspect({ char, addLog: vi.fn(), setFlags: gameActions.setFlags });
    await inspectItem("item", "溪边小屋钥匙");
    // 四段式拆分后 act 抵达 playTurn 多了几跳微任务，先排空再断言（行为不变，只是晚几拍）。
    await new Promise(r => setTimeout(r, 0));
    expect(gameStore.getState().flags).toContain("tutorial_estate_announced");
    expect(playTurn).toHaveBeenCalledOnce();
    expect(playTurn.mock.calls[0][0].onTurnsInvalidated).toBe(onTurnsInvalidated);
    const pending = turnMonitor.getSnapshot().current;
    gate.resolve({ text: "四宅任务已开启。" });
    const [outcome] = await Promise.allSettled([narration]);
    expect(playTurn.mock.calls[0][0].effectiveSpecialNow).toBe(effectiveSpecialNow);
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

