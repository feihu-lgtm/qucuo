import { describe, expect, it } from "vitest";
import { createTurnMonitor, PHASE } from "./turnMonitor.js";
import { fmtGameClock, formatTrace } from "./actionTrace.js";

describe("全流程追踪日志的游戏回合与游戏日", () => {
  it("记录起止游戏回合与游戏日并在 formatTrace 中展示", () => {
    let clock = 6;
    const monitor = createTurnMonitor({ now: () => 1700000000000, strict: true });
    monitor.setGameClockReader(() => clock);

    const turn = monitor.start("向东走");
    expect(turn.gameTurn).toBe(6);
    expect(turn.gameDay).toBe(1);

    clock = 25;
    monitor.finish(turn, "已到达");
    expect(turn.endGameTurn).toBe(25);
    expect(turn.endGameDay).toBe(2);
    expect(fmtGameClock(turn)).toBe("第1日·第6回合 → 第2日·第25回合");

    const header = formatTrace(turn, { full: false }).split("\n")[0];
    expect(header).toContain("第1日·第6回合 → 第2日·第25回合");
  });

  it("单回合未跨回合时只展示起始游戏日与回合", () => {
    const monitor = createTurnMonitor({ now: () => 1700000000000, strict: true });
    monitor.setGameClockReader(() => 10);
    const turn = monitor.start("端详才旦");
    monitor.finish(turn);
    expect(fmtGameClock(turn)).toBe("第1日·第10回合");
    expect(formatTrace({ ts: 1700000000000, id: "t-1", raw: "test", phases: [PHASE.DONE], nodes: [] })).not.toContain("回合");
  });
});
