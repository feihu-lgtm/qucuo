import { describe, it, expect, vi } from "vitest";
import {
  COMPANION_CHATTER_CHANCE,
  STRONG_EVENT_WEIGHTS,
  eventChatterWeight,
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
      companionState: mkCs({ a: FOLL.a }), roomName: "天都镇", memory: createChatterMemory(),
      activity: { text: "打劫货商", intent: "STEAL" }, ask, rng: () => 0,
    });
    expect(out).toEqual({ speaker: "元朵朵", line: "这次买卖分红可别忘了本小姐！" });
    expect(ask).toHaveBeenCalledOnce();
  });

  it("无 API 走兜底——偷东西的活动类评价", async () => {
    const out = await companionChatterTick({
      companionState: mkCs({ a: FOLL.a }), memory: createChatterMemory(),
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

  it("不会说人话的同伴也走 AI，提示词写清开口方式", async () => {
    const cases = [
      ["墨团", { beast: true }, /灵兽/],
      ["铁伯", { mute: true }, /机关造物/],
      ["哑奴", { voice: "silent" }, /哑巴/],
    ];
    for (const [name, slot, rule] of cases) {
      const ask = vi.fn(async () => "（比划了一下。）");
      const cs = mkCs({ k: { ...c(name, { beast: slot.beast }), ...slot } });
      const out = await companionChatterTick({ companionState: cs, activity: {}, ask, rng: () => 0, memory: createChatterMemory() });
      expect(ask, name).toHaveBeenCalledOnce();
      expect(ask.mock.calls[0][0], name).toMatch(rule);
      expect(out).toEqual({ speaker: name, line: "（比划了一下。）" });
    }
  });

  it("没配 API 时：兽与机关用旧兜底句，哑巴随从不插话", async () => {
    const tick = (slot) => companionChatterTick({ companionState: mkCs({ k: slot }), activity: {}, rng: () => 0, memory: createChatterMemory() });
    expect((await tick(c("墨团", { beast: true }))).line).toMatch(/呜|尾巴/);
    expect((await tick({ ...c("铁伯"), mute: true })).line).toMatch(/机括|发条/);
    expect(await tick({ ...c("哑奴"), voice: "silent" })).toBeNull();
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

describe("V7b 事件加权+双人互怼（验收）", () => {
  it("强事件权重生效：切磋/赠送/偷盗权重 0.55~0.75，普通走路维持 0.2", () => {
    expect(eventChatterWeight({ intent: "DUEL" })).toBe(0.75);
    expect(eventChatterWeight({ intent: "GIFT" })).toBe(0.7);
    expect(eventChatterWeight({ intent: "STEAL" })).toBe(0.65);
    expect(eventChatterWeight({ intent: "TRADE" })).toBe(0.6);
    expect(eventChatterWeight({ intent: "COMBAT" })).toBe(0.55);
    expect(eventChatterWeight({ intent: "MOVE" })).toBe(COMPANION_CHATTER_CHANCE);
    expect(eventChatterWeight({ intent: "MOVE", newPlace: true })).toBe(0.65);
    expect(eventChatterWeight({ intent: "MOVE", setback: true })).toBe(0.6);
    // 权重落到实处：0.3 的 rng 在普通回合不开口，切磋回合开口
    const cs = mkCs({ a: FOLL.a });
    expect(pickChatter(cs, { rng: () => 0.3 })).toBeNull();
    expect(pickChatter(cs, { rng: () => 0.3, chance: STRONG_EVENT_WEIGHTS.DUEL })?.name).toBe("元朵朵");
  });

  it("双人接茬：装配两人关系档位与互涉心账进提示词，输出两句往来", async () => {
    let captured = "";
    const ask = vi.fn(async (sys, user) => {
      captured = user;
      return JSON.stringify({ lines: { 珍珠: "开饭了吗？", 雪豹: "闭嘴，有风。" }, bondDelta: 2 });
    });
    const cs = mkCs({
      pearl: c("珍珠", { beast: true }),
      snowLeopard: c("雪豹", { beast: true }),
    });
    cs.pearl.carriedItems = [];
    cs.snowLeopard.carriedItems = [];
    const state = { varTree: { 角色: {
      珍珠: { 心账: [{ summary: "与雪豹：抢食拌嘴" }] },
      雪豹: { 心账: [] },
    } } };
    const out = await companionChatterTick({
      companionState: cs, roomName: "鱼定村", memory: createChatterMemory(),
      activity: { text: "赶路", intent: "MOVE" }, ask, rng: () => 0, state,
    });
    expect(out.duo).toBe(true);
    expect(out.lines).toEqual([
      { speaker: "珍珠", text: "开饭了吗？" },
      { speaker: "雪豹", text: "闭嘴，有风。" },
    ]);
    expect(out.outcome.bondDelta).toBe(2);
    expect(captured).toMatch(/两人关系：生分/);
    expect(captured).toMatch(/抢食拌嘴/);
  });

  it("transfer 硬拦截：模型报的物品不在 from 携物里——applyDuoOutcome 拒绝且不造物", async () => {
    const { applyDuoOutcome } = await import("../../domain/rules/companion/companionBonds.js");
    const cs = {
      pearl: { label: "珍珠", data: { carriedItems: [{ name: "一袋青稞精料" }] } },
      snowLeopard: { label: "雪豹", data: { carriedItems: [] } },
    };
    const outcome = {
      bondDelta: 1,
      transfer: { from: "珍珠", to: "雪豹", itemName: "龙涎香" },
    };
    const res = applyDuoOutcome(cs, {}, "珍珠", "雪豹", outcome, {});
    expect(res.transferApplied).toBeNull();
    expect(res.transferRejected).toContain("不许凭空造物");
    // 绑定装备同样拦截
    const res2 = applyDuoOutcome(
      { pearl: { label: "珍珠", data: { carriedItems: [{ name: "藏纹小马鞍", bound: true }] } }, snowLeopard: { label: "雪豹", data: { carriedItems: [] } } },
      {}, "珍珠", "雪豹",
      { transfer: { from: "珍珠", to: "雪豹", itemName: "藏纹小马鞍" } }, {},
    );
    expect(res2.transferApplied).toBeNull();
    expect(res2.transferRejected).toContain("绑定装备");
  });

  it("双人离线兜底：无 API 也有两句对口词", async () => {
    const cs = mkCs({ pearl: c("珍珠", { beast: true }), snowLeopard: c("雪豹", { beast: true }) });
    const out = await companionChatterTick({
      companionState: cs, memory: createChatterMemory(),
      activity: { text: "赶路", intent: "MOVE" }, rng: () => 0,
    });
    expect(out.duo).toBe(true);
    expect(out.lines).toHaveLength(2);
    expect(out.lines[0].text.length).toBeGreaterThan(0);
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

describe("冒险者和随从入队后两个人都会插话", () => {
  it("主人与随从都在插话池里，开口方式按随从类型", async () => {
    const { unlockImportedCompanion, unlockFollowerCompanion } = await import("../../domain/rules/companion/companion.js");
    const { ADVENTURER_POOL } = await import("../../domain/data/dungeon/adventurers.js");
    const { ADVENTURER_POOL_IP } = await import("../../domain/data/dungeon/adventurersIP.js");
    const pool = [...ADVENTURER_POOL, ...ADVENTURER_POOL_IP];
    const voices = {};
    for (const followerName of ["铁伯", "阿财", "哑奴", "醉花"]) {
      const owner = pool.find((a) => a.follower?.name === followerName);
      const cs = unlockFollowerCompanion(unlockImportedCompanion({}, { name: owner.name, levelCap: 1 }), owner);
      const chatters = eligibleChatters(cs);
      expect(chatters.map((w) => w.name).sort()).toEqual([owner.name, followerName].sort());
      voices[followerName] = chatters.find((w) => w.name === followerName).voice;
    }
    expect(voices).toEqual({ 铁伯: "mechanical", 阿财: "beast", 哑奴: "silent", 醉花: "human" });
    expect(chatterFallback({ voice: "silent" }, () => 0)).toBeNull();
  });
});
