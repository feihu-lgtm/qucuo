// duoduoEggReaction：开奖卡片落定后朵朵反应的补写——无 API 走手写兜底句，
// AI 可用走 ask 现写；空文/异常都不留空。
import { describe, it, expect } from "vitest";
import { duoduoEggReaction } from "./eggBackfill.js";

describe("duoduoEggReaction", () => {
  it("无 API 时写兜底反应句", async () => {
    const lines = [];
    await duoduoEggReaction({ label: "空蛋" }, "empty", {
      addLog: (l) => lines.push(...l), canAsk: () => false, rng: () => 0,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toContain("朵朵");
  });

  it("AI 可用时走 ask 并落行", async () => {
    const lines = [];
    let asked = null;
    await duoduoEggReaction({ label: "金锭" }, "jackpot", {
      addLog: (l) => lines.push(...l), canAsk: () => true,
      ask: async (sys, user) => { asked = { sys, user }; return "朵朵抱着荷包直跺脚，心疼得眼圈都红了。"; },
    });
    expect(asked.user).toContain("金锭");
    expect(lines.length).toBeGreaterThan(0);
  });

  it("AI 返回空文也落兜底", async () => {
    const lines = [];
    await duoduoEggReaction({ label: "金锭" }, "jackpot", {
      addLog: (l) => lines.push(...l), canAsk: () => true, ask: async () => "", rng: () => 0,
    });
    expect(lines[0].text).toContain("朵朵");
  });

  it("AI 抛错同样落兜底", async () => {
    const lines = [];
    await duoduoEggReaction({ label: "松子糖" }, "small", {
      addLog: (l) => lines.push(...l), canAsk: () => true,
      ask: async () => { throw new Error("boom"); }, rng: () => 0,
    });
    expect(lines[0].text).toContain("朵朵");
  });
});
