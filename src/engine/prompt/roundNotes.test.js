// B1：判官双调用模式下任务阶段提示不再要求模型吐 flags_add；单调用老路保留。
import { describe, expect, it } from "vitest";
import { buildQuestStageNote } from "./roundNotes.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";

// 找一个有首阶段 completionFlag 且 giver 明确的非 localOnly 真实任务
const REAL = QUCUO_QUESTS.find((q) => !q.localOnly && q.id !== "snow_leopard_quest"
  && q.stages?.[0]?.completionFlag && q.giver && q.stages[0].giver !== null);

const base = {
  questProgress: {}, flags: [], varTree: {}, char: {}, inv: [],
  room: { name: "鱼定村", npcs: [{ name: REAL?.giver || "老孙" }] },
  pendingQuestBranch: null, visibleNpcs: [], convo: [], settleNpc: null, cmd: "聊聊",
  innerRoomName: null, questTriggerMode: "prompt",
};

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
});
