import { describe, expect, it, vi } from "vitest";
import { ESCORT_QUESTS } from "../../domain/data/quests/escortQuests.js";
import { setSeed } from "../../infra/rng.js";
import { VIA } from "../../domain/rules/memory/note.js";
import {
  describeGiftForPrompt,
  giftNpc,
  lookNpc,
  recognizeNpc,
  settleNpcDuel,
  stealFromNpc,
  talkToNpc,
  tradeWithNpc,
} from "./logic.js";
import { inviteCompanion } from "./inviteCompanion.js";

const makeState = (overrides = {}) => ({
  char: { money: 0, special: {} },
  companionState: {},
  flags: [],
  inv: [],
  pot: 0,
  questProgress: {},
  room: { name: "玉泉寨", npcs: [] },
  skills: [],
  time: 0,
  varTree: { 角色: {}, 世界: {} },
  ...overrides,
});

describe("NPC look and recognition logic", () => {
  it("returns atomic stat replies and an updater that marks the NPC known", () => {
    const state = makeState();
    const result = lookNpc(state, {
      name: "师父",
      combatStats: { hp: [12, 20] },
      levelCap: 1,
    });

    expect(result.extraReplies).toHaveLength(2);
    expect(result.extraReplies[0]).toMatchObject({ t: "stat", text: expect.stringContaining("师父 气血") });
    expect(result.extraReplies[1]).toMatchObject({ t: "stat", text: "  师父 品阶 绿袍" });
    const latest = { ...state.varTree, 世界: { 本日移动次数: 1 } };
    const updated = result.changes.varTree(latest);
    expect(updated.世界.本日移动次数).toBe(1);
    expect(updated.世界.已认识人物).toEqual(["师父"]);
    expect(recognizeNpc(state, { name: "师父" }).changes.varTree(latest).世界.已认识人物).toEqual(["师父"]);
  });

  it("refuses to look at a missing NPC", () => {
    expect(lookNpc(makeState(), null)).toEqual({
      logs: [{ t: "err", text: "  此地没有这位人物。" }],
    });
  });
});

describe("NPC conversation logic", () => {
  it("completes an active escort with deterministic state changes", () => {
    const escort = ESCORT_QUESTS[0];
    const result = talkToNpc(makeState({
      room: { name: escort.targetLocation, npcs: [] },
      questProgress: { [escort.id]: { active: true } },
    }), { name: escort.targetNpc });

    expect(result.changes.char({ money: 5 }).money).toBe(5 + escort.reward);
    expect(result.changes.pot(2)).toBe(12);
    expect(result.changes.flags([])).toContain(`quest_done_${escort.id}`);
    expect(result.changes.questProgress({ [escort.id]: { active: true } })[escort.id]).toEqual({ active: false });
    expect(result.logs.map(({ text }) => text)).toEqual([
      `  你找到了${escort.targetNpc}，交出货物，护镖任务「${escort.title}」圆满完成！`,
      `  💰 报酬：${escort.reward} 两 · 潜能 +10`,
    ]);
    expect(result.completedEscort).toBe(true);
  });

  it("refuses conversation with a non-speaking NPC and preserves the focus intent", () => {
    expect(talkToNpc(makeState(), { name: "雪豹", cannotSpeak: true })).toMatchObject({
      logs: [{ t: "sys", text: expect.stringContaining("它听不懂你的言语") }],
    });
  });

  it("starts a normal conversation without inventing dialogue", () => {
    expect(talkToNpc(makeState(), { name: "师父" })).toMatchObject({
      logs: [{ t: "sys", text: "  你走向师父，看样子是想说些什么。" }],
    });
  });

  it("rejects a missing NPC", () => {
    expect(talkToNpc(makeState(), null)).toEqual({
      logs: [{ t: "err", text: "  此地没有这位人物。" }],
    });
  });
});

describe("NPC gift logic", () => {
  it("removes the selected gift and returns exact settle metadata", () => {
    const item = { id: "gift-1", name: "鱼定枪", quality: "白" };
    const result = giftNpc(makeState({ inv: [item] }), { name: "师父" }, item, 100);

    expect(result.changes.inv).toEqual([]);
    expect(result.changes.varTree({ 世界: { 本日移动次数: 1 } })).toMatchObject({
      世界: { 本日移动次数: 1, 已认识人物: ["师父"] },
    });
    expect(result.settle).toBe("将「鱼定枪」赠予师父");
    expect(result.settleOptions).toMatchObject({
      settleNpc: "师父",
      settleKind: "gift",
      giftInfo: { itemName: "鱼定枪", quality: "白", range: [2, 4], suggestedDelta: 3 },
    });
  });

  it("advances a matching delivery quest and still composes the known-NPC updater", () => {
    const item = { name: "糌粑" };
    const state = makeState({
      inv: [item],
      varTree: { 角色: {}, 世界: { 本日移动次数: 2 } },
      questProgress: {
        village2_jieshixiajiu: { status: "active", currentStageIndex: 0 },
      },
    });
    const result = giftNpc(state, { name: "老孙" }, item, 100);

    expect(result.deliveredQuest?.id).toBe("village2_jieshixiajiu");
    expect(typeof result.changes.varTree).toBe("function");
    expect(result.changes.varTree({ 角色: {}, 世界: { 本日移动次数: 3 } }).世界).toMatchObject({
      本日移动次数: 3,
      已认识人物: ["老孙"],
    });
  });

  it("removes the divine_huxiao delivery material before adding its reward", () => {
    const material = { id: "huxiao-material", name: "虎王的牙筋", category: "misc", quality: "橙" };
    const retainedItem = { id: "kept-item", name: "草药", category: "misc", quality: "白" };
    const state = makeState({
      inv: [material, retainedItem],
      questProgress: {
        divine_huxiao: { status: "active", currentStageIndex: 3 },
      },
    });
    const result = giftNpc(state, { name: "老猎户" }, material, 100);
    const nextInventory = result.changes.inv(state.inv);

    expect(result.deliveredQuest?.id).toBe("divine_huxiao");
    expect(nextInventory).toEqual([
      retainedItem,
      expect.objectContaining({
        id: "quest_reward_100_0",
        name: "虎啸",
        category: "weapon",
        quality: "红",
      }),
    ]);
  });

  it("refuses a missing NPC or missing gift", () => {
    expect(giftNpc(makeState(), null, { name: "鱼定枪" })).toEqual({
      logs: [{ t: "err", text: "  此地没有这位人物。" }],
    });
    expect(giftNpc(makeState(), { name: "师父" }, null)).toEqual({
      logs: [{ t: "err", text: "  背包中没有这件物品。" }],
    });
  });

  it("describes gifts from catalog data and falls back to inventory details", () => {
    expect(describeGiftForPrompt({ name: "鱼定枪", quality: "蓝", desc: "短枪" })).toMatchObject({
      itemName: "鱼定枪",
      quality: expect.any(String),
      range: expect.any(Array),
    });
    expect(describeGiftForPrompt({ name: "陌生物", quality: "紫", desc: "一件物事" })).toMatchObject({
      itemName: "陌生物",
      quality: "紫",
      desc: "一件物事",
      range: [9, 12],
      suggestedDelta: 11,
    });
  });
});

describe("NPC trade and companion invitation logic", () => {
  it("returns a stable shop view for configured shopkeepers", () => {
    expect(tradeWithNpc(makeState(), { name: "杂货商人" }).shop).toMatchObject({
      npcName: "杂货商人",
      shopName: "鱼定村杂货铺",
    });
  });

  it("refuses missing NPCs and NPCs without a shop", () => {
    expect(tradeWithNpc(makeState(), null)).toEqual({
      logs: [{ t: "err", text: "  此地没有这位人物。" }],
    });
    expect(tradeWithNpc(makeState(), { name: "路人" })).toEqual({
      logs: [{ t: "sys", text: "  路人摆摆手，「小店暂无货可卖。」" }],
    });
  });

  it("unlocks an eligible companion with a settlement and removal updater", () => {
    setSeed(17);
    const result = inviteCompanion(makeState({
      flags: ["snow_leopard_trusted"],
      room: { name: "鱼定村", npcs: [{ name: "雪豹", companionCandidate: true }] },
    }), { name: "雪豹", beast: true });

    expect(result.changes.companionState.snowLeopard).toMatchObject({ unlocked: true, active: true });
    expect(result.changes.varTree({ 世界: { 本日移动次数: 1 } }).世界).toMatchObject({
      本日移动次数: 1,
      已认识人物: ["雪豹"],
    });
    expect(result.changes.room({ npcs: [{ name: "雪豹", companionCandidate: true }] }).npcs).toEqual([]);
    expect(result.settle).toBe("向雪豹伸出手，郑重邀它同行");
    expect(result.settleOptions).toMatchObject({ settleNpc: "雪豹", settleKind: "companion_invite", settleBeast: true });
  });

  it("does nothing for an unsupported NPC", () => {
    expect(inviteCompanion(makeState(), { name: "路人" })).toEqual({});
  });
});

describe("NPC stealing logic", () => {
  const thiefState = (overrides = {}) => makeState({
    char: { money: 0, special: { 身法: 10, 气运: 5 } },
    varTree: { 角色: { 商人: { 好感度: 100 } }, 世界: {} },
    ...overrides,
  });
  const findStealResult = (state, npc, kind) => {
    for (let seed = 1; seed < 1000; seed += 1) {
      setSeed(seed);
      const result = stealFromNpc(state, npc, { now: 123 });
      if (result.kind === kind) return result;
    }
    throw new Error(`No seeded steal result for ${kind}`);
  };

  const expectStealNote = (result, actionKind, owner) => {
    expect(result.note).toBeDefined();
    expect(result).not.toHaveProperty("notes");
    expect(result.noteAction).toBe(actionKind);
    if (owner) expect(result.note.owner).toEqual(owner);
    else expect(result.note).not.toHaveProperty("owner");
  };

  it("steals an item, marks it unavailable, and preserves later varTree edits", () => {
    const npc = { name: "商人", carriedItems: [{ id: "carry-1", name: "铜铃", category: "misc", quality: "白" }] };
    const result = findStealResult(thiefState(), npc, "item");

    expect(result.changes.inv([])).toHaveLength(1);
    expect(result.changes.inv([])[0].id).toBe("stolen_carry-1_123");
    expect(result.changes.room({ npcs: [npc] }).npcs[0].carriedItems[0].stolen).toBe(true);
    expect(result.changes).not.toHaveProperty("varTree");
    expectStealNote(result, "steal");
    expect(result.logs.map(({ t }) => t)).toEqual(["cmd", "desc", "loot"]);
  });

  it("records a caught attempt with a deterministic angry-state timestamp", () => {
    const npc = { name: "商人", carriedItems: [{ id: "carry-1", name: "铜铃", category: "misc", quality: "白" }] };
    const state = thiefState({ varTree: { 角色: { 商人: { 好感度: 0 } }, 世界: {} } });
    const result = findStealResult(state, npc, "caught");

    const updated = result.changes.varTree({
      ...state.varTree,
      世界: { ...state.varTree.世界, 本日移动次数: 1 },
    });
    expect(updated.角色.商人.好感度).toBe(0);
    expect(updated.角色.商人.生气状态.startedAt).toBe(123);
    expect(updated.世界).toMatchObject({ 本日移动次数: 1, 已认识人物: ["商人"] });
    expectStealNote(result, "stealFail", [{ name: "商人", via: VIA.FIRSTHAND }]);
  });

  it("reports an empty target after a successful attempt", () => {
    const result = findStealResult(thiefState(), { name: "商人" }, "empty");
    expect(result.logs).toEqual([{
      t: "sys",
      text: "  你想对商人下手，摸了半天，却发现他身上早已一无所有，只得悻悻作罢。",
    }]);
    expectStealNote(result, "steal");
  });

  it("steals a move without attributing knowledge to the unaware NPC", () => {
    const state = thiefState({
      varTree: { 角色: { 师父: { 好感度: 100 } }, 世界: {} },
    });
    const npc = {
      name: "师父",
      moveset: [{
        id: "move-test",
        name: "断水剑",
        type: "攻击",
        quality: "白",
        desc: "一招断水",
      }],
    };
    const result = findStealResult(state, npc, "move");

    expect(result.changes.skills([]).map(({ id }) => id)).toEqual(["move-test"]);
    expectStealNote(result, "steal");
  });

  it("routes an angry target to appeasement without rolling a steal", () => {
    const state = thiefState({
      varTree: { 角色: { 商人: { 好感度: 40, 生气状态: { active: true } } }, 世界: {} },
    });
    const result = stealFromNpc(state, { name: "商人" }, { now: 123 });

    expect(result).not.toHaveProperty("steal");
    expect(result.settleOptions).toEqual({ settleNpc: "商人", settleKind: "appease" });
    expect(result.changes.varTree(state.varTree).角色.商人.生气状态.attempts)
      .toEqual([{ kind: "steal", detail: "偷窃", time: 123 }]);
  });

  it("blocks a missing NPC without state changes", () => {
    expect(stealFromNpc(thiefState(), null)).toMatchObject({
      kind: "blocked",
      logs: [{ t: "err", text: "  此地没有这位人物。" }],
    });
  });
});

describe("NPC duel settlement logic", () => {
  it("settles spar results in order and applies updater changes to the latest state", () => {
    const state = makeState({
      char: { name: "少侠", hp: [100, 100], pendingCombatBuff: { atk: 5 }, special: { 气运: 5 } },
      inv: [],
      pot: 0,
      room: { name: "玉泉寨", npcs: [] },
      time: 12,
    });
    const sparNpc = {
      name: "师父",
      id: "master",
      levelCap: 1,
      guaranteedDrop: { name: "旧玉佩", category: "accessory", quality: "白" },
      carriedItems: [{ id: "carry-1", name: "铜铃", category: "misc", quality: "白" }],
    };
    const result = settleNpcDuel(state, sparNpc, {
      outcome: "win",
      battleLog: [{ round: 1, playerMove: { name: "掌法", type: "攻击" }, npcMove: { name: "剑招", type: "攻击" }, result: { damageToA: 2, damageToB: 4, statusDamageA: 0, statusDamageB: 0, worseName: "师父" } }],
      remainingHp: [30, 120],
      grownMoveset: [{ id: "grown" }],
      rng: () => 0,
      now: 123,
    });

    expect(result.changes.char(state.char)).toMatchObject({ hp: [30, 100], moveset: [{ id: "grown" }] });
    expect(result.changes.char(state.char)).not.toHaveProperty("pendingCombatBuff");
    expect(result.changes.pot(state.pot)).toBeGreaterThan(0);
    const varTree = result.changes.varTree({ 角色: {}, 世界: { 本日移动次数: 2 } });
    expect(varTree.世界).toMatchObject({ 本日移动次数: 2, 已认识人物: ["师父"] });
    expect(varTree.角色.师父.好感度).toBeGreaterThan(0);
    expect(result.changes.inv([]).map(({ name }) => name)).toEqual(["旧玉佩", "铜铃"]);
    expect(result.changes.room({ npcs: [sparNpc] }).npcs[0].carriedItems[0].dropped).toBe(true);
    expect(result.logs.at(-1).text).toBe("　◈ 少侠 切磋 师父 · 战斗结算");
    expect(result.fact).toMatchObject({ id: "duel_师父_12", 标签: "切磋" });
    expect(result.recapNote).toContain("在玉泉寨与师父切磋");
  });

  it("settles a loss without victory-only loot and preserves the exact battle outcome text", () => {
    const result = settleNpcDuel(makeState(), { name: "师父", levelCap: 1 }, {
      outcome: "lose",
      loot: { droppedMoney: 5 },
      usedItems: ["丹药"],
      now: 123,
    });

    expect(result.changes.char({ money: 0, hp: [50, 50] }).money).toBe(5);
    expect(result.changes.inv(["丹药"])).toEqual([]);
    expect(result.outcomeText).toBe("你技逊一筹，向师父抱拳致意");
    expect(result.logs.at(-1).text).toBe("　◈ 你 切磋 师父 · 战斗结算");
  });

  it("never re-awards an item stolen during the duel", () => {
    const item = { id: "carry-1", name: "铜铃", category: "misc", quality: "白" };
    const npc = { name: "师父", levelCap: 1, carriedItems: [item] };
    const result = settleNpcDuel(makeState({ room: { name: "玉泉寨", npcs: [npc] } }), npc, {
      outcome: "win", dodgeStolenItems: [item], rng: () => 0,
    });
    expect(result.changes.inv([]).filter(({ name }) => name === item.name)).toHaveLength(1);
  });

  it("recreates a respawning NPC through the injected generator", () => {
    const freshNpc = { name: "村口大公鸡", respawn: true };
    const createRespawnNpc = vi.fn(() => freshNpc);
    const npc = { name: "村口大公鸡", id: "rooster", respawn: true, levelCap: 1 };
    const result = settleNpcDuel(makeState(), npc, {
      outcome: "win",
      createRespawnNpc,
    });

    expect(createRespawnNpc).toHaveBeenCalledWith(expect.objectContaining({
      id: "rooster",
      name: "村口大公鸡",
      carry: [{ name: "金蛋", category: "misc", quality: "绿" }],
    }), { luck: 5, levelCap: 1 });
    expect(result.changes.room({ npcs: [npc] }).npcs).toContain(freshNpc);
    expect(result.logs.some(({ text }) => text.includes("又蹦了回来"))).toBe(true);
  });

  it("refuses settlement without an NPC", () => {
    expect(settleNpcDuel(makeState(), null, { outcome: "win" })).toEqual({});
  });
});
