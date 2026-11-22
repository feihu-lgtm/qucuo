import { describe, expect, it } from "vitest";
import { settleNpcDuel } from "../npc/settleDuel.js";
import { buildQuestFoe } from "./combatChoice.js";
import { migrateLegacySnapshot } from "../../domain/rules/npc/legacyContent.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";

const QID = "huanxijiao_2_biwuzhaoxian";
const stages = QUCUO_QUESTS.find((quest) => quest.id === QID).stages;
const choiceOf = (id) => stages.find((stage) => stage.id === id).choices[0];

describe("香2 比武招贤", () => {
  it("第三场输了：连胜作废，退回第一场，收回前两场的 flag", () => {
    const flags = ["quest_huanxijiao2_s1", "quest_huanxijiao2_bout2", "other"];
    const questProgress = { [QID]: { status: "active", currentStageIndex: 2 } };
    const choice = choiceOf("s1_bout3");
    const result = settleNpcDuel({ flags, questProgress }, buildQuestFoe(choice, 1), {
      outcome: "lose", pendingQuestBranch: { questId: QID, flag: choice.flag, mode: "combat" },
    });
    expect(result.changes.flags(flags)).toEqual(["other"]);
    expect(result.changes.questProgress(questProgress)[QID].currentStageIndex).toBe(0);
  });

  it("愣头侠客、罗琦不算恶人（不计雪豹任务的打退恶人）", () => {
    expect(buildQuestFoe(choiceOf("s1_tournament"), 1).hostile).toBe(false);
    expect(buildQuestFoe(choiceOf("s2_spar"), 1).hostile).toBe(false);
    expect(buildQuestFoe(choiceOf("s1_bout2"), 1).hostile).toBe(true);
  });

  it("老档（旧 3 步版停在正殿问话）读档后回到第二场擂台；新档序号不变", () => {
    const old = migrateLegacySnapshot({ flags: ["quest_huanxijiao2_s1", "quest_huanxijiao2_s2"], questProgress: { [QID]: { status: "active", currentStageIndex: 2 } } });
    expect(old.questProgress[QID].currentStageIndex).toBe(1);
    const fresh = { flags: ["quest_huanxijiao2_s1", "quest_huanxijiao2_bout2", "quest_huanxijiao2_bout3", "quest_huanxijiao2_s2"], questProgress: { [QID]: { status: "active", currentStageIndex: 4 } } };
    expect(migrateLegacySnapshot(fresh).questProgress[QID].currentStageIndex).toBe(4);
  });
});
