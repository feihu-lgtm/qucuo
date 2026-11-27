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
  rng: () => 0.5,
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
    expect(asked).toEqual({ id: "goldenEgg.prize", ctx: { quality: "绿", forced: null } });
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
    expect(applied[0].logs.at(-1).text.length).toBeGreaterThan(4); // 手写反应句收尾（tier 句随机，不断言具体措辞）
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

describe("情趣物+卡券系统侧 7.5% 约束", () => {
  it("rollEggSpecial 边界：<7.5% 假阳具、7.5%~15% 卡券、其余 null", async () => {
    const { rollEggSpecial } = await import("../../domain/rules/npc/goldenEgg.js");
    expect(rollEggSpecial(() => 0.0)).toBe("假阳具");
    expect(rollEggSpecial(() => 0.0749)).toBe("假阳具");
    expect(rollEggSpecial(() => 0.075)).toBe("女眷一次卡·不可拒绝");
    expect(rollEggSpecial(() => 0.1499)).toBe("女眷一次卡·不可拒绝");
    expect(rollEggSpecial(() => 0.15)).toBeNull();
    expect(rollEggSpecial(() => 0.9)).toBeNull();
  });

  it("命中卡券档：prompt 带 forced 且回包名字被系统强校为卡券（AI 乱起名也不顶包）", async () => {
    let asked = null;
    withAIMock.impl = async (id, ctx) => {
      asked = { id, ctx };
      return { ok: true, data: { name: "瞎起的名", category: "misc", desc: "", mood: "small", reaction: "朵朵肉疼。" } };
    };
    const applied = [];
    // rng 序列：第一次（rollEggSpecial）0.1 → 卡券档
    const res = await runEggPrize("紫", baseOpts(applied, { canAsk: () => true, rng: () => 0.1 }));
    expect(asked.ctx.forced).toBe("女眷一次卡·不可拒绝");
    expect(res.item.name).toBe("女眷一次卡·不可拒绝");
    expect(res.fact).toBeTruthy();
    expect(res.fact.摘要).toContain("女眷一次卡·不可拒绝");
  });

  it("命中假阳具档且 AI 失败：不退回奖池（守住 7.5%），手写羞态兜底落该件", async () => {
    withAIMock.impl = async () => { throw new Error("boom"); };
    const applied = [];
    const res = await runEggPrize("白", baseOpts(applied, { canAsk: () => true, rng: () => 0.01 }));
    expect(res.item.name).toBe("假阳具");
    expect(applied[0].logs.map((l) => l.text).join("")).toContain("朵朵");
  });

  it("开奖结果挂 fact 入记忆链：元朵朵目击知情", async () => {
    withAIMock.impl = async () => ({ ok: true, data: { name: "铜铃", category: "misc", desc: "", mood: "small", reaction: "" } });
    const applied = [];
    const res = await runEggPrize("绿", baseOpts(applied, {
      canAsk: () => true,
      getState: () => ({ inv: [], char: { money: 0 }, time: 25, room: { npcs: [{ name: "元朵朵" }, { name: "路人甲" }] } }),
    }));
    expect(res.fact.标签).toBe("金蛋");
    expect(res.fact.知晓者.some((k) => k.name === "元朵朵" && k.途径 === "目击")).toBe(true);
    expect(res.fact.知晓者.some((k) => k.name === "路人甲")).toBe(true);
  });

  it("兜底奖池路径也挂 fact", async () => {
    withAIMock.impl = async () => { throw new Error("should not call"); };
    const applied = [];
    await runEggPrize("白", baseOpts(applied, { canAsk: () => false }));
    expect(applied[0].fact).toBeTruthy();
    expect(applied[0].fact.标签).toBe("金蛋");
  });
});
