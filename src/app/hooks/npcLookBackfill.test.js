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
    expect(getLog().map(r => r.text)).toEqual(["> 看 才旦", "  才旦 村长之女", "  装束 鱼定猎刀", stat.text]);
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

  it("私聊与上一次看卡不算「最近的交谈」，真对话照常进层", async () => {
    const { deps } = harness({
      getState: () => ({
        room: { name: "鱼定村" },
        convo: [
          { role: "assistant", content: "（旁白私聊回应）才旦那小子命硬得很" },
          { role: "user", content: "看 才旦", kind: "look" },
          { role: "assistant", content: "才旦：村长之女；装束：鱼定猎刀" }, // 旧档无标记的看卡
          { role: "user", content: "看 才旦" },                    // 旧档无 kind 标记的指令
          { role: "assistant", content: "此处是鱼定村；出口：南·草场；在场：才旦" }, // 旧档环顾事实
          { role: "user", content: "问才旦山上的雪狼" },
          { role: "user", content: "看 才旦你今天气色不错" },      // 「看」起头的搭话，不是看卡回写
        ],
      }),
    });
    await lookNpcInBackground(npc, [], deps);
    const user = deps.ask.mock.calls[0][1];
    const section = user.match(/最近的交谈：\n((?:· .*\n?)*)/)?.[1] || "";
    expect(section.trim()).toBe("· 问才旦山上的雪狼\n· 看 才旦你今天气色不错");
    expect(user).not.toContain("命硬");
  });

  it("AI 出错时不抛、只留卡片", async () => {
    const { deps, getLog } = harness({ ask: vi.fn(async () => { throw new Error("boom"); }) });
    await expect(lookNpcInBackground(npc, [], deps)).resolves.toBeFalsy();
    expect(getLog()).toHaveLength(3);
  });
});
