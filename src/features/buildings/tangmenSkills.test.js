import { describe, expect, it } from "vitest";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import { parseLocalCommand } from "../../engine/localCommands.js";
import { buySkill } from "./logic.js";

const state = (overrides = {}) => ({
  char: { money: 500 }, skills: [], flags: [], questProgress: {},
  varTree: { 世界: { 势力声誉: { 唐门: 200 } } },
  room: { name: "蜀南唐堡" }, innerRoomName: "千机演武坪",
  ...overrides,
});
const skill = (name) => SKILL_CATALOG.唐门.find((entry) => entry.name === name);

describe("唐堡千机演武坪", () => {
  it("binds the Tangmen skill hall to the training ground", () => {
    const id = getBuildingIdForInnerRoom("蜀南唐堡", "千机演武坪");
    expect(getBuildingsForLocation("蜀南唐堡").find((building) => building.id === id)?.skillSet).toBe("唐门");
  });

  it("teaches only the open entry skill until reputation and membership exist", () => {
    const learned = buySkill(state(), skill("寸铁点星手"));
    expect(learned.changes.skills.map((entry) => entry.id)).toEqual(["kf_tm_cuntie"]);
    expect(learned.changes.char.money).toBe(445);
    for (const name of ["药息", "匣中静", "满天星雨", "百毒不侵体"]) {
      const locked = buySkill(state(), skill(name));
      expect(locked.changes, `${name} 不应凭 AI 可写的世界变量解锁`).toBeUndefined();
      expect(locked.logs[0].text).toContain("尚不可学");
    }
  });

  it("uses the same rule from the local command at the current hall only", () => {
    const learned = parseLocalCommand("学武 寸铁点星手", state(), { surface: "cli" }).result;
    expect(learned.changes.skills[0].name).toBe("寸铁点星手");
    const locked = parseLocalCommand("学武 药息", state(), { surface: "cli" }).result;
    expect(locked.changes).toBeUndefined();
    const elsewhere = parseLocalCommand("学武 寸铁点星手", state({ innerRoomName: "吊桥暗渠口" }), { surface: "cli" }).result;
    expect(elsewhere.logs[0].text).toContain("没有武馆");
  });
});
