import { describe, expect, it, vi } from "vitest";
import { NNPC_STAGE } from "../../domain/rules/narrator/narrator.js";
import { SEA_OF_MIND } from "../../domain/rules/narrator/seaOfMind.js";
import {
  portalOpenedRule,
  scheduleTokyoReturnRule,
  villaArrivalRule,
  xuannuTriggerRule,
} from "./rules.js";

describe("narrator world rules", () => {
  it("unlocks the sea when Xuannu recognizes the narrator and preserves the guard", () => {
    const state = {
      char: { name: "旅人" },
      narrator: { affection: SEA_OF_MIND.minAffection },
      varTree: { 世界: { 已认识人物: ["玄女"], 旁白: {} } },
      flags: [],
    };
    const result = xuannuTriggerRule.run(state);
    expect(result.changes.flags([])).toContain(SEA_OF_MIND.flag);
    expect(result.note.owner).toHaveLength(2);
    expect(xuannuTriggerRule.run({
      ...state,
      narrator: { affection: SEA_OF_MIND.minAffection - 1 },
    })).toBeNull();
  });

  it("plays the villa event once unless the narrator is resolved", () => {
    const state = {
      room: { name: SEA_OF_MIND.district },
      innerRoomName: "白色别墅",
      narrator: { stage: NNPC_STAGE.SEA_CRASHED },
      varTree: { 世界: { 旁白: {} } },
    };
    expect(villaArrivalRule.run(state)?.changes.narrator({ stage: "normal" }).stage)
      .toBe(NNPC_STAGE.SEA_CRASHED);
    expect(villaArrivalRule.run({ ...state, innerRoomName: "地下室" })).toBeNull();
    expect(villaArrivalRule.run({
      ...state,
      narrator: { stage: NNPC_STAGE.RESOLVED },
    })).toBeNull();
  });

  it("opens the portal only after trauma is resolved", () => {
    const state = {
      room: { name: SEA_OF_MIND.district },
      narrator: { stage: NNPC_STAGE.RESOLVED },
      varTree: { 世界: { 旁白: { traumaResolved: true } } },
      flags: [],
    };
    expect(portalOpenedRule.run(state)?.changes.flags([])).toContain("传送门已开");
    expect(portalOpenedRule.run({
      ...state,
      varTree: { 世界: { 旁白: { traumaResolved: false } } },
    })).toBeNull();
  });

  it("schedules the Tokyo return once and cancels pending returns on room changes", () => {
    const cancelTokyoReturn = vi.fn();
    const scheduleTokyoReturn = vi.fn();
    const ctx = { cancelTokyoReturn, scheduleTokyoReturn };
    const result = scheduleTokyoReturnRule.run({
      room: { name: "第三新东京市" },
      varTree: { 世界: { 旁白: {} } },
    }, ctx);
    expect(result).toBeTruthy();
    expect(result.changes.varTree({ 世界: { 旁白: {} } }).世界.旁白.tokyoVisited).toBe(true);
    expect(scheduleTokyoReturn).toHaveBeenCalledOnce();
    expect(scheduleTokyoReturnRule.run({
      room: { name: "第三新东京市" },
      varTree: { 世界: { 旁白: { tokyoVisited: true } } },
    }, ctx)).toBeNull();
    expect(scheduleTokyoReturnRule.run({ room: { name: "鱼定村" } }, ctx)).toBeNull();
    expect(cancelTokyoReturn).toHaveBeenCalledTimes(3);
  });
});
