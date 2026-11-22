import { describe, expect, it } from "vitest";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { getContent } from "../../domain/rules/content/registry.js";
import { isQuestGateOpen } from "../../domain/rules/quests/questEngine.js";
import { resolveStageRewards } from "../../domain/rules/quests/questRewards.js";
import { getInnerRoom, isInnerExitUnlocked } from "../../domain/rules/map/innerMap.js";

const find = (id) => QUCUO_QUESTS.find((quest) => quest.id === id);
const rep = (value) => ({ 世界: { 势力声誉: { 鱼定村: value } } });
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, { status: "completed" }]));
const last = (quest) => quest.stages[quest.stages.length - 1];
const withFlag = (quest, flag) => quest.stages.find((stage) => stage.onReach?.byFlag?.[flag]);
const YUDING = QUCUO_QUESTS.filter((quest) => /^(village[1-6]_|yudingcun_)/.test(quest.id));

describe("鱼定村任务线", () => {
  it("keeps 村1～村6 ids and adds 三条 yudingcun_ 支线, gates ≤ 100", () => {
    expect(YUDING.map((quest) => quest.id)).toEqual(expect.arrayContaining([
      "village1_lubujianbuping", "village2_jieshixiajiu", "village3_zanghan_hunshi",
      "village4_zahuoshangren_jinhuonan", "village5_laolieshu_chuanren", "village6_jieshichongli",
      "yudingcun_side1_yushan_chuhuan", "yudingcun_side2_shuangshui_ka", "yudingcun_side3_ye_song_chaomian",
    ]));
    for (const quest of YUDING) {
      expect(quest.requiresFactionRep?.鱼定村, quest.id).toBeDefined();
      expect(quest.requiresFactionRep.鱼定村, quest.id).toBeLessThanOrEqual(100);
    }
  });

  it("gates 村5 and 村6 on rep and prerequisites", () => {
    const v5 = find("village5_laolieshu_chuanren");
    const pre5 = done("village1_lubujianbuping", "yudingcun_side1_yushan_chuhuan");
    expect(isQuestGateOpen(v5, pre5, [], rep(39))).toBe(false);
    expect(isQuestGateOpen(v5, done("village1_lubujianbuping"), [], rep(40))).toBe(false);
    expect(isQuestGateOpen(v5, pre5, [], rep(40))).toBe(true);
    const v6 = find("village6_jieshichongli");
    const pre6 = done("village2_jieshixiajiu", "village3_zanghan_hunshi", "village4_zahuoshangren_jinhuonan", "village5_laolieshu_chuanren");
    expect(isQuestGateOpen(v6, pre6, [], rep(59))).toBe(false);
    expect(isQuestGateOpen(v6, pre6, [], rep(60))).toBe(true);
    const active = { village5_laolieshu_chuanren: { status: "active" }, village1_lubujianbuping: { status: "completed" } };
    expect(isQuestGateOpen(v5, active, [], rep(0))).toBe(true);
  });

  it("pays 合稿 branch rewards", () => {
    const v1 = resolveStageRewards(withFlag(find("village1_lubujianbuping"), "quest_village1_s2_a"), ["quest_village1_s2_a"]);
    expect(v1).toMatchObject({ money: 30, factionRep: { 鱼定村: 15, 玉泉寨: 5, 鱼定土司府: -5 } });
    const v2 = resolveStageRewards(withFlag(find("village2_jieshixiajiu"), "quest_village2_s3_a"), ["quest_village2_s3_a"]);
    expect(v2.flags).toContain("flag_yuding_deed_clue");
    const v6 = resolveStageRewards(last(find("village6_jieshichongli")), []);
    expect(v6).toMatchObject({ money: 120, factionRep: { 鱼定村: 35, 鱼定土司府: -15 } });
    expect(v6.flags).toContain("flag_endgame_ally_yuding");
    const s3 = resolveStageRewards(withFlag(find("yudingcun_side3_ye_song_chaomian"), "quest_ydside3_betray"), ["quest_ydside3_betray"]);
    expect(s3).toMatchObject({ money: 100, factionRep: { 鱼定土司府: 15, 鱼定村: -25 } });
  });

  it("rewards only catalog items", () => {
    for (const quest of YUDING) for (const stage of quest.stages) {
      const groups = [stage.onReach, ...Object.values(stage.onReach?.byFlag || {})];
      for (const group of groups) for (const item of group?.items || []) {
        if (item.fromCatalog) expect(getContent("item", item.name), item.name).toBeTruthy();
      }
    }
  });

  it("opens 界石旧窖 after 村2 deed clue", () => {
    const lock = getInnerRoom("鱼定村", "界石旧窖").unlockCondition;
    expect(isInnerExitUnlocked(lock, { flags: [] })).toBe(false);
    expect(isInnerExitUnlocked(lock, { flags: ["flag_yuding_deed_clue"] })).toBe(true);
  });
});
