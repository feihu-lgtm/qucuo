// WO-16E：gm/innerRoomName/encounter 顶层透传钉测——判官授信与影子同源依赖，
//  regression 会让 tension/gm 直通/影子内层静默断流（初审 blocker）。
import { describe, expect, it, vi } from "vitest";
import { createTurnContext } from "./turnContext.js";

function minimalEnv(over = {}) {
  const storeState = {
    varTree: {}, time: 10, npcState: {}, companionState: {},
  };
  return {
    cmd: "test",
    state: {
      room: { name: "鱼定村", npcs: [] }, char: { name: "测试" }, inv: [], skills: [], dao: {},
      flags: [], mapData: {}, time: 10, preset: {}, narrator: "",
      convo: [], nsfwOn: false, activeTarget: null, talkTarget: null, companionState: {},
      questProgress: {}, pendingQuestBranch: null, innerRoomName: "内堂", effectiveSpecialNow: {},
      ...(over.state || {}),
    },
    refs: {},
    io: {
      addLog: vi.fn(), setLog: vi.fn(), setVarTree: vi.fn(), setRoom: vi.fn(),
      setGambleNegotiation: vi.fn(), setInv: vi.fn(), setChar: vi.fn(), setDao: vi.fn(),
      setExp: vi.fn(), setPot: vi.fn(), setSkills: vi.fn(), setMapData: vi.fn(),
      setTime: vi.fn(), setPendingQuestBranch: vi.fn(), setConvo: vi.fn(),
      setCommandPhase: vi.fn(), onTurnsInvalidated: vi.fn(),
      getGameState: () => storeState, gameActions: {}, subscribeGameReplaced: vi.fn(),
      ...(over.io || {}),
    },
    opts: {},
    isStale: () => false, _trace: null, apiCfg: {}, gm: true,
    proseEpochGuard: () => false, proseSink: null, proseEpoch: 1, proseSeqAlloc: null,
    ...(over.env || {}),
  };
}

describe("createTurnContext 顶层透传", () => {
  it("gm/innerRoomName/encounter 三字段显式在顶层", () => {
    const encounter = { factionKey: "雪山派", faction: {}, passer: { name: "过客" } };
    const ctx = createTurnContext({
      plan: { encounterToDescribe: encounter, isTalk: false, isSettle: false },
      env: minimalEnv(),
    });
    expect(ctx.gm).toBe(true);
    expect(ctx.innerRoomName).toBe("内堂");
    expect(ctx.encounter).toEqual(encounter);
  });
  it("无遇敌时 encounter 为 null 而非 undefined", () => {
    const ctx = createTurnContext({ plan: {}, env: minimalEnv() });
    expect(ctx.encounter).toBeNull();
  });
});
