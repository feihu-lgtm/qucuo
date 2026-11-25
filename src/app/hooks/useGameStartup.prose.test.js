import { describe, it, expect, beforeEach } from "vitest";
import { buildInitialGameState } from "../../engine/newGame.js";

describe("启动路径谱系恢复", () => {
  it("buildInitialGameState 拷回 snap.proseLineage/proseSeq", () => {
    const lin = [{ b: "bK1", upTo: null }];
    const state = buildInitialGameState({ snap: { proseLineage: lin, proseSeq: 7, rngState: null, log: [], convo: [] } }, 1);
    expect(state.proseLineage).toEqual(lin);
    expect(state.proseSeq).toBe(7);
  });
  it("无谱系存档：undefined/0 交给 reconcile 建根", () => {
    const state = buildInitialGameState(null, 1);
    expect(state.proseLineage).toBeUndefined();
    expect(state.proseSeq).toBe(0);
  });
});
