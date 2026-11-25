// 金鸟金蛋：游戏日界（time/24）/ 加权奖池各档 / 物品带价入行囊 / 兜底句 / 卡券强开档。
import { describe, it, expect } from "vitest";
import { claimGoldenEgg } from "./goldenEgg.js";
import {
  GOLDEN_EGG_POOL, GOLDEN_EGG_STATE_KEY, INTIMATE_TICKET_NAME,
  eggAlreadyClaimed, eggGameDay, eggFallbackLine, eggReactionPrompt, eggTier, rollGoldenEgg,
} from "../../domain/rules/npc/goldenEgg.js";
import { intimateTicketNote } from "../../domain/rules/npc/intimacy.js";
import { CATALOG_INDEX } from "../../domain/data/items/catalog.js";

const duoduo = { name: "元朵朵" };

// rng 钉到指定奖池条目（落在该条权重区间的开头）。
const rngFor = (id) => {
  const total = GOLDEN_EGG_POOL.reduce((s, e) => s + e.weight, 0);
  let acc = 0;
  for (const e of GOLDEN_EGG_POOL) {
    if (e.id === id) return () => (acc + e.weight * 0.5) / total;
    acc += e.weight;
  }
  throw new Error(`unknown pool id ${id}`);
};

describe("eggGameDay / 日界", () => {
  it("游戏日 = floor(time/24)：同日被拦，过了 24 的整数倍可再领", () => {
    expect(eggGameDay(0)).toBe(0);
    expect(eggGameDay(23.5)).toBe(0);
    expect(eggGameDay(24)).toBe(1);
    const npcState = { [GOLDEN_EGG_STATE_KEY]: { lastDay: eggGameDay(30) } };
    expect(eggAlreadyClaimed(npcState, 30)).toBe(true);
    expect(eggAlreadyClaimed(npcState, 47.9)).toBe(true);
    expect(eggAlreadyClaimed(npcState, 48)).toBe(false);
  });

  it("旧档按真实日期存的 lastDate 不挡今天", () => {
    const npcState = { [GOLDEN_EGG_STATE_KEY]: { lastDate: "2026-11-23" } };
    expect(eggAlreadyClaimed(npcState, 30)).toBe(false);
  });
});

describe("claimGoldenEgg", () => {
  it("只认元朵朵", () => {
    const res = claimGoldenEgg({}, { name: "张三" });
    expect(res.logs[0].t).toBe("err");
  });

  it("同一游戏日重复领被拦，不动状态", () => {
    const state = { time: 30, npcState: { [GOLDEN_EGG_STATE_KEY]: { lastDay: 1 } } };
    const res = claimGoldenEgg(state, duoduo);
    expect(res.claimed).toBe(true);
    expect(res.changes).toBeUndefined();
    expect(res.logs.map((l) => l.text).join("")).toContain("一天只来一趟");
  });

  it("时间推进过下一个 24 的整数倍后可再领，之前不行", () => {
    const first = claimGoldenEgg({ time: 30 }, duoduo, { rng: rngFor("coin_small") });
    const npcState = first.changes.npcState({});
    expect(claimGoldenEgg({ time: 47, npcState }, duoduo).claimed).toBe(true);
    const next = claimGoldenEgg({ time: 48, npcState }, duoduo, { rng: rngFor("coin_small") });
    expect(next.claimed).toBeUndefined();
    expect(next.prize).toBeTruthy();
  });

  it("开奖写 npcState 签到日（存档链字段，读档不丢）", () => {
    const res = claimGoldenEgg({ time: 57 }, duoduo, { rng: rngFor("coin_small") });
    const next = res.changes.npcState({});
    expect(next[GOLDEN_EGG_STATE_KEY].lastDay).toBe(2);
  });

  it("银两档直加钱", () => {
    const res = claimGoldenEgg({}, duoduo, { rng: rngFor("coin_mid") });
    expect(res.changes.char({ money: 5 })).toEqual({ money: 15 });
  });

  it("物品档入 inv 且带 buyPrice/sellPrice（可卖回朵朵店）", () => {
    const state = { inv: [{ name: "旧物" }] };
    const res = claimGoldenEgg(state, duoduo, { rng: rngFor("it_candy") });
    const item = res.changes.inv.at(-1);
    expect(item.name).toBe("松子糖");
    expect(item.buyPrice).toBeGreaterThan(0);
    expect(item.sellPrice).toBeGreaterThan(0);
    expect(item.goldenEgg).toBe(true);
    expect(res.changes.inv).toHaveLength(2);
    expect(res.logs.map((l) => l.text).join("")).toContain("已入行囊");
  });
});

describe("奖池各档", () => {
  it("权重表完整且每个 itemName 命中 catalog", () => {
    expect(GOLDEN_EGG_POOL.length).toBeGreaterThanOrEqual(9);
    for (const e of GOLDEN_EGG_POOL.filter((x) => x.kind === "item")) {
      expect(CATALOG_INDEX[e.itemName], e.itemName).toBeTruthy();
    }
  });

  it.each([
    ["coin_small", "small"], ["coin_big", "jackpot"], ["it_pingankou", "small"],
    ["it_jade", "jackpot"], ["it_fake", "blush"], ["it_ticket", "jackpot"], ["empty", "empty"],
  ])("%s → %s", (id, tier) => {
    const res = claimGoldenEgg({}, duoduo, { rng: rngFor(id) });
    expect(res.prize.id).toBe(id);
    expect(res.tier).toBe(tier);
  });

  it("空蛋不给钱不给物", () => {
    const res = claimGoldenEgg({}, duoduo, { rng: rngFor("empty") });
    expect(res.changes.char).toBeUndefined();
    expect(res.changes.inv).toBeUndefined();
  });
});

describe("朵朵反应", () => {
  it("反应 prompt 按档喂演法（blush 档含羞到跳脚）", () => {
    const { sys, user } = eggReactionPrompt({ prize: { label: "假阳具" }, tier: "blush" });
    expect(sys).toContain("元朵朵");
    expect(user).toContain("假阳具");
    expect(user).toMatch(/羞|脸红/);
  });

  it("兜底句按档随机且提朵朵", () => {
    for (const tier of ["jackpot", "small", "blush", "empty"]) {
      expect(eggFallbackLine(tier, () => 0)).toContain("朵朵");
    }
  });

});

describe("女眷一次卡·不可拒绝", () => {
  it("「亲自」类日常词不判亲密，亲吻族仍命中", async () => {
    const { isIntimateInput } = await import("../../domain/rules/prompt/inputIntent.js");
    for (const bad of ["我亲自去过锦官城", "她父亲来看她", "亲信来报", "亲王的车驾", "口吻温和", "吻合"]) {
      expect(isIntimateInput(bad), bad).toBe(false);
    }
    for (const good of ["亲吻元朵朵", "搂她入怀", "亲一口", "跟她亲热"]) {
      expect(isIntimateInput(good), good).toBe(true);
    }
  });

  it("焚卡步骤只在 commit 成功消耗一张", async () => {
    const { burnIntimateTicket } = await import("../../engine/act/postCommit/intimateTicket.js");
    expect(burnIntimateTicket({ intimateTicket: null })).toBeNull();
    const card = { name: INTIMATE_TICKET_NAME };
    const res = burnIntimateTicket({ intimateTicket: "铁伯" });
    expect(res.changes.inv([card, card, { name: "旧物" }])).toHaveLength(2);
    expect(res.logs.map((l) => l.text).join("")).toContain("无人能拒");
  });

  it("catalog 有词条（红档，带价）", () => {
    const entry = CATALOG_INDEX[INTIMATE_TICKET_NAME];
    expect(entry.quality).toBe("红");
  });

  it("强开注入行：含凭卡说明，附 nsfw 与画风", () => {
    const note = intimateTicketNote({ name: "铁伯", intimacy: { forbidden: true }, nsfw: "【nsfw】造物无情人有情。" });
    expect(note).toContain("凭「女眷一次卡·不可拒绝」强开");
    expect(note).toContain("无从推拒");
    expect(note).toContain("造物无情人有情");
  });
});
