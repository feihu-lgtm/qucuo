// runEggPrize：金蛋开奖的异步一段——AI 回包合规落 AI 奖品，无 API / 失败 / 不合规退回奖池，
// 存档纪元作废时什么都不落。
import { describe, it, expect, vi } from "vitest";

const withAIMock = vi.hoisted(() => ({ impl: null }));
vi.mock("../../engine/ports/withAI.js", () => ({
  withAI: (...args) => withAIMock.impl(...args),
}));

import { runEggPrize } from "./eggBackfill.js";

const baseOpts = (applied, extra = {}) => ({
  apply: (r) => applied.push(r),
  getState: () => ({ inv: [], char: { money: 0 } }),
  getApiCfg: () => ({}),
  ai: {},
  rng: () => 0,
  ...extra,
});

describe("runEggPrize", () => {
  it("AI 回包合规：按系统品阶落 AI 起名的物件与朵朵反应", async () => {
    let asked = null;
    withAIMock.impl = async (id, ctx) => {
      asked = { id, ctx };
      return { ok: true, data: { name: "铜铃小鼓", category: "misc", desc: "摇起来叮当作响。", mood: "small", reaction: "朵朵抢过去先摇了两下。" } };
    };
    const applied = [];
    const res = await runEggPrize("绿", baseOpts(applied, { canAsk: () => true }));
    expect(asked).toEqual({ id: "goldenEgg.prize", ctx: { quality: "绿" } });
    expect(res.item.name).toBe("铜铃小鼓");
    expect(res.item.quality).toBe("绿");
    expect(applied).toHaveLength(1);
    expect(applied[0].logs.map((l) => l.text).join("")).toContain("朵朵抢过去");
  });

  it("无 API 直接走奖池并配手写反应句", async () => {
    withAIMock.impl = async () => { throw new Error("should not call"); };
    const applied = [];
    const res = await runEggPrize("白", baseOpts(applied, { canAsk: () => false }));
    expect(res.prize).toBeTruthy();
    expect(applied[0].logs.at(-1).text).toContain("朵朵");
  });

  it("AI 抛错、回包不合规、名字为空，都退回奖池", async () => {
    for (const impl of [
      async () => { throw new Error("boom"); },
      async () => ({ ok: false, data: null }),
      async () => ({ ok: true, data: { name: "", category: "misc", desc: "", mood: "small", reaction: "" } }),
    ]) {
      withAIMock.impl = impl;
      const applied = [];
      const res = await runEggPrize("蓝", baseOpts(applied, { canAsk: () => true }));
      expect(res.prize).toBeTruthy();
      expect(applied).toHaveLength(1);
    }
  });

  it("回包到时存档已作废（读档/回滚）就什么都不落", async () => {
    let stale = false;
    withAIMock.impl = async () => { stale = true; return { ok: true, data: { name: "铜铃", category: "misc", desc: "", mood: "small", reaction: "" } }; };
    const applied = [];
    const res = await runEggPrize("绿", baseOpts(applied, { canAsk: () => true, isStale: () => stale }));
    expect(res).toBeNull();
    expect(applied).toHaveLength(0);
  });
});
