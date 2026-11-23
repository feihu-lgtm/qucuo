import { describe, expect, it } from "vitest";
import { buildQuestStageNote } from "./roundNotes.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";

const base = {
  questProgress: {}, flags: [], varTree: { 世界: { 势力声誉: { 玉泉寨: 50 } } },
  char: {}, inv: [], room: { name: "天都镇", npcs: [], items: [], exits: [] },
  innerRoomName: "镇口", visibleNpcs: [], convo: [], questTriggerMode: "script",
};

describe("buildQuestStageNote · 地点锚定", () => {
  const yq2 = QUCUO_QUESTS.find(q => q.id === "yuquanzhai_2_liruoyoudeshangduizhang");

  it("未开始的泉2：在天都镇镇口才提示 flag，在玉泉寨找李若由不给天都镇的对质 flag", () => {
    const atPlace = buildQuestStageNote({ ...base });
    expect(atPlace).toContain("quest_yuquanzhai2_open");
    const atGiver = buildQuestStageNote({
      ...base, room: { name: "玉泉寨", npcs: [{ name: "李若由" }], items: [], exits: [] },
      innerRoomName: "玉泉小栈",
    });
    expect(atGiver).not.toContain("quest_yuquanzhai2_open");
    expect(atGiver).not.toContain("quest_yuquanzhai2_settle");
  });

  it("进行中的阶段：requireLocation 不满足时只给地点提示、不给 flag", () => {
    const note = buildQuestStageNote({
      ...base,
      room: { name: "玉泉寨", npcs: [{ name: "李若由" }], items: [], exits: [] },
      innerRoomName: "玉泉小栈",
      questProgress: { [yq2.id]: { status: "active", currentStageIndex: 0 } },
    });
    expect(note).toContain("不在其地");
    expect(note).not.toContain("quest_yuquanzhai2_open");
  });

  it("deliver 阶段：收件人不在场或空手都禁吐 flag，到齐才教吐旗", () => {
    const village2Base = {
      ...base,
      varTree: { 角色: {}, 世界: { 势力声誉: { 鱼定村: 20 } } },
      room: { name: "鱼定村", npcs: [{ name: "才旦" }, { name: "老孙" }], items: [], exits: [] },
      questProgress: {
        village1_lubujianbuping: { status: "completed", currentStageIndex: 2 },
        village2_jieshixiajiu: { status: "active", currentStageIndex: 0 },
      },
      inv: [{ name: "糌粑" }],
    };
    // 在发布人家里（老孙绑定老孙饭馆）：禁吐
    const atGiver = buildQuestStageNote({ ...village2Base, innerRoomName: "才旦家" });
    expect(atGiver).toContain("老孙跟前");
    expect(atGiver).not.toContain('加入"quest_village2_s1"');
    // 在收件人跟前但空手：禁吐
    const emptyHanded = buildQuestStageNote({ ...village2Base, innerRoomName: "老孙饭馆", inv: [] });
    expect(emptyHanded).toContain("备好「糌粑」");
    expect(emptyHanded).not.toContain('加入"quest_village2_s1"');
    // 收件人跟前且带件：照教吐旗
    const ready = buildQuestStageNote({ ...village2Base, innerRoomName: "老孙饭馆" });
    expect(ready).toContain('"quest_village2_s1"');
  });
});
