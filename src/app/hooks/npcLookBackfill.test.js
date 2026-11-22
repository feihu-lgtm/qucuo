import { describe, expect, it, vi } from "vitest";
import { lookNpcInBackground } from "./npcLookBackfill.js";

const npc = { name: "才旦", brief: "村长之女", carriedItems: [{ name: "鱼定猎刀", category: "weapon" }] };
const stat = { t: "stat", text: "  才旦 品阶 绿袍" };

function harness(overrides = {}) {
  let log = [];
  const deps = {
    addLog: vi.fn((rows) => { log = [...log, ...rows]; }),
    setTime: vi.fn(),
    noteAction: vi.fn(),
    setConvo: vi.fn(),
    setLog: vi.fn((fn) => { log = fn(log); }),
    getState: () => ({ room: { name: "鱼定村" } }),
    canAsk: () => true,
    ask: vi.fn(async () => "她眉眼含笑，手按猎刀。"),
    ...overrides,
  };
  return { deps, getLog: () => log };
}

describe("lookNpcInBackground", () => {
  it("卡片先落、时辰 +1，描写插在卡片下面", async () => {
    const { deps, getLog } = harness();
    const done = lookNpcInBackground(npc, [stat], deps);
    expect(getLog().map(r => r.text)).toEqual(["> 看 才旦", "  才旦：村长之女", "  装束：鱼定猎刀", stat.text]);
    expect(deps.setTime).toHaveBeenCalledTimes(1);
    expect(deps.noteAction).toHaveBeenCalledWith("action");
    await done;
    expect(getLog()[4].text).toContain("眉眼含笑");
  });

  it("没配 API 时只留卡片", async () => {
    const { deps, getLog } = harness({ canAsk: () => false });
    await lookNpcInBackground(npc, [], deps);
    expect(deps.ask).not.toHaveBeenCalled();
    expect(getLog()).toHaveLength(3);
  });

  it("AI 出错时不抛、只留卡片", async () => {
    const { deps, getLog } = harness({ ask: vi.fn(async () => { throw new Error("boom"); }) });
    await expect(lookNpcInBackground(npc, [], deps)).resolves.toBeFalsy();
    expect(getLog()).toHaveLength(3);
  });
});
