import { describe, expect, it, vi } from "vitest";
import { lookInBackground, lookScene } from "./lookBackfill.js";

const state = { room: { name: "鱼定村", npcs: [{ name: "扎西" }] }, innerRoomName: null, time: 10 };

function harness(overrides = {}) {
  let log = [];
  const deps = {
    addLog: vi.fn((rows) => { log = [...log, ...rows]; }),
    setTime: vi.fn(),
    setConvo: vi.fn(),
    setLog: vi.fn((fn) => { log = fn(log); }),
    getState: () => state,
    canAsk: () => true,
    ask: vi.fn(async () => "溪声潺潺，炊烟袅袅。"),
    ...overrides,
  };
  return { deps, getLog: () => log };
}

describe("lookScene", () => {
  it("外层据点用固定地图出口", () => {
    const scene = lookScene(state);
    expect(scene.place).toBe("鱼定村");
    expect(scene.exits).toMatchObject({ n: "喇嘛庙" });
    expect(scene.npcs.map(n => n.name)).toEqual(["扎西"]);
  });
});

describe("lookInBackground", () => {
  it("事实行先落、时辰 +1，描写插在事实行下面", async () => {
    const { deps, getLog } = harness();
    const done = lookInBackground("环顾四周", deps);
    expect(getLog()[0]).toMatchObject({ t: "cmd", text: "> 环顾四周" });
    expect(getLog()[1].text).toContain("此处是鱼定村");
    expect(deps.setTime).toHaveBeenCalledTimes(1);
    await done;
    expect(getLog()[2].text).toContain("溪声潺潺");
  });

  it("没配 API 时只留事实行", async () => {
    const { deps, getLog } = harness({ canAsk: () => false });
    await lookInBackground("环顾四周", deps);
    expect(deps.ask).not.toHaveBeenCalled();
    expect(getLog()).toHaveLength(2);
  });

  it("AI 出错时不抛、只留事实行", async () => {
    const { deps, getLog } = harness({ ask: vi.fn(async () => { throw new Error("boom"); }) });
    await expect(lookInBackground("环顾四周", deps)).resolves.toBeFalsy();
    expect(getLog()).toHaveLength(2);
  });
});
