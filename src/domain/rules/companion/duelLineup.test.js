import { describe, expect, it } from "vitest";
import {
  duelLineup, duelAllies, unlockImportedCompanion, unlockFollowerCompanion,
  unlockSnowLeopard, setActiveCompanion, stationCompanion, unstationCompanion, companionNpcEntry,
  createFollowerCompanion,
} from "./companion.js";
import { ocSignatureMoves } from "./ocKungfu.js";
import { buildEnemyUnit, buildLeopardUnit } from "../combat/teamUnits.js";
import { ensureNpcCombatData } from "../npc/npcGeneration.js";
import { ADVENTURER_POOL } from "../../data/dungeon/adventurers.js";
import { ADVENTURER_POOL_IP } from "../../data/dungeon/adventurersIP.js";

const ALL_OC = [...ADVENTURER_POOL, ...ADVENTURER_POOL_IP];
const byName = (name) => ALL_OC.find((a) => a.name === name);
const DUODUO = byName("元朵朵");
const duoduoNpc = () => ensureNpcCombatData({ id: "npc_duoduo", name: "元朵朵", levelCap: 1 }, { levelCap: 1 });

// 招募一位 OC：主人入队（出战）+ 随从作为另一个伙伴入队
const recruit = (owner, cs = {}) => {
  const withOwner = unlockImportedCompanion(cs, { name: owner.name, levelCap: owner.levelCap ?? 1, signatureMoves: ocSignatureMoves(owner) });
  return unlockFollowerCompanion(withOwner, owner);
};

describe("每位冒险者的随从都随主人入队，是两个人", () => {
  it("77 位冒险者的随从都建出独立伙伴槽，带得动的战斗数据", () => {
    for (const owner of ALL_OC) {
      const cs = recruit(owner);
      const slots = Object.entries(cs).filter(([, c]) => c.servantOf);
      expect(slots, owner.name).toHaveLength(1);
      const [, slot] = slots[0];
      expect(slot).toMatchObject({ unlocked: true, active: false, label: owner.follower.name });
      expect(buildEnemyUnit(companionNpcEntry(cs, slots[0][0])).movesetLocal.length, owner.follower.name).toBeGreaterThan(0);
    }
  });

  it("重名随从（素商、仙音的青鸟）各占一个槽，不互相覆盖", () => {
    const cs = recruit(byName("仙音"), recruit(byName("素商")));
    expect(Object.values(cs).filter((c) => c.label === "青鸟")).toHaveLength(2);
  });

  it("开口方式按类型：机关人偶与哑巴随从不开口、灵兽不说人话、剑灵与人能说话", () => {
    const voice = (name) => {
      const owner = ALL_OC.find((a) => a.follower.name === name);
      const cs = recruit(owner);
      const key = Object.keys(cs).find((k) => cs[k].servantOf);
      return { slot: cs[key], entry: companionNpcEntry(cs, key) };
    };
    expect(voice("铁伯").slot.mute).toBe(true);
    expect(voice("哑奴").entry.cannotSpeak).toBe(true);
    expect(voice("阿财")).toMatchObject({ slot: { beast: true, mute: false }, entry: { cannotSpeak: true } });
    expect(voice("醉花").entry.cannotSpeak).toBeUndefined();
    expect(voice("老仆阿福").entry.cannotSpeak).toBeUndefined();
  });

  it("铁伯保留手写招式与坦克性格", () => {
    const tie = createFollowerCompanion(DUODUO);
    expect(tie.moveset.map((m) => m.name)).toContain("精钢盾甲");
    expect(tie.profile.moveWeights.防御).toBeGreaterThan(tie.profile.moveWeights.攻击);
  });
});

describe("切磋只带出战位那一个", () => {
  it("朵朵出战：己方只有朵朵，铁伯不跟着下场", () => {
    const lineup = duelLineup(recruit(DUODUO), { name: "拦路山贼" });
    expect(lineup.team).toBe(true);
    expect(lineup.allies.map((a) => a.label)).toEqual(["元朵朵"]);
  });

  it("换铁伯出战：己方只有铁伯", () => {
    const cs = setActiveCompanion(recruit(DUODUO), "imported_铁伯");
    expect(duelAllies(cs, { name: "山贼" }).map((a) => a.label)).toEqual(["铁伯"]);
    expect(buildLeopardUnit(cs.imported_铁伯.data).movesetLocal.map((m) => m.name)).toContain("精钢盾甲");
  });

  it("独自上阵打朵朵走 1v1，对手的随从不下场；对手是出战伙伴本人时也是 1v1", () => {
    expect(duelLineup({}, duoduoNpc())).toMatchObject({ team: false, enemies: [{ name: "元朵朵" }] });
    expect(duelAllies(recruit(DUODUO), { name: "元朵朵" })).toEqual([]);
    expect(duelLineup(unlockSnowLeopard({}), duoduoNpc()).enemies).toHaveLength(1);
  });
});

describe("留守各管各的", () => {
  it("留守铁伯只留他一个，朵朵照常随行；唤回也只唤他", () => {
    const cs = setActiveCompanion(recruit(DUODUO), null);
    const stationed = stationCompanion(cs, "imported_铁伯", { roomName: "客栈" });
    expect(stationed.imported_铁伯.stationed).toMatchObject({ roomName: "客栈" });
    expect(stationed.imported_元朵朵.stationed).toBeUndefined();
    expect(unstationCompanion(stationed, "imported_铁伯").imported_铁伯.stationed).toBeUndefined();
  });

  it("出战位上的伙伴不能留守；随从在出战位不拦主人留守", () => {
    const cs = recruit(DUODUO);
    expect(stationCompanion(cs, "imported_元朵朵", { roomName: "客栈" })).toBe(cs);
    const tieActive = setActiveCompanion(cs, "imported_铁伯");
    expect(stationCompanion(tieActive, "imported_元朵朵", { roomName: "客栈" }).imported_元朵朵.stationed).toBeTruthy();
  });
});
