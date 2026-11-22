import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRngState, setRngState, setSeed } from "../../infra/rng.js";
import {
  applyPigeonReply,
  buyPigeon,
  collectPigeons,
  failPigeonReply,
  pigeonDelayShichen,
  processPigeons,
  recordPigeonNpcLocations,
  sendPigeonLetter,
} from "./logic.js";

let previousRngState;

beforeEach(() => {
  previousRngState = getRngState();
});

afterEach(() => {
  setRngState(previousRngState);
});

const makeState = (overrides = {}) => ({
  char: { name: "少侠", money: 50, pigeons: 1 },
  flags: [],
  inv: [{ name: "礼物", category: "misc" }],
  room: { name: "鱼定村", npcs: [] },
  time: 0,
  varTree: { 角色: {}, 世界: {} },
  ...overrides,
});

describe("pigeon send logic", () => {
  it("sends a letter, consumes a pigeon, queues its arrival, and registers its fact", () => {
    const state = makeState({
      time: 4,
      varTree: { 角色: { 商人: { 所在地: "鱼定村" } }, 世界: {} },
    });
    const result = sendPigeonLetter(state, "商人", "  请回信  ");
    const nextVarTree = result.changes.varTree(state.varTree);

    expect(result.sent).toBe(true);
    expect(result.changes.char(state.char)).toEqual({ ...state.char, pigeons: 0 });
    expect(result.changes.time).toBe(5);
    expect(nextVarTree.角色.商人.飞鸽).toEqual([
      { dir: "send", content: "请回信", turn: 4, gift: undefined },
    ]);
    expect(nextVarTree.世界.飞鸽待回).toEqual([
      {
        id: "letter_send_商人_4",
        npcName: "商人",
        sentContent: "请回信",
        arriveTime: 6,
        npcLoc: "鱼定村",
        channel: "pigeon",
        giftName: null,
      },
    ]);
    expect(nextVarTree.世界.知识领域.事实.letter_send_商人_4).toMatchObject({
      标签: "飞鸽传书",
      知晓者: { 商人: { 途径: "亲历", 得知回合: 4 } },
    });
    expect(result.logs.map((entry) => entry.text)).toEqual([
      "> 飞鸽传书致「商人」：请回信",
      "  🕊 信鸽已放飞，往「鱼定村」，约 1 个时辰后当有回音。",
    ]);
    expect(result.note).toMatchObject({
      owner: [{ name: "商人", via: "亲历" }],
      source: "pigeon",
    });
  });

  it("preserves recipient, content, and pigeon-count refusals", () => {
    const state = makeState();
    expect(sendPigeonLetter(state, null, "请回信")).toEqual({
      logs: [{ t: "sys", text: "  未指定收信之人。" }],
    });
    expect(sendPigeonLetter(state, "商人", "  ")).toEqual({
      logs: [{ t: "sys", text: "  信笺空空，无从落笔。" }],
    });
    expect(sendPigeonLetter(makeState({ char: { pigeons: 0 } }), "商人", "请回信")).toEqual({
      logs: [{ t: "sys", text: "  你手头没有信鸽——去驿站买鸽子，或直接到驿站寄信。" }],
    });
  });

  it("removes a post-station gift from inventory without consuming a pigeon", () => {
    const state = makeState();
    const result = sendPigeonLetter(state, "商人", "请收下", { channel: "postgift", gift: "礼物" });

    expect(result.changes.inv(state.inv)).toEqual([]);
    expect(result.changes).not.toHaveProperty("char");
    expect(result.logs[0].text).toBe("> 驿站送礼致「商人」：请收下（附礼：礼物）");
  });

  it("calculates the arrival delay and processes the letter only when its time is reached", () => {
    const state = makeState({ time: 8 });
    expect(pigeonDelayShichen(state, "陌生人")).toEqual({ delay: 1, loc: "鱼定村" });
    const result = sendPigeonLetter(state, "陌生人", "回信");
    const nextVarTree = result.changes.varTree(state.varTree);
    const letter = nextVarTree.世界.飞鸽待回[0];

    expect(processPigeons({ ...state, time: letter.arriveTime - 1, varTree: nextVarTree })).toEqual([]);
    expect(processPigeons({ ...state, time: letter.arriveTime, varTree: nextVarTree })).toEqual([letter]);
  });

  it("records the last known location of NPCs without replacing unrelated state", () => {
    const state = makeState({
      room: { name: "鱼定村", npcs: [{ name: "商人" }] },
      varTree: { 角色: {}, 世界: { 保留: true } },
    });
    const result = recordPigeonNpcLocations(state);
    const next = result.changes.varTree(state.varTree);

    expect(next.角色.商人.所在地).toBe("鱼定村");
    expect(next.世界).toEqual({ 保留: true });
    expect(recordPigeonNpcLocations({ ...state, varTree: next })).toEqual({});
  });
});

describe("pigeon purchase and collection logic", () => {
  it("buys pigeons only when the player has enough money", () => {
    expect(buyPigeon(makeState({ char: { money: 20, pigeons: 2 } }), 2, 12)).toEqual({
      logs: [{ t: "sys", text: "  银两不够，买不起这些鸽子。" }],
    });
    const result = buyPigeon(makeState({ char: { money: 30, pigeons: 2 } }), 2, 12);
    expect(result.changes.char({ money: 30, pigeons: 2 })).toEqual({ money: 6, pigeons: 4 });
  });

  it("collects pigeons once per day and preserves flags for other systems", () => {
    const state = makeState({ char: { pigeons: 1 }, flags: ["other_flag", "pigeon_collected_day_2"] });
    expect(collectPigeons(state, { qty: 3, dayIdx: 2 })).toEqual({});
    const result = collectPigeons(state, { qty: 3, dayIdx: 3 });
    expect(result.changes.char(state.char)).toEqual({ pigeons: 4 });
    expect(result.changes.flags(state.flags)).toEqual(["pigeon_collected_day_3", "other_flag"]);
  });
});

describe("pigeon reply logic", () => {
  it("keeps old in-flight save entries processable and completes their reply", () => {
    const legacyLetter = {
      id: "legacy-letter",
      npcName: "商人",
      sentContent: "请回信",
      arriveTime: 2,
      npcLoc: "鱼定村",
    };
    const state = makeState({
      time: 2,
      varTree: { 角色: { 商人: { 好感度: 10, 飞鸽: [] } }, 世界: { 飞鸽待回: [legacyLetter] } },
    });
    expect(processPigeons(state)).toEqual([legacyLetter]);

    const result = applyPigeonReply(state, legacyLetter, "我已收到。⟦好感+2⟧");
    const next = result.changes.varTree(state.varTree);
    expect(next.角色.商人).toMatchObject({
      好感度: 12,
      飞鸽: [{ dir: "reply", content: "我已收到。", turn: 2 }],
    });
    expect(next.世界.飞鸽待回).toEqual([]);
    expect(next.世界.知识领域.事实.letter_reply_商人_2).toBeDefined();
  });

  it("grants eligible return gifts with seeded quality and removes delivered letters", () => {
    setSeed(7);
    const letter = {
      id: "gift-letter",
      npcName: "商人",
      sentContent: "礼物请收下",
      arriveTime: 6,
      channel: "postgift",
      giftName: "茶叶",
    };
    const state = makeState({
      time: 6,
      inv: [],
      varTree: { 角色: { 商人: { 好感度: 49, 飞鸽: [] } }, 世界: { 飞鸽待回: [letter] } },
    });
    const result = applyPigeonReply(state, letter, "多谢厚意。⟦好感+2⟧⟦回礼:念珠|misc⟧");
    const next = result.changes.varTree(state.varTree);
    const items = result.changes.inv(state.inv);

    expect(next.角色.商人).toMatchObject({ 好感度: 51, 飞鸽: [{ gift: "念珠" }] });
    expect(next.世界.飞鸽待回).toEqual([]);
    expect(items[0]).toMatchObject({ name: "念珠", category: "misc", quality: expect.stringMatching(/^(白|绿)$/) });
    expect(result.logs.at(-1).text).toContain("随信附回礼");
  });

  it("removes a letter and logs a lost-mail result when AI generation fails", () => {
    const letter = { id: "failed-letter", npcName: "商人" };
    const result = failPigeonReply(
      makeState({ varTree: { 角色: {}, 世界: { 飞鸽待回: [letter] } } }),
      letter,
    );
    expect(result.changes.varTree({ 角色: {}, 世界: { 飞鸽待回: [letter] } }).世界.飞鸽待回).toEqual([]);
    expect(result.logs).toEqual([
      { t: "sys", text: "  （寄往商人的信鸽半途迷了路，这封回信终未送达。）" },
    ]);
  });
});
