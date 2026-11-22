import { describe, expect, it } from "vitest";
import { FACTION_NAMES } from "../../data/map/factions.js";
import {
  DEFECT_REP_RESET,
  EXPEL_REP_RESET,
  NON_JOINABLE_FACTIONS,
  SECT_ENTRIES,
  checkSectEntry,
  computeDefectRep,
  defectedFlag,
  getPlayerSect,
  getSectEntry,
} from "./sectEntry.js";

describe("sectEntry rules", () => {
  it("partitions all 16 factions into 9 joinable sects and 7 non-joinable factions", () => {
    const joinable = Object.keys(SECT_ENTRIES);
    expect(joinable).toHaveLength(9);
    expect(NON_JOINABLE_FACTIONS).toHaveLength(7);
    expect([...joinable, ...NON_JOINABLE_FACTIONS].sort()).toEqual([...FACTION_NAMES].sort());
  });

  it("enforces per-sect entry thresholds and single primary sect limit", () => {
    const qcTrial = ["qingcheng_spar_first"];
    expect(checkSectEntry({ flags: qcTrial, varTree: { 世界: { 威望: 0, 势力声誉: { 青城派: 40 } } } }, "青城派").eligible).toBe(true);
    expect(checkSectEntry({ flags: [], varTree: { 世界: { 威望: 0, 势力声誉: { 青城派: 40 } } } }, "青城派").eligible).toBe(false);
    expect(checkSectEntry({ flags: qcTrial, varTree: { 世界: { 威望: -1, 势力声誉: { 青城派: 40 } } } }, "青城派").eligible).toBe(false);
    expect(checkSectEntry({ varTree: { 世界: { 威望: -50, 势力声誉: { 唐门: 40 } } } }, "唐门").eligible).toBe(true);
    expect(checkSectEntry({ varTree: { 世界: { 威望: -61, 势力声誉: { 三星派: 40 } } } }, "三星派").eligible).toBe(false);
    expect(checkSectEntry({ varTree: { 世界: { 威望: -60, 势力声誉: { 三星派: 40 } } } }, "三星派").eligible).toBe(true);
    expect(checkSectEntry({
      varTree: { 世界: { 势力声誉: { 欢喜教: 40 } } },
      questProgress: {},
    }, "欢喜教").eligible).toBe(false);
    expect(checkSectEntry({
      varTree: { 世界: { 势力声誉: { 欢喜教: 40 } } },
      questProgress: { huanxijiao_2_biwuzhaoxian: { status: "completed" } },
    }, "欢喜教").eligible).toBe(true);

    // 单主门派上限
    const blocked = checkSectEntry({
      flags: ["雪山派弟子", ...qcTrial],
      varTree: { 世界: { 威望: 10, 势力声誉: { 青城派: 60 } } },
    }, "青城派");
    expect(blocked.eligible).toBe(false);
    expect(blocked.currentSect).toBe("雪山派");
    expect(blocked.missing).toContain("single");

    // 叛出后门墙永闭
    const closed = checkSectEntry({
      flags: [defectedFlag("青城派")],
      varTree: { 世界: { 威望: 10, 势力声誉: { 青城派: 80 } } },
    }, "青城派");
    expect(closed.eligible).toBe(false);
    expect(closed.defected).toBe(true);
  });

  it("supports Xueshan both via legacy inner-hall path and rep >= 40 path", () => {
    const repPath = checkSectEntry({ varTree: { 世界: { 威望: 0, 势力声誉: { 雪山派: 40 } } } }, "雪山派");
    expect(repPath.eligible).toBe(true);
    expect(repPath.tuitionDue).toBe(0);

    const legacyPath = checkSectEntry({ affection: 30, neigong: 5, money: 100 }, "雪山派");
    expect(legacyPath.eligible).toBe(true);
    expect(legacyPath.tuitionDue).toBe(100);
  });

  it("resets reputation on defect/expel without raising already lower rep", () => {
    expect(computeDefectRep(80, "defect")).toBe(DEFECT_REP_RESET);
    expect(computeDefectRep(-55, "defect")).toBe(-55);
    expect(computeDefectRep(60, "expel")).toBe(EXPEL_REP_RESET);
    expect(computeDefectRep(-90, "expel")).toBe(-90);
    expect(getPlayerSect(["唐门弟子"])).toBe("唐门");
    expect(getSectEntry({ id: "sect_entry_yajiang", sect: "青城派" }).sect).toBe("青城派");
  });
});
