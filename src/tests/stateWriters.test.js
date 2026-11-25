import { expect, it, vi } from "vitest";
import { refAccessors } from "./mockRef.js";
import { commitRound } from "../engine/act/commitRound.js";
import { parseLocalCommand } from "../engine/localCommands.js";
import { computeGiftWeight } from "../domain/rules/npc/giftWeight.js";
import { NPC_POOL, toRoomNpc } from "../domain/data/npc/npcPool.js";
import { getResidentNpcs } from "../domain/data/npc/residentNpcs.js";
import { callExtraction } from "../engine/ports/extraction.js";
import { buildSysBase } from "../domain/rules/prompt/sysBase.js";
import { deposit, pledge, redeem, withdraw } from "../features/bank/logic.js";
import { meditate, trainNeigong } from "../features/cultivation/logic.js";
import { consumeItem, pickGroundItem } from "../features/items/logic.js";
import { giftNpc, settleNpcDuel } from "../features/npc/logic.js";
import { applyPigeonReply, buyPigeon, collectPigeons, sendPigeonLetter } from "../features/pigeon/logic.js";
import { stageRewardPatches } from "../domain/rules/quests/questRewards.js";
import { commitPatches } from "../domain/rules/state/applyPatches.js";
import { extractMvuBlock } from "../domain/rules/prompt/mvu.js";
import { unlockImportedCompanion } from "../domain/rules/companion/companion.js";

function applyChanges(state, result) {
  const next = { ...state };
  for (const [key, value] of Object.entries(result.changes || {})) {
    next[key] = typeof value === "function" ? value(next[key]) : value;
  }
  return next;
}

function makeDeps(state, proposals, overrides) {
  const logs = [];
  const deps = new Proxy({
    ...state,
    p: proposals, apiCfg: {}, mapData: {}, rawFull: "叙事", newConvo: [], questProgress: {},
    // WO-06：plan 直传字段 + store 读 + 注入回调
    pendDir: null, outerDepart: null, pickupJudgment: null, collectGranted: [],
    pickupExtractionFailed: false,
    getGameState: () => state,
    appendDayMaterial: (entry) => { (state._dayMaterial ||= []).push(entry); },
    getGambleSession: () => state._gambleSession ?? null,
    setGambleSession: (v) => { state._gambleSession = v; },
    gambleTalkCtx: { current: null }, pendDirRef: { current: null }, outerDepartRef: { current: null },
    pickupJudgmentRef: { current: null }, pickupExtractionFailedRef: { current: false },
    collectGrantedRef: { current: [] }, dayMaterialRef: { current: [] }, roundsSinceLastSaveRef: { current: 0 }, playedThisSessionRef: { current: false },
    mvuCommands: [], addLog: (rows) => logs.push(...rows),
    ...overrides,
  }, {
    get(target, key) {
      if (key in target) return target[key];
      if (!key.startsWith("set")) return undefined;
      const path = key[3].toLowerCase() + key.slice(4);
      return (value) => { state[path] = typeof value === "function" ? value(state[path]) : value; };
    },
  });
  return { deps, logs };
}

function baseState() {
  return {
    char: { name: "少侠", hp: [9, 40], money: 30, neigong: 4, special: { 体魄: 5 } },
    room: { name: "鱼定村", npcs: [], items: [] },
    inv: ["药丸", "药丸"], flags: ["old", "old"], varTree: { 角色: {}, 世界: {} },
    skills: [], pot: 20, exp: 0, time: 25,
  };
}

const beggar = toRoomNpc(NPC_POOL.find(({ name }) => name === "乞丐老七"));
const chieftain = getResidentNpcs("鱼定土司").find(({ name }) => name === "桑杰朵杰");

it("values the same silver and the same item differently for a beggar and a chieftain", () => {
  expect([beggar, chieftain].map((npc) => computeGiftWeight(npc, { amount: 10 }).label))
    .toEqual(["厚礼", "薄礼"]);
  expect(computeGiftWeight(chieftain, { amount: 100 }).label).toBe("厚礼");
  expect([beggar, chieftain].map((npc) => computeGiftWeight(npc, { category: "misc", quality: "白" }).label))
    .toEqual(["厚礼", "薄礼"]);
  const item = { id: "礼物", name: "青布", category: "misc", quality: "白" };
  const gift = giftNpc({ ...baseState(), inv: [item] }, chieftain, item);
  expect(gift.changes.inv).toEqual([]);
  expect(gift.settleOptions.giftInfo.weight.label).toBe("薄礼");
});

it("shares money gifting between web and CLI and rejects insufficient cash or absent recipients", () => {
  const state = { ...baseState(), room: { name: "市集", npcs: [chieftain] } };
  for (const surface of ["web", "cli"]) {
    const gift = parseLocalCommand("给桑杰朵杰 10元", state, { surface }).result;
    expect(applyChanges(state, gift).char.money).toBe(20);
    expect(gift.settleOptions.giftInfo.weight.label).toBe("薄礼");
    expect(parseLocalCommand("给桑杰朵杰100两", state, { surface }).result.changes).toBeUndefined();
    expect(parseLocalCommand("给乞丐老七 10两", state, { surface }).result.changes).toBeUndefined();
  }
});

it("passes the band and its reaction to both narration and extraction", async () => {
  const state = { ...baseState(), room: { name: "市集", npcs: [chieftain] } };
  const { settleOptions } = parseLocalCommand("给桑杰朵杰 10元", state).result;
  for (const narrativeOnly of [true, false]) {
    const { phiRules } = buildSysBase(200, {}, "", "", false, "", narrativeOnly, "settle", settleOptions);
    expect(phiRules).toContain("分量：薄礼");
    expect(phiRules).toContain("礼貌致谢");
    if (!narrativeOnly) expect(phiRules).toContain("1~+2");
  }
  const chat = vi.fn(async () => ({ text: "{}" }));
  await callExtraction("UNKNOWN", "对方道谢。", state, {}, settleOptions, { chat });
  expect(chat.mock.calls[0][0][0].content).toContain("分量：薄礼");
  expect(chat.mock.calls[0][0][0].content).toContain("1~+2");
  expect(chat.mock.calls[0][0][0].content).not.toContain("@赠礼");
});

it.each([0, 11])("clamps the gift and preserves the daily cap (already gained %s)", (gained) => {
  const state = baseState();
  state.room.npcs = [chieftain, beggar];
  state.varTree.角色[chieftain.name] = { 好感度: 60 };
  state.varTree.世界.好感日增 = { dayStamp: 1, gained: { [chieftain.name]: gained } };
  const { deps } = makeDeps(state, { char: { money: 0 }, delta: { items_rm: ["药丸"] } }, {
    giftAlreadySettled: true,
    effectiveSpecialNow: { 魅力: 10 },
    giftSettlement: { npc: chieftain.name, range: computeGiftWeight(chieftain, { amount: 100 }).range },
    mvuCommands: [
      { op: "set", path: `角色.${chieftain.name}.好感度`, value: 100 },
      { op: "add", path: `角色.${beggar.name}.好感度`, value: 50 },
      { op: "add", path: `角色.${chieftain.name}.好感度`, value: 50 },
      { op: "add", path: `角色.${chieftain.name}.好感度`, value: 50 },
    ],
  });
  commitRound(deps);
  expect(state.varTree.角色[chieftain.name].好感度).toBe(gained ? 61 : 66);
  expect(state.varTree.角色[beggar.name]?.好感度).toBeUndefined();
  expect(state.char.money).toBe(30);
  expect(state.inv).toEqual(["药丸", "药丸"]);
});

it.each([{}, { gm: true }, { gm: true, preserveHp: true }, { isTalk: true }])(
  "keeps resolved proposal fields, drop order and silence (%j)", (overrides) => {
    const state = baseState();
    const { deps, logs } = makeDeps(state, {
      char: { hp: [14, 40], money: 3, neigong: 8, waigong: 5 },
      delta: { items_add: ["钥匙", "药丸"], items_rm: ["药丸"], flags_add: ["old", "new", "new"], pot: 3, exp: 2 },
    }, overrides);
    commitRound(deps);
    const { char, inv, flags, room: { items } } = state;
    const proposed = !overrides.isTalk;
    expect([state.pot, state.exp]).toEqual(proposed ? [23, 2] : [20, 0]);
    const oldHp = overrides.preserveHp || !proposed ? [9, 40] : overrides.gm ? [40, 40] : [14, 40];
    expect({ char, inv, flags, items, logs }).toEqual({
      char: { name: "少侠", hp: oldHp, money: proposed ? 3 : 30, neigong: proposed ? 8 : 4,
        special: { 体魄: 5 }, ...(proposed ? { waigong: 5 } : {}) },
      inv: proposed ? ["钥匙"] : ["药丸", "药丸"],
      flags: ["old", "new"],
      items: proposed ? [{ name: "药丸", id: "药丸" }] : [],
      logs: [],
    });
  },
);

it("keeps the MVU clamp, ledger, permitted generic writes and exact player logs", () => {
  const state = baseState();
  state.varTree.角色 = { 侠客: { 好感度: 98 } };
  const { deps, logs } = makeDeps(state, {}, {
    mvuCommands: [
      { op: "add", path: "角色.侠客.好感度", value: 8 },
      { op: "add", path: "角色.侠客.好感度", value: 7 },
      { op: "set", path: "主角.别名", value: "青衣" },
      { op: "set", path: "世界.威望", value: 150 },
    ],
  });
  commitRound(deps);
  expect({ tree: state.varTree, logs }).toEqual({
    tree: { 角色: { 侠客: { 好感度: 100 } }, 世界: { 好感日增: { dayStamp: 1, gained: { 侠客: 2 } }, 威望: 100 }, 主角: { 别名: "青衣" } },
    logs: [
      { t: "affection", text: "  💗 侠客 好感度 +2（98 → 100）" },
    ],
  });
});

it("MVU 好感度变动提交后恰好一条 💗 字幕，带变动前后值", () => {
  const state = baseState();
  state.varTree.角色 = { 元朵朵: { 好感度: 45 } };
  const { deps, logs } = makeDeps(state, {}, {
    mvuCommands: [{ op: "add", path: "角色.元朵朵.好感度", value: 2 }],
  });
  commitRound(deps);
  expect(state.varTree.角色.元朵朵.好感度).toBe(47);
  expect(logs.filter((l) => l.t === "affection")).toEqual([
    { t: "affection", text: "  💗 元朵朵 好感度 +2（45 → 47）" },
  ]);
});

// 真实提取输出（turn-2022）：路径不带引号；元朵朵是随行伙伴，不在 room.npcs。
const TURN_2022_MVU = "_.add(角色.元朵朵.好感度, 2);\n_.add(角色.元朵朵.旧账.lines, '被少侠拥吻告白，探入裙中揉弄亵裤腿心，羞软无力难以推拒。');\n";
const TURN_141_MVU = "_.set(角色.元朵朵.好感度, 47);\n_.push(角色.元朵朵.旧账.lines, '...');\n_.set(角色.元朵朵.旧账.updatedTurn, 141);";
const followingDuoduo = () => unlockImportedCompanion({}, { name: "元朵朵" });
const parseLikeExtraction = (mvu) => extractMvuBlock(`<mvu>${mvu}</mvu>`).commands;

it("不带引号的 mvu 路径也能解析，坏行不影响同块其他条", () => {
  expect(parseLikeExtraction(TURN_2022_MVU)).toEqual([
    { op: "add", path: "角色.元朵朵.好感度", value: 2 },
    { op: "add", path: "角色.元朵朵.旧账.lines", value: "被少侠拥吻告白，探入裙中揉弄亵裤腿心，羞软无力难以推拒。" },
  ]);
  expect(parseLikeExtraction(TURN_141_MVU).map(({ op, path }) => `${op} ${path}`)).toEqual([
    "set 角色.元朵朵.好感度", "push 角色.元朵朵.旧账.lines", "set 角色.元朵朵.旧账.updatedTurn",
  ]);
});

it("turn-2022：随行伙伴（不在 room.npcs、varTree 里还没她）的 _.add 好感照常生效并出 💗", () => {
  const state = baseState();
  const { deps, logs } = makeDeps(state, {}, {
    companionState: followingDuoduo(),
    mvuCommands: parseLikeExtraction(TURN_2022_MVU),
  });
  commitRound(deps);
  expect(state.varTree.角色.元朵朵.好感度).toBe(2);
  expect(logs.filter((l) => l.t === "affection")).toEqual([
    { t: "affection", text: "  💗 元朵朵 好感度 +2（0 → 2）" },
  ]);
});

it("turn-2022：同一块里 旧账 那条写坏只丢它自己，好感照常落账", () => {
  const state = baseState();
  state.varTree.角色 = { 元朵朵: { 好感度: 45 } };
  const { deps, logs } = makeDeps(state, {}, {
    companionState: followingDuoduo(),
    mvuCommands: parseLikeExtraction(TURN_2022_MVU),
  });
  commitRound(deps);
  expect(state.varTree.角色.元朵朵.好感度).toBe(47);
  expect(logs.filter((l) => l.t === "affection")).toEqual([
    { t: "affection", text: "  💗 元朵朵 好感度 +2（45 → 47）" },
  ]);
});

it("不是随行也不认识的幽灵名字，好感指令仍被丢弃", () => {
  const state = baseState();
  const { deps, logs } = makeDeps(state, {}, {
    companionState: followingDuoduo(),
    mvuCommands: [{ op: "add", path: "角色.路人甲.好感度", value: 2 }],
  });
  commitRound(deps);
  expect(state.varTree.角色.路人甲).toBeUndefined();
  expect(logs.filter((l) => l.t === "affection")).toEqual([]);
});

it("turn-141：对已有好感的人 _.set 好感度被换算成限幅增量，一条 💗，其余行不受牵连", () => {
  const state = baseState();
  state.varTree.角色 = { 元朵朵: { 好感度: 45 } };
  const { deps, logs } = makeDeps(state, {}, {
    companionState: followingDuoduo(),
    mvuCommands: parseLikeExtraction(TURN_141_MVU),
  });
  commitRound(deps);
  expect(state.varTree.角色.元朵朵.好感度).toBe(47);
  expect(logs.filter((l) => l.t === "affection")).toEqual([
    { t: "affection", text: "  💗 元朵朵 好感度 +2（45 → 47）" },
  ]);
});

it("_.set 好感度跳大值、_.add 报大数，单回合最多涨 5", () => {
  for (const command of [
    { op: "set", path: "角色.元朵朵.好感度", value: 90 },
    { op: "add", path: "角色.元朵朵.好感度", value: 12 },
  ]) {
    const state = baseState();
    state.varTree.角色 = { 元朵朵: { 好感度: 45 } };
    const { deps } = makeDeps(state, {}, { companionState: followingDuoduo(), mvuCommands: [command] });
    commitRound(deps);
    expect(state.varTree.角色.元朵朵.好感度).toBe(50);
  }
});

it("keeps duel addChange ordering, counted removals, affection, silver and logs", () => {
  const state = baseState();
  state.varTree.角色.师父 = { 好感度: 98 };
  state.char.pendingCombatBuff = { duration: 1 };
  const loot = { id: "l1", name: "剑谱", quality: "绿", equipped: false };
  const duel = settleNpcDuel(state, { name: "师父", levelCap: 1 }, {
    outcome: "win", remainingHp: [-1, 40], usedItems: ["药丸"], loot: { droppedMoney: 5, guaranteedLoot: [loot] },
    grownMoveset: [{ name: "新招" }],
  });
  const next = applyChanges(state, duel);
  expect(next.char.pendingCombatBuff).toBeUndefined();
  expect(next.char.moveset).toEqual([{ name: "新招" }]);
  expect(next.pot).toBe(40);
  expect({ hp: next.char.hp, money: next.char.money, inv: next.inv.map((item) => item.name || item),
    affinity: next.varTree.角色.师父.好感度, logs: duel.logs.map(row => row.text) }).toMatchInlineSnapshot(`
      {
        "affinity": 100,
        "hp": [
          0,
          40,
        ],
        "inv": [
          "药丸",
          "剑谱",
        ],
        "logs": [
          "  ⊙ 切磋中服用：药丸×1",
          "  ✦ 与绿袍高手切磋获胜，长了见识，潜能 +20",
          "  💗 与师父切磋一场，交情 +4",
          "  💰 战利品：获得银两 5 两",
          "  ⚔ 战利品：取得「剑谱」（绿）",
          "　◈ 少侠 切磋 师父 · 战斗结算",
        ],
        "money": 35,
      }
    `);
});

it("keeps HP healing, training stats, and the ordered player logs", () => {
  const state = baseState();
  const meditateResult = meditate(state);
  const rested = applyChanges(state, meditateResult);
  const trainResult = trainNeigong(rested);
  const trained = applyChanges(rested, trainResult);
  expect({ restedHp: rested.char.hp, trainedHp: trained.char.hp, skill: trained.char.neigong, pot: trained.pot,
    logs: [...meditateResult.logs, ...trainResult.logs].map(row => row.text) }).toMatchInlineSnapshot(`
      {
        "logs": [
          "> 打坐运功",
          "  你盘膝调息，气血回转了些。",
          "  气血 9→15",
          "> 运气打坐（练内功）",
          "  你盘膝运气，内息缓缓精进了一分。",
          "  内功 4→5（花费4潜能）· 气血上限 40→116",
        ],
        "pot": 16,
        "restedHp": [
          15,
          40,
        ],
        "skill": 5,
        "trainedHp": [
          91,
          116,
        ],
      }
    `);
});

it("keeps all bank money changes, matching legacy item IDs and silent logs", () => {
  let state = { ...baseState(), deposit: 0, pledgedItems: [], inv: [{ id: "stone", name: "石头" }, "stone"] };
  const actions = [(s) => deposit(s, 9), withdraw, (s) => pledge(s, "stone", 4), (s) => redeem(s, 0, 5)];
  const steps = actions.map((action) => {
    const result = action(state);
    state = applyChanges(state, result);
    return [state.char.money, state.deposit, state.inv.length, result.logs];
  });
  expect(steps).toEqual([[21, 9, 2, []], [30, 0, 2, []], [34, 0, 0, []], [29, 0, 1, []]]);
  expect(state.inv).toEqual([{ id: "stone", name: "石头", equipped: false }]);
});

it("keeps item use, pickup, and gifting semantics and logs", () => {
  const state = baseState();
  const medicine = { id: "h1", name: "金创药", category: "misc", consumable: { hpRestore: 0.125, sixDimTemp: { 体魄: 1 } } };
  state.room.items.push(medicine);
  const picking = pickGroundItem(state, medicine);
  const picked = applyChanges(state, picking);
  const consumption = consumeItem(picked, medicine);
  const healed = applyChanges(picked, consumption);
  const gift = giftNpc(healed, { name: "侠客" }, "药丸", 25);
  const after = applyChanges(healed, gift);
  expect({ inv: after.inv.map(i => i?.name || i), hp: after.char.hp, items: after.room.items, flags: after.flags,
    logs: [...picking.logs, ...consumption.logs, ...gift.logs].map(row => row.text), settle: gift.settle }).toMatchInlineSnapshot(`
      {
        "flags": [
          "old",
          "old",
          "buff_体魄+1_untilturn_56",
        ],
        "hp": [
          14,
          40,
        ],
        "inv": [
          "药丸",
        ],
        "items": [],
        "logs": [
          "  ✓ 你拾起「金创药」，收入囊中。",
          "  ⊙ 服下之后，气血回复 5 点，体魄暂增 1。",
        ],
        "settle": "将「药丸」赠予侠客",
      }
    `);
});

it("keeps the letter preview's affection and logs even if the next state has changed", () => {
  const state = baseState();
  state.varTree.角色.侠客 = { 好感度: 98 };
  const buy = buyPigeon(state, 2, 5);
  const posted = sendPigeonLetter(applyChanges(state, buy), "侠客", "问安", { channel: "postgift", gift: "药丸" });
  const next = applyChanges(applyChanges(state, buy), posted);
  const response = applyPigeonReply(next, next.varTree.世界.飞鸽待回[0], "甚好⟦好感+8⟧");
  next.varTree.角色.侠客.好感度 = 10;
  const delivered = applyChanges(next, response);
  expect({ money: delivered.char.money, inv: delivered.inv, affection: delivered.varTree.角色.侠客.好感度,
    logs: [...buy.logs, ...posted.logs, ...response.logs].map(row => row.text) }).toMatchInlineSnapshot(`
      {
        "affection": 100,
        "inv": [
          "药丸",
        ],
        "logs": [
          "  🕊 买下 2 只信鸽（-10 两），现有 2 只。",
          "> 驿站送礼致「侠客」：问安（附礼：药丸）",
          "  🕊 书信已托驿卒送出，往「鱼定村」，约 2 个时辰后当有回音。",
          "  🕊 一只信鸽落下——侠客的回信到了。",
          "  「侠客来信」甚好",
          "  💗 侠客 好感度 +8（98 → 100）",
        ],
        "money": 20,
      }
    `);
});

it("keeps quest rewards, absolute resets, default affection and silent writes", () => {
  const state = baseState();
  const { deps, logs } = makeDeps(state);
  commitPatches(deps, stageRewardPatches({
    items: [{ name: "玉佩" }], money: 4, flags: ["new", "old"], reputation: 20,
    favorability: { 侠客: 3 }, favorabilitySet: { 师父: 0 },
  }, 25));
  expect({ inv: state.inv, flags: state.flags, money: state.char.money, tree: state.varTree, logs }).toEqual({
    inv: ["药丸", "药丸", { name: "玉佩", id: "quest_reward_25_0", equipped: false }],
    flags: ["old", "new"], money: 34,
    tree: { 角色: { 侠客: { 好感度: 13 }, 师父: { 好感度: 0 } }, 世界: { 威望: 20 } },
    logs: [],
  });
});

it("keeps day-flag replacement ordering and the collection log", () => {
  const state = baseState();
  state.flags.push("pigeon_collected_day_4");
  const result = collectPigeons(state, { qty: 2, dayIdx: 5 });
  expect({ flags: applyChanges(state, result).flags, logs: result.logs }).toEqual({
    flags: ["pigeon_collected_day_5", "old", "old"],
    logs: [{ t: "item", text: "  🕊 从鸽子笼领了 2 只信鸽，现有 2 只。" }],
  });
});
