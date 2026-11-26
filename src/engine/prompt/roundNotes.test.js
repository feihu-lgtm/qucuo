// B1：判官双调用模式下任务阶段提示不再要求模型吐 flags_add；单调用老路保留。
import { describe, expect, it } from "vitest";
import { buildQuestStageNote, shouldSuppressModelFlags } from "./roundNotes.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";

// 找一个有首阶段 completionFlag 且 giver 明确的非 localOnly 真实任务
const REAL = QUCUO_QUESTS.find((q) => !q.localOnly && q.id !== "snow_leopard_quest"
  && q.stages?.[0]?.completionFlag && q.giver && q.stages[0].giver !== null);

const base = {
  questProgress: {}, flags: [], varTree: {}, char: {}, inv: [],
  room: { name: "鱼定村", npcs: [{ name: REAL?.giver || "老孙" }] },
  visibleNpcs: [], convo: [], settleNpc: null, cmd: "聊聊",
  innerRoomName: null, questTriggerMode: "prompt",
};

describe("shouldSuppressModelFlags 与判官激活闸同源", () => {
  const cfg = { judgePipelineEnabled: true, extractionEnabled: true };
  it("非 settle 双调用才 suppress；settle 回合不 suppress", () => {
    expect(shouldSuppressModelFlags(cfg, false)).toBe(true);
    expect(shouldSuppressModelFlags(cfg, true)).toBe(false);
  });
  it("单调用/判官关闭永不 suppress", () => {
    expect(shouldSuppressModelFlags({ judgePipelineEnabled: false, extractionEnabled: true }, false)).toBe(false);
    expect(shouldSuppressModelFlags({ judgePipelineEnabled: true, extractionEnabled: false }, false)).toBe(false);
    expect(shouldSuppressModelFlags(undefined, false)).toBe(false);
  });
});

describe("buildQuestStageNote flags_add 指令压下", () => {
  it("单调用老路：提示含 flags_add 指令", () => {
    const note = buildQuestStageNote({ ...base, suppressModelFlags: false });
    expect(note).toContain("flags_add");
  });
  it("判官双调用：不再出现 flags_add 任务旗指令，改为系统自会判定", () => {
    const note = buildQuestStageNote({ ...base, suppressModelFlags: true });
    expect(note).not.toContain("在 flags_add 加入");
    expect(note).toContain("系统自会判定");
  });
  it("判官双调用：有 choices 的面板阶段提示保留（不替玩家抉择）", () => {
    // choices 阶段提示本来就不让吐 flag，两种模式都该保留该句型
    const note = buildQuestStageNote({ ...base, suppressModelFlags: true });
    expect(note).not.toContain("flags_add 加入");
  });
  it("不再注入已废弃的 pendingQuestBranch mode=talk [说服判定] 提示", () => {
    const note = buildQuestStageNote({ ...base, pendingQuestBranch: { mode: "talk", goal: "交出旧信", flag: "交信" } });
    expect(note).not.toContain("[说服判定]");
  });
});

describe("W-ROAM buildRecentMovementNote 主叙事同源感知", () => {
  it("本拍进出拼入固定文案，离场者禁写开口", async () => {
    const { buildRecentMovementNote } = await import("./roundNotes.js");
    const room = { recentMovements: [
      { name: "路人甲", kind: "depart", from: "村口", to: "歇马居", dir: "w", turn: 7 },
      { name: "货郎", kind: "arrive", from: "歇马居", to: "村口", dir: "e", turn: 7 },
    ] };
    const note = buildRecentMovementNote(room, 7);
    expect(note).toContain("【方才人物进出】");
    expect(note).toContain("刚走入此处：货郎");
    expect(note).toContain("刚离开此处：路人甲");
    expect(note).toContain("严禁再写其开口搭话");
  });

  it("紧邻上一拍（time-1）也算；更早或没有记录返回空串", async () => {
    const { buildRecentMovementNote } = await import("./roundNotes.js");
    const room = { recentMovements: [{ name: "路人甲", kind: "depart", from: "村口", to: "歇马居", dir: "w", turn: 6 }] };
    expect(buildRecentMovementNote(room, 7)).toContain("路人甲");
    expect(buildRecentMovementNote(room, 8)).toBe("");
    expect(buildRecentMovementNote({}, 7)).toBe("");
    expect(buildRecentMovementNote(null, 7)).toBe("");
  });
});
