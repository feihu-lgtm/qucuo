import { describe, expect, it } from "vitest";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { CATALOG_INDEX } from "../../domain/data/items/catalog.js";
import { resolveStageRewards } from "../../domain/rules/quests/questRewards.js";

const stage = (questId, stageId) => QUCUO_QUESTS.find((q) => q.id === questId).stages.find((s) => s.id === stageId);
const names = (reward) => (reward.items || []).map((item) => item.name);

describe("土司府府1～府3 合稿证物与旗标", () => {
  it("府1 垫付留下双份税单抄本与税单差额标记", () => {
    const reward = resolveStageRewards(stage("yudingtusi_1_xunshan_cuiliang", "collect"), ["quest_ts1_pay"]);
    expect(reward.flags).toContain("flag_tusi_tax_discrepancy");
    expect(names(reward)).toContain("双份税单抄本");
  });

  it("府2 留证带回三件证物，火烧带回断刃与货单", () => {
    const cache = stage("yudingtusi_2_caodian_anliang", "cache");
    expect(names(resolveStageRewards(cache, ["quest_ts2_evidence"]))).toEqual(expect.arrayContaining(["唐门退墨药水", "血刀暗粮密信", "唐伯渊货单"]));
    expect(names(resolveStageRewards(cache, ["quest_ts2_burn"]))).toEqual(expect.arrayContaining(["血刀断刃", "唐伯渊货单"]));
  });

  it("府3 抄录或呈送都坐实伪契，销毁不坐实", () => {
    const decide = stage("yudingtusi_3_jiuqi_canyin", "decide");
    for (const flag of ["quest_ts3_copy", "quest_ts3_present"]) {
      const reward = resolveStageRewards(decide, [flag]);
      expect(reward.flags, flag).toContain("flag_fake_deed_proved");
      expect(names(reward), flag).toContain("三十年原始地契拓本");
    }
    expect(resolveStageRewards(decide, ["quest_ts3_burn"]).flags).not.toContain("flag_fake_deed_proved");
  });

  it("新证物都进了物品目录", () => {
    for (const name of ["双份税单抄本", "唐门退墨药水", "血刀暗粮密信", "唐伯渊货单", "血刀断刃", "三十年原始地契拓本", "半角血书"]) {
      expect(CATALOG_INDEX[name], name).toBeTruthy();
    }
  });
});
