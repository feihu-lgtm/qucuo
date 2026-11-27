// 金鸟金蛋：游戏日界（time/24）/ 加权奖池各档 / 物品带价入行囊 / 兜底句 / 卡券强开档。
import { describe, it, expect } from "vitest";
import { claimGoldenEgg, eggSignInChange, openGoldenEgg, settleAiEggPrize } from "./goldenEgg.js";
import {
  GOLDEN_EGG_POOL, GOLDEN_EGG_STATE_KEY, INTIMATE_TICKET_NAME,
  eggAlreadyClaimed, eggGameDay, eggFallbackLine, eggTier, rollGoldenEgg,
  EGG_CATALOG_PICKS, EGG_PRIZE_SCHEMA, eggPrizePrompt, parseEggPrize,
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

describe("AI 自由开奖", () => {
  it("openGoldenEgg 掷品阶、只落开场两行，不发奖不记账（签到账后移到奖品落账帧——防存档截在中间丢奖）", () => {
    const res = openGoldenEgg({ time: 30, char: { special: { 气运: 5 } } }, duoduo, { quality: "蓝" });
    expect(res.quality).toBe("蓝");
    expect(res.logs).toHaveLength(2);
    expect(res.changes.inv).toBeUndefined();
    expect(res.changes.char).toBeUndefined();
    expect(res.changes.npcState).toBeUndefined();
    expect(eggSignInChange({ time: 30 })({})[GOLDEN_EGG_STATE_KEY].lastDay).toBe(1);
  });

  it("claimGoldenEgg 一步开完路径含签到账（npcState lastDay）", () => {
    const res = claimGoldenEgg({ time: 30, inv: [], char: { money: 0 } }, duoduo, { rng: () => 0.5 });
    expect(res.changes.npcState({})[GOLDEN_EGG_STATE_KEY].lastDay).toBe(1);
  });

  it("openGoldenEgg 不传品阶时按气运掷，取值落在六档内", () => {
    const res = openGoldenEgg({ time: 0, char: { special: { 气运: 10 } } }, duoduo);
    expect(["白", "绿", "蓝", "紫", "橙", "红"]).toContain(res.quality);
  });

  it("同日再开被拦、非朵朵报错，都不掷品阶", () => {
    const npcState = { [GOLDEN_EGG_STATE_KEY]: { lastDay: 1 } };
    expect(openGoldenEgg({ time: 30, npcState }, duoduo).quality).toBeUndefined();
    expect(openGoldenEgg({}, { name: "张三" }).quality).toBeUndefined();
  });

  it("AI 新起名的物件按系统品阶算数值与价格，函数式叠进最新行囊", () => {
    const res = settleAiEggPrize({ name: "雪鸮翎扇", category: "accessory", desc: "扇骨里藏着一根白翎。", mood: "small", reaction: "朵朵哼了一声，说这扇子本来要留给自己。" }, "紫");
    expect(res.item.name).toBe("雪鸮翎扇");
    expect(res.item.quality).toBe("紫");
    expect(res.item.goldenEgg).toBe(true);
    expect(res.item.buyPrice).toBeGreaterThan(0);
    expect(res.changes.inv([{ name: "旧物" }]).map((i) => i.name)).toEqual(["旧物", "雪鸮翎扇"]);
    const text = res.logs.map((l) => l.text).join("");
    expect(text).toContain("雪鸮翎扇");
    expect(text).toContain("朵朵哼了一声");
  });

  it("AI 照抄现成物件名时数值以物件志为准", () => {
    const res = settleAiEggPrize({ name: "金疮药", category: "weapon", desc: "", mood: "small", reaction: "" }, "红");
    const catalog = CATALOG_INDEX["金疮药"];
    expect(res.item.category).toBe(catalog.category);
    expect(res.item.quality).toBe(catalog.quality || res.item.quality);
    expect(res.item.quality).not.toBe("红");
  });

  it("现成物件名单不含情趣物与卡券，且都在物件志里", () => {
    expect(EGG_CATALOG_PICKS).not.toContain(INTIMATE_TICKET_NAME);
    expect(EGG_CATALOG_PICKS).not.toContain("假阳具");
    for (const name of EGG_CATALOG_PICKS) expect(CATALOG_INDEX[name], name).toBeTruthy();
  });

  it("提示词带上系统品阶与现成物件，schema 五键全必填", () => {
    const { sys, user } = eggPrizePrompt({ quality: "橙" });
    expect(sys).toContain("元朵朵");
    expect(user).toContain("橙");
    expect(user).toContain("松子糖");
    expect(EGG_PRIZE_SCHEMA.schema.required).toEqual(Object.keys(EGG_PRIZE_SCHEMA.schema.properties));
  });

  it("parseEggPrize 裁长度、去引号、非法枚举归位，空名判无效", () => {
    expect(parseEggPrize(null)).toBeNull();
    expect(parseEggPrize({ name: "  " })).toBeNull();
    const p = parseEggPrize({ name: "「一二三四五六七八九十十一十二」", category: "food", desc: "x\ny", mood: "huge", reaction: "r" });
    expect(p.name).not.toMatch(/[「」]/);
    expect(p.name.length).toBeLessThanOrEqual(12);
    expect(p.category).toBe("misc");
    expect(p.mood).toBe("small");
    expect(p.desc).toBe("x y");
  });
});
