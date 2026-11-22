import { describe, expect, it } from "vitest";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { getResidentNpcs } from "../../domain/data/npc/residentNpcs.js";
import { isNodeUnlocked } from "../../domain/data/map/qucuoMap.js";
import { innerGroundItemsRule } from "../../domain/rules/map/rules.js";
import { MOVE_TYPE } from "../../domain/rules/combat/moveTypes.js";
import { getLocalQuestStage } from "../../domain/rules/quests/localStages.js";
import { questFlagRule } from "../../domain/rules/quests/rules.js";
import { commitModelFlags } from "../../engine/act/commitFlags.js";
import { parseLocalCommand } from "../../engine/localCommands.js";
import { setSeed, getRngState, setRngState } from "../../utils/rng.js";
import { buyTangmenItem, TANGMEN_SHOP } from "../buildings/tangmenShop.js";
import { settleNpcDuel } from "../npc/settleDuel.js";
import { forceAdvanceQuest } from "./logic.js";

const id = "tangmen_1_anxianglaike";
const quest = QUCUO_QUESTS.find((entry) => entry.id === id);
const giver = getResidentNpcs("锦官城").find((npc) => npc.name === quest.giver);
const setup = () => ({
  char: { money: 300, special: { 智谋: 10 } },
  room: { name: "锦官城", npcs: [{ ...giver, id: `pool_${giver.id}` }] },
  innerRoomName: "唐门暗巷",
  inv: [], skills: [], flags: [], questProgress: {}, varTree: {}, time: 1,
});
const apply = (state, result) => ({ ...state, ...Object.fromEntries(Object.entries(result.changes || {}).map(
  ([key, value]) => [key, typeof value === "function" ? value(state[key]) : value],
)) });
const advance = (state, choice = "") => apply(state, parseLocalCommand(`推进任务 ${id} ${choice}`, state, { surface: "cli" }).result);
const purchased = () => {
  const state = setup();
  return apply(state, parseLocalCommand("买暗器 峨眉刺", state, { surface: "cli" }).result);
};
const intercept = () => ({
  ...advance({ ...advance(purchased()), innerRoomName: "城隍庙旧墙" }),
  innerRoomName: "南门竹径",
});

describe("唐1·暗巷来客", () => {
  it("requires real spend or the recognized evidence, with the built-in NPC at the outer hall", () => {
    const state = setup();
    expect(getLocalQuestStage(quest, state)).toBeNull();
    const paid = purchased();
    expect(paid.char.shopSpend[TANGMEN_SHOP]).toBeGreaterThanOrEqual(50);
    expect(paid.char.shopSpend[TANGMEN_SHOP]).toBe(state.char.money - paid.char.money);
    expect(paid.inv[0].buyPrice).toBe(paid.char.shopSpend[TANGMEN_SHOP]);
    expect(getLocalQuestStage(quest, paid)?.id).toBe("ask");
    expect(getLocalQuestStage(quest, { ...state, inv: ["土司府制式毒箭残簇"] })).toBeNull();
    const hall = { ...state, room: { name: "鱼定土司", items: [] }, innerRoomName: "护卫厅" };
    const withGround = apply(hall, innerGroundItemsRule.run(hall));
    const pickup = parseLocalCommand("拾取 土司府制式毒箭残簇", withGround, { surface: "cli" }).result;
    expect(getLocalQuestStage(quest, { ...state, inv: apply(withGround, pickup).inv })?.id).toBe("ask");
    expect(getLocalQuestStage(quest, { ...paid, room: { ...paid.room, npcs: [{ ...giver, imported: true }] } })).toBeNull();
    expect(buyTangmenItem({ ...state, innerRoomName: "城门" }, "峨眉刺").changes).toBeUndefined();
    expect(buyTangmenItem({ ...state, char: { money: 0 } }, "峨眉刺").changes).toBeUndefined();
  });

  it("advances one stage at the correct location, awards once, and unlocks the fort", () => {
    const paid = purchased();
    expect(isNodeUnlocked("蜀南唐堡", paid)).toBe(false);
    const started = advance(paid);
    expect(started.questProgress[id].currentStageIndex).toBe(1);
    expect(advance(started)).toEqual(started);
    expect(forceAdvanceQuest(paid, quest, "quest_tang1_report").changes).toEqual({});
    const selected = advance(intercept(), "暗查取证");
    expect(selected.flags).toContain("quest_tang1_stealth");
    expect(selected.flags).not.toContain("quest_tang1_fight");
    expect(selected.inv.map((item) => item.name)).toContain("茶砖货单抄录");
    const finished = advance({ ...selected, innerRoomName: "唐门暗巷" });
    expect(finished.questProgress[id].status).toBe("completed");
    expect(finished.char.money).toBe(paid.char.money + 120);
    expect(finished.varTree.角色.唐三少.好感度).toBe(25);
    expect(finished.inv.map((item) => item.name)).toContain("蜀南竹径引荐信");
    expect(isNodeUnlocked("蜀南唐堡", finished)).toBe(true);
    expect(advance(finished)).toEqual(finished);
  });

  it("settles the combat branch only after a win", () => {
    const state = intercept();
    const npc = { id: "foe", name: "蒙面押车头领", questBranchFlag: "quest_tang1_fight" };
    const options = { pendingQuestBranch: { questId: id, flag: npc.questBranchFlag, mode: "combat" }, rng: () => 1 };
    expect(advance(state, "硬闯截货")).toEqual(state);
    expect(apply(state, settleNpcDuel(state, npc, { ...options, outcome: "lose" })).flags).not.toContain(npc.questBranchFlag);
    const won = apply(state, settleNpcDuel(state, npc, { ...options, outcome: "win" }));
    expect(won.flags).toContain(npc.questBranchFlag);
    expect(won.questProgress[id].currentStageIndex).toBe(3);
    expect(won.char.money).toBe(state.char.money + 30);
    expect(won.inv.filter((item) => item.name === "毒蝎粉" && item.consumable)).toHaveLength(2);
  });

  it("resolves a CLI fight through combat rounds before granting the branch", () => {
    const saved = getRngState();
    try {
      setSeed(42);
      const state = intercept();
      state.char = {
        ...state.char, hp: [900, 900], waigong: 200, special: { 智谋: 10, 身法: 100 },
        moveset: [{ name: "试招", type: MOVE_TYPE.ATTACK, baseDamageMultiplier: 100, cost: 0 }],
      };
      const fought = advance(state, "硬闯截货");
      expect(fought.flags).toContain("quest_tang1_fight");
      expect(fought.time).toBeGreaterThan(state.time);
    } finally {
      setRngState(saved);
    }
  });

  it("applies active food attributes to CLI combat without changing base stats", () => {
    const saved = getRngState();
    try {
      const state = intercept();
      state.char = {
        ...state.char, hp: [900, 900], waigong: 15, special: { 身法: 1 },
        moveset: [{ name: "试招", type: MOVE_TYPE.ATTACK, baseDamageMultiplier: 2, cost: 0 }],
      };
      const fight = (overrides) => {
        setSeed(42);
        return parseLocalCommand(`推进任务 ${id} 硬闯截货`, { ...state, ...overrides }, { surface: "cli" }).result;
      };
      const active = fight({ flags: [...state.flags, "buff_身法+9_untilturn_5"] });
      const expired = fight({ flags: [...state.flags, "buff_身法+9_untilturn_0"] });
      expect(active.reportRounds).toEqual(fight({ char: { ...state.char, special: { 身法: 10 } } }).reportRounds);
      expect(expired.reportRounds).toEqual(fight({}).reportRounds);
      expect(active.reportRounds).not.toEqual(expired.reportRounds);
      expect(apply(state, active).char.special.身法).toBe(1);
    } finally {
      setRngState(saved);
    }
  });

  it("rejects model-suggested stage and access flags", () => {
    const state = purchased();
    const p = { delta: { flags_add: ["quest_tang1_meeting", "tangmen_invited", "unrelated"] } };
    expect(commitModelFlags({ p, ...state }).changes.flags([])).toEqual(["unrelated"]);
    const result = questFlagRule.run({ ...state, flags: ["quest_tang1_meeting"] });
    expect(result?.changes?.questProgress?.[id]).toBeUndefined();
  });
});
