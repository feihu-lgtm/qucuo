import { describe, it, expect, vi } from "vitest";
import {
  COMPANION_CHATTER_CHANCE,
  CHATTER_COOLDOWN_TURNS,
  CHATTER_GAP_TURNS,
  createChatterMemory,
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
  it("AI 句原样产出 {speaker,line}", async () => {
    const ask = vi.fn(async () => "这次买卖分红可别忘了本小姐！");
    const out = await companionChatterTick({
      companionState: mkCs(FOLL), roomName: "天都镇", memory: createChatterMemory(),
      activity: { text: "打劫货商", intent: "STEAL" }, ask, rng: () => 0,
    });
    expect(out).toEqual({ speaker: "元朵朵", line: "这次买卖分红可别忘了本小姐！" });
    expect(ask).toHaveBeenCalledOnce();
  });

  it("无 API 走兜底——偷东西的活动类评价", async () => {
    const out = await companionChatterTick({
      companionState: mkCs(FOLL), memory: createChatterMemory(),
      activity: { text: "偷她荷包", intent: "STEAL" }, rng: () => 0,
    });
    expect(out.speaker).toBe("元朵朵");
    expect(out.line).toMatch(/手脚|营生/);
  });

  it("雪豹/珍珠已化形：按人说话，走 AI；兜底是各自的人话句库而非兽声", async () => {
    const ask = vi.fn(async () => "前面有风。");
    const cs = mkCs({ snowLeopard: c("雪豹", { beast: true }) });
    const out = await companionChatterTick({ companionState: cs, activity: {}, ask, rng: () => 0, memory: createChatterMemory() });
    expect(ask).toHaveBeenCalledOnce();
    expect(out).toEqual({ speaker: "雪豹", line: "前面有风。" });
    expect(ask.mock.calls[0][1]).toMatch(/雪豹化形/);

    const pearl = eligibleChatters(mkCs({ pearl: c("珍珠", { beast: true }) }))[0];
    expect(pearl.voice).toBe("human");
    expect(chatterFallback(pearl, () => 0.99, "NONE")).toMatch(/“/);
  });

  it("没化形的真兽只出声不调用 AI", async () => {
    const ask = vi.fn();
    const out = await companionChatterTick({ companionState: mkCs({ panda: c("墨团", { beast: true }) }), activity: {}, ask, rng: () => 0, memory: createChatterMemory() });
    expect(ask).not.toHaveBeenCalled();
    expect(out.line).toMatch(/呜|尾巴/);
  });

  it("铁伯（mute 机关人偶）只出机括声，不调用 AI", async () => {
    const ask = vi.fn();
    const cs = mkCs({ imported_铁伯: { ...c("铁伯"), mute: true } });
    const out = await companionChatterTick({ companionState: cs, activity: {}, ask, rng: () => 0, memory: createChatterMemory() });
    expect(ask).not.toHaveBeenCalled();
    expect(out.speaker).toBe("铁伯");
    expect(out.line).toMatch(/机括|发条|黄玉/);
  });

  it("没人随行/概率未中 → null", async () => {
    expect(await companionChatterTick({ companionState: {}, rng: () => 0, memory: createChatterMemory() })).toBeNull();
    expect(await companionChatterTick({ companionState: mkCs(FOLL), rng: () => 0.99, memory: createChatterMemory() })).toBeNull();
  });
});

describe("开口节奏：只从随行队友里抽，全队间隔 + 个人冷却", () => {
  const tick = (cs, memory) => companionChatterTick({ companionState: cs, activity: {}, rng: () => 0, memory });

  it("留守的永远不开口", async () => {
    const cs = mkCs({ a: c("元朵朵"), s: { ...c("阿香"), stationed: { district: "天都镇" } } });
    const memory = createChatterMemory();
    const speakers = new Set();
    for (let i = 0; i < 60; i++) {
      const out = await tick(cs, memory);
      if (out) speakers.add(out.speaker);
    }
    expect([...speakers]).toEqual(["元朵朵"]);
  });

  it("同一人两次开口至少隔 COOLDOWN 回合，全队任意两句至少隔 GAP 回合", async () => {
    const cs = mkCs({ a: c("元朵朵"), b: c("阿香") });
    const memory = createChatterMemory();
    const spoke = [];
    for (let turn = 1; turn <= 80; turn++) {
      const out = await tick(cs, memory);
      if (out) spoke.push({ turn, who: out.speaker });
    }
    expect(spoke.length).toBeGreaterThan(2);
    for (let i = 1; i < spoke.length; i++) {
      expect(spoke[i].turn - spoke[i - 1].turn).toBeGreaterThanOrEqual(CHATTER_GAP_TURNS);
    }
    for (const who of ["元朵朵", "阿香"]) {
      const turns = spoke.filter((s) => s.who === who).map((s) => s.turn);
      for (let i = 1; i < turns.length; i++) expect(turns[i] - turns[i - 1]).toBeGreaterThanOrEqual(CHATTER_COOLDOWN_TURNS);
    }
  });

  it("冷却中的人不会被抽到：只剩一位且在冷却里 → 无人开口", () => {
    const cs = mkCs({ a: c("元朵朵") });
    const memory = { turn: 5, lastAny: 5 - CHATTER_GAP_TURNS, last: { a: 5 - CHATTER_COOLDOWN_TURNS + 1 } };
    expect(pickChatter(cs, { rng: () => 0, memory })).toBeNull();
    memory.last.a = 5 - CHATTER_COOLDOWN_TURNS;
    expect(pickChatter(cs, { rng: () => 0, memory })?.name).toBe("元朵朵");
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
