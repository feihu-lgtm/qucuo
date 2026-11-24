import { describe, it, expect, vi } from "vitest";
import {
  COMPANION_CHATTER_CHANCE,
  eligibleChatters,
  pickChatter,
  chatterFallback,
  companionChatterTick,
  companionReunionLine,
} from "./companionChatter.js";

const mkCs = (entries) => ({ ...entries });
const c = (name, opts = {}) => ({ unlocked: true, label: name, data: { name, personality: opts.personality || "" }, beast: !!opts.beast, stationed: opts.stationed });

const FOLL = {
  a: c("元朵朵", { personality: "迷之自信·商业奇才妄想、娇憨仗义" }),
  b: c("雪豹", { beast: true }),
};

describe("eligibleChatters：随行=解锁且未留守", () => {
  it("留守同伴不进插话池，随行/兽类/随从都在", () => {
    const cs = mkCs({ ...FOLL, s: { ...c("阿香"), stationed: { district: "天都镇", roomId: "客栈" } } });
    const names = eligibleChatters(cs).map((w) => w.name).sort();
    expect(names).toEqual(["元朵朵", "雪豹"]);
  });
});

describe("pickChatter：概率触发可打桩", () => {
  it("rng 打桩：低于阈值才开口", () => {
    const cs = mkCs(FOLL);
    expect(pickChatter(cs, { rng: () => COMPANION_CHATTER_CHANCE + 0.01 })).toBeNull();
    expect(pickChatter(cs, { rng: () => 0.01 }).name).toBe("元朵朵");
  });
});

describe("companionChatterTick：评价玩家活动，AI 优先 + 兜底", () => {
  const rngSeq = (n) => { let i = 0; const vals = Array.isArray(n) ? n : [n]; return () => vals[i++ % vals.length]; };

  it("AI 句原样产出 {speaker,line}", async () => {
    const ask = vi.fn(async () => "这次买卖分红可别忘了本小姐！");
    const out = await companionChatterTick({
      companionState: mkCs(FOLL), roomName: "天都镇",
      activity: { text: "打劫货商", intent: "STEAL" }, ask, rng: () => 0,
    });
    expect(out).toEqual({ speaker: "元朵朵", line: "这次买卖分红可别忘了本小姐！" });
    expect(ask).toHaveBeenCalledOnce();
  });

  it("无 API 走兜底——偷东西的活动类评价", async () => {
    const out = await companionChatterTick({
      companionState: mkCs(FOLL),
      activity: { text: "偷她荷包", intent: "STEAL" }, rng: () => 0,
    });
    expect(out.speaker).toBe("元朵朵");
    expect(out.line).toMatch(/手脚|营生/);
  });

  it("兽类只出声不调用 AI", async () => {
    const ask = vi.fn();
    const out = await companionChatterTick({ companionState: mkCs({ b: FOLL.b }), activity: {}, ask, rng: () => 0 });
    expect(ask).not.toHaveBeenCalled();
    expect(out.line).toMatch(/呜|尾巴|机括/);
  });

  it("没人随行/概率未中 → null", async () => {
    expect(await companionChatterTick({ companionState: {}, rng: () => 0 })).toBeNull();
    expect(await companionChatterTick({ companionState: mkCs(FOLL), rng: () => 0.99 })).toBeNull();
  });
});

describe("companionReunionLine：留守时长+好感演开口第一句", () => {
  const stationedCs = (since) => mkCs({ a: { ...FOLL.a, stationed: { district: "天都镇", roomId: "客栈", since } } });

  it("丢久了幽怨（兜底）", async () => {
    const out = await companionReunionLine({ companionState: stationedCs(0), slotKey: "a", favor: 80, now: 24 * 5 });
    expect(out.dayCount).toBe(5);
    expect(out.line).toMatch(/天/);
  });

  it("刚留守开心接你（兜底）", async () => {
    const out = await companionReunionLine({ companionState: stationedCs(99), slotKey: "a", favor: 80, now: 99 });
    expect(out.dayCount).toBe(0);
    expect(out.line).toMatch(/回来/);
  });

  it("AI 句携带留守天数与好感进上下文", async () => {
    const ask = vi.fn(async () => "哼，五天不见人影，亏你还记得我。");
    const out = await companionReunionLine({ companionState: stationedCs(10), slotKey: "a", favor: 55, now: 10 + 24 * 5, ask });
    expect(out.line).toBe("哼，五天不见人影，亏你还记得我。");
    expect(ask.mock.calls[0][1]).toMatch(/5天.*55/s);
  });

  it("未解锁槽位 → null", async () => {
    expect(await companionReunionLine({ companionState: {}, slotKey: "a", favor: 0, now: 0 })).toBeNull();
  });
});
