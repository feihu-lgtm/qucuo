import { beforeEach, describe, expect, it, vi } from "vitest";
import { gameStore, initGameStore } from "../../store/gameStore.js";
import { turnMonitor } from "../../infra/turnMonitor.js";
import { playTurn } from "../../engine/playTurn.js";
import { loadSquares } from "../../domain/rules/map/mapSquares.js";
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

function useTestTurn(stateOverrides = {}, argOverrides = {}) {
  initGameStore({
    flags: [], inv: [], questProgress: {}, convo: [],
    room: { name: "曲措乡", npcs: [], items: [] },
    char: { name: "行旅", special: { 气运: 5 } },
    varTree: { 角色: {}, 世界: {} },
    time: 6,
    ...stateOverrides,
  });
  const args = {
    ...gameStore.getState(), apiCfg: {}, preset: {}, convo: [],
    addLog: vi.fn(), talkToNarrator: vi.fn(), narrator: {},
    interactMode: "action", pendingTalks: 0, changePendingTalks: vi.fn(),
    activeGroundItem: null, lastMoveRef: { current: 0 }, captureUndo: vi.fn(),
    turnGenerationRef: { current: 0 }, talkBusyRef: { current: false },
    setCmdHistory: vi.fn(), setHistIdx: vi.fn(), setFlags: vi.fn(), setInput: vi.fn(),
    setLoading: vi.fn(), waitTimerRef: { current: null }, setWaitSecs: vi.fn(),
    pendDirRef: { current: null },
    noteAction: vi.fn(), roomMapRef: { current: {} }, innerRoomName: null,
    collectGrantedRef: { current: [] }, clearRouteQueue: vi.fn(), setCommandPhase: vi.fn(),
    outerDepartRef: { current: null }, varTreeRef: { current: {} },
    pickupJudgmentRef: { current: null }, pickupExtractionFailedRef: { current: false },
    prerunSquares: vi.fn(), dayMaterialRef: { current: {} },
    roundsSinceLastSaveRef: { current: 0 }, playedThisSessionRef: { current: false },
    gambleTalkCtx: { current: null }, timeRef: { current: 6 },
    intentRouterRef: { current: null },
    setVarTree: vi.fn(), setGambleNegotiation: vi.fn(), setChar: vi.fn(),
    setDao: vi.fn(), setExp: vi.fn(), setPot: vi.fn(), setSkills: vi.fn(),
    setMapData: vi.fn(), setTime: vi.fn(), setPendingQuestBranch: vi.fn(),
    setConvo: vi.fn(), jotNote: vi.fn(), setLog: vi.fn(),
    dispatchCommand: vi.fn(),
    ...argOverrides,
  };
  const { act } = useTurn(args);
  return { act, args };
}

beforeEach(() => {
  playTurn.mockReset().mockResolvedValue({ ok: true });
});

describe("act 调度器进入", () => {
  // 契约：非 schedulerManaged 的输入不直接跑回合，先分类命令丢给 dispatchCommand。
  it.each([
    ["typedAction", "四处看看风景", {}],
    ["mapMovement", "n", {}],
    ["mapMovement", "走向广场", { opts: { forceLayer: "inner" } }],
    ["actDialogue", "聊聊家常", { interactMode: "talk" }],
    // talk 模式现在也走自动分流：非搭话句（如攻击）按行动扣回合
    ["typedAction", "攻击他", { interactMode: "talk" }],
    ["actWhisper", "旁白在吗", { interactMode: "whisper" }],
    ["actSettle", "拜师父为师", { opts: { settle: true } }],
    ["autoTravel", "去喇嘛庙", { opts: { autoTravel: true } }],
    ["localHelp", "help", {}],
    ["localRoomLook", "look", { room: { name: "鱼定村", npcs: [], items: [] }, seedLook: true }],
  ])("classifies %s and dispatches instead of running a turn", async (expectedId, cmd, { interactMode, room, opts, seedLook }) => {
    if (seedLook) loadSquares({ "鱼定村": { day: 0, lookText: "石板街上人来人往。" } });
    const { act, args } = useTestTurn(room ? { room } : {}, interactMode ? { interactMode } : {});

    await act(cmd, [], opts || {});

    expect(args.dispatchCommand).toHaveBeenCalledTimes(1);
    expect(args.dispatchCommand.mock.calls[0][0]).toBe(expectedId);
    expect(playTurn).not.toHaveBeenCalled();
    expect(args.setInput).toHaveBeenCalledWith("");
  });

  // 契约：dispatchCommand 拿到的 runner 再进 act（schedulerManaged），最终到 playTurn。
  it("re-enters act through the dispatched runner and reaches playTurn", async () => {
    const { act, args } = useTestTurn();
    await act("四处看看风景");

    const runner = args.dispatchCommand.mock.calls[0][1];
    await runner();

    expect(playTurn).toHaveBeenCalledTimes(1);
    expect(playTurn.mock.calls[0][1]).toBe("四处看看风景");
  });

  // 契约：displayCmd 替换排队时展示的命令文本。
  it("shows displayCmd in the queue instead of the raw command", async () => {
    const { act, args } = useTestTurn();

    await act("内部指令", [], { displayCmd: "给玩家看的话" });

    expect(args.dispatchCommand.mock.calls[0][2]).toEqual({ displayText: "给玩家看的话" });
  });
});

describe("act 分支短路", () => {
  // 契约：META_QUERY（regex 精确命中且未落本地命令）本地秒回帮助，不排队、不调 AI。
  it("answers META_QUERY locally without calling playTurn", async () => {
    const { act, args } = useTestTurn();

    await act("怎么玩", [], { schedulerManaged: true });

    expect(playTurn).not.toHaveBeenCalled();
    const texts = args.addLog.mock.calls.flat(2).map(l => l && l.text).join("\n");
    expect(texts).toContain("玩法说明");
    expect(args.setCmdHistory).toHaveBeenCalled();
  });

  // 契约：parseLocalCommand 命中（help 是 lines 型）时走 applyResult 写日志即返，不进 AI 回合。
  it("short-circuits a lines local command through applyResult", async () => {
    const { act, args } = useTestTurn();

    await act("help", [], { schedulerManaged: true });

    expect(playTurn).not.toHaveBeenCalled();
    const texts = args.addLog.mock.calls.flat(2).map(l => l && l.text).join("\n");
    expect(texts).toContain("移动");
  });

  // 契约：LOOK 意图 + 房间在固定地图上 → cachedLook 结果直接写状态（时间+1、对话追加），不调 AI。
  it("applies a cachedLook result without calling playTurn", async () => {
    loadSquares({ "鱼定村": { day: 0, lookText: "石板街上人来人往。" } });
    const { act } = useTestTurn({ room: { name: "鱼定村", npcs: [], items: [] }, time: 6, convo: [] });

    await act("look", [], { schedulerManaged: true });

    expect(playTurn).not.toHaveBeenCalled();
    const state = gameStore.getState();
    expect(state.time).toBe(7);
    expect(state.convo.at(-1).role).toBe("assistant");
  });

  // 契约：whisper 模式全程走 talkToNarrator 旁路，不经过 captureUndo 与 playTurn。
  it("routes whisper input to talkToNarrator without a turn", async () => {
    const { act, args } = useTestTurn({}, { interactMode: "whisper" });

    await act("旁白在吗", [], { schedulerManaged: true });

    expect(args.talkToNarrator).toHaveBeenCalledWith("旁白在吗", expect.objectContaining({ turn: expect.anything() }));
    expect(playTurn).not.toHaveBeenCalled();
    expect(args.captureUndo).not.toHaveBeenCalled();
  });

  // 契约：私聊串行——talkBusyRef 占用时第二条只提示「稍候」，不再发话。
  it("blocks a second whisper while one is in flight", async () => {
    const { act, args } = useTestTurn({}, { interactMode: "whisper", talkBusyRef: { current: true } });

    await act("第二句", [], { schedulerManaged: true });

    expect(args.talkToNarrator).not.toHaveBeenCalled();
    const texts = args.addLog.mock.calls.flat(2).map(l => l && l.text).join("\n");
    expect(texts).toContain("稍候");
  });

  // 契约：intentRouter 命中（返回真）即接管输入，act 就此返回不调 playTurn；settle 回合跳过路由。
  it("lets the intent router claim non-settle input", async () => {
    const route = vi.fn(async () => true);
    const { act } = useTestTurn({}, { intentRouterRef: { current: route } });

    await act("先去做饭再回家", [], { schedulerManaged: true });

    expect(route).toHaveBeenCalledWith("先去做饭再回家", expect.anything());
    expect(playTurn).not.toHaveBeenCalled();
  });

  it("skips the intent router for settle turns", async () => {
    const route = vi.fn(async () => true);
    const { act } = useTestTurn({}, { intentRouterRef: { current: route } });

    await act("拜师", [], { schedulerManaged: true, settle: true });

    expect(route).not.toHaveBeenCalled();
    expect(playTurn).toHaveBeenCalledTimes(1);
  });

  // 契约：keepUndo 时不做撤销快照，普通动作则先 captureUndo 再进回合。
  it("captures undo unless keepUndo is set", async () => {
    const { act, args } = useTestTurn();

    await act("四处看看风景", [], { schedulerManaged: true });
    expect(args.captureUndo).toHaveBeenCalledTimes(1);

    args.captureUndo.mockClear();
    await act("四处看看风景", [], { schedulerManaged: true, keepUndo: true });
    expect(args.captureUndo).not.toHaveBeenCalled();
  });
});

describe("act 移动分支", () => {
  // 契约：forceLayer 移动 300ms 内连发会被节流直接返回（不写日志、不进回合）。
  it("throttles a repeated forced move", async () => {
    const { act, args } = useTestTurn();
    args.lastMoveRef.current = Date.now();

    await act("e", [], { schedulerManaged: true, forceLayer: "inner" });

    expect(playTurn).not.toHaveBeenCalled();
    expect(args.addLog).not.toHaveBeenCalled();
  });

  // 契约：内层箱庭移动是瞬时纯前端操作——命中内层出口就写状态早退，不进 loading 也不调 AI。
  it("resolves an inner-map move locally and returns early", async () => {
    const { act, args } = useTestTurn({
      room: { name: "鱼定村", npcs: [], items: [] },
      innerRoomName: "村口",
    }, { innerRoomName: "村口" });

    await act("n", [], { schedulerManaged: true });

    expect(playTurn).not.toHaveBeenCalled();
    expect(args.noteAction).toHaveBeenCalledWith("innerMove");
    expect(gameStore.getState().innerRoomName).toBe("老孙饭馆");
    expect(args.setLoading).toHaveBeenCalledWith(false);
  });

  // 契约：内层方向无去处时给「没有去处」提示早退，不把它当外层移动交给 AI。
  it("reports a blocked inner direction without calling playTurn", async () => {
    const { act, args } = useTestTurn({
      room: { name: "鱼定村", npcs: [], items: [] },
      innerRoomName: "村口",
    }, { innerRoomName: "村口" });

    await act("u", [], { schedulerManaged: true, forceLayer: "inner" });

    expect(playTurn).not.toHaveBeenCalled();
    const texts = args.addLog.mock.calls.flat(2).map(l => l && l.text).join("\n");
    expect(texts).toContain("没有去处");
  });
});
