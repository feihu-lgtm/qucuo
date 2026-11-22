import { describe, expect, it } from "vitest";
import { RESIDENT_NPCS } from "../../domain/data/npc/residentNpcs.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { getNpcFaction } from "../../domain/data/factions/npcFactions.js";
import { getResidentRoomForNpc } from "../../domain/rules/map/innerMap.js";
import { FACTION_ENTRIES } from "../../domain/rules/character/factionEntry.js";

const BABU = {
  天王: "厉苍天", 龙王: "厉苍龙", 夜叉: "姬无双", 乾达婆: "凌香儿",
  阿修罗: "樊未离", 迦楼罗: "任天翔", 紧那罗: "罗那", 摩呼罗迦: "罗蛇君",
};
const camp = RESIDENT_NPCS.天龙营;
const quest = (id) => QUCUO_QUESTS.find((entry) => entry.id === id);

describe("天龙教八部护法（原作人名）", () => {
  it("八部护法都在天龙营，各有落脚的房间，都算天龙教的人", () => {
    for (const [title, name] of Object.entries(BABU)) {
      const npc = camp.find((entry) => entry.name === name);
      expect(npc, name).toBeTruthy();
      expect(npc.brief).toContain(title);
      expect(getResidentRoomForNpc("天龙营", name), name).toBeTruthy();
      expect(getNpcFaction(npc), name).toBe("天龙教");
    }
    expect(camp.map((npc) => npc.name)).not.toEqual(expect.arrayContaining(["石重岳", "安世衡"]));
    expect(FACTION_ENTRIES.天龙教.master).toBe("厉苍龙");
  });

  it("夜叉、阿修罗是重头人物：顶档、有完整人设和自己的支线", () => {
    for (const name of ["姬无双", "樊未离"]) {
      const npc = camp.find((entry) => entry.name === name);
      expect(npc.levelCap).toBe(5);
      expect(npc.fullBio.length).toBeGreaterThan(300);
    }
    expect(quest("tianlong_z1_yechaxiyan").giver).toBe("姬无双");
    expect(quest("tianlong_z2_xiuluogong").giver).toBe("樊未离");
  });

  it("两条支线分别打开粮草秘窟和断崖石室", () => {
    const flagsOf = (q) => q.stages.flatMap((stage) => stage.onReach?.flags || []);
    expect(flagsOf(quest("tianlong_z1_yechaxiyan"))).toContain("tianlong_anliang_unlocked");
    expect(flagsOf(quest("tianlong_z2_xiuluogong"))).toContain("tianlong_shishi_unlocked");
    expect(quest("tianlong_z2_xiuluogong").requiresFactionRep).toEqual({ 天龙教: 40 });
  });

  it("给差事的人不在场的那几步不卡人，分支奖励挂在出分支的那一步", () => {
    const stage = (q, id) => quest(q).stages.find((entry) => entry.id === id);
    expect(stage("tianlong_z1_yechaxiyan", "inn").giver).toBeNull();
    expect(stage("tianlong_z2_xiuluogong", "cell").giver).toBeNull();
    for (const [q, id] of [["tianlong_z1_yechaxiyan", "report"], ["tianlong_z2_xiuluogong", "cell"]]) {
      const s = stage(q, id);
      expect(Object.keys(s.onReach.byFlag).sort()).toEqual([...s.completionFlag].sort());
    }
  });
});
