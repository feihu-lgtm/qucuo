import { expect, it } from "vitest";
import { buildPresence, buildNpcContext, buildQuestStageNote, buildForcedEventNote, buildArrivalNote } from "../prompt/index.js";

export const fixture = {
  convo: [{ role: "assistant", content: "故人还在等你。" }],
  preset: { npcLore: [{ name: "故人", entry: "旧时的朋友" }] },
  room: { name: "荒野", npcs: [{ name: "故人" }], items: [], exits: [] },
  cmd: "你好", isTalk: true, questProgress: {},
  varTree: { 世界: { 已认识人物: ["故人"], 上次同框回合: { 故人: 0 } } },
  time: 300, companionState: {}, nsfwOn: false, flags: [], char: {}, inv: [],
};

it("preserves the original round-note bytes", () => {
  expect({
    presence: buildPresence(fixture),
    npc: buildNpcContext({ ...fixture, visibleNpcs: fixture.room.npcs }),
    quest: buildQuestStageNote(fixture),
    forced: buildForcedEventNote("故人递来旧信", "故人", 500),
    arrival: buildArrivalNote({ isTalk: false, movingDir: "north", lockedDestName: "荒野" }),
  }).toMatchSnapshot();
});
