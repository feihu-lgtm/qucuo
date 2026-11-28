import { describe, expect, it } from "vitest";
import { QUCUO_MAP, findPath } from "../../domain/data/map/qucuoMap.js";
import { INNER_MAP, getInnerRoom, visibleInnerExits, getBuildingIdForInnerRoom, getResidentRoomForNpc } from "../../domain/rules/map/innerMap.js";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { skillUnlockStatus } from "../../domain/rules/economy/skillUnlock.js";
import { FACTION_ENTRIES, SECT_MEMBER_FLAGS, checkFactionEntry } from "../../domain/rules/character/factionEntry.js";
import { joinSect } from "../sect/logic.js";
import { buyFactionShopItem, factionShopOffer } from "./factionShop.js";
import { buildingClosedReason } from "../../domain/rules/economy/strongholdGate.js";
import { RESIDENT_NPCS } from "../../domain/data/npc/residentNpcs.js";
import { NPC_SIGNATURE_MOVES } from "../../domain/data/npc/npcSignatureMoves.js";

describe("雪域三宗与打箭炉 · 拓扑与箱庭", () => {
  it("新增四大据点接入外层地图且与周边双向连通", () => {
    expect(QUCUO_MAP.打箭炉).toMatchObject({ x: 1, y: 0, exits: { w: "鱼定村", e: "雅江", s: "天都镇" } });
    expect(QUCUO_MAP.丹霞城).toMatchObject({ x: -1, y: -1, exits: { e: "喇嘛庙", s: "鱼定土司", n: "琼隆古墟" } });
    expect(QUCUO_MAP.焚风渡).toMatchObject({ x: 0, y: 3, exits: { n: "玉泉寨" } });
    expect(QUCUO_MAP.琼隆古墟).toMatchObject({ x: -1, y: -2, exits: { e: "白塔", s: "丹霞城" } });
    for (const d of ["打箭炉", "丹霞城", "焚风渡", "琼隆古墟"]) {
      expect(findPath("鱼定村", d)).toBeTruthy();
      expect(findPath(d, "鱼定村")).toBeTruthy();
    }
  });

  it("四据点箱庭与白塔十房升格房间数齐备", () => {
    expect(Object.keys(INNER_MAP.打箭炉.rooms)).toHaveLength(12);
    expect(Object.keys(INNER_MAP.丹霞城.rooms)).toHaveLength(13);
    expect(Object.keys(INNER_MAP.焚风渡.rooms)).toHaveLength(12);
    expect(Object.keys(INNER_MAP.琼隆古墟.rooms)).toHaveLength(12);
    expect(Object.keys(INNER_MAP.白塔.rooms)).toHaveLength(10);
    expect(INNER_MAP.白塔.anchor).toBe("塔基石柱前院");
    expect(getBuildingsForLocation("白塔").map((b) => b.id)).toEqual(
      expect.arrayContaining(["library_baita", "wuguan_baita", "temple_baita", "baita_crypt_entrance"]),
    );
  });

  it("八思巴铁券阁须萨迦世家声誉 >= 40 方在出口可见", () => {
    expect(getInnerRoom("丹霞城", "八思巴铁券阁").unlockCondition).toEqual({ type: "factionRep", faction: "萨迦世家", min: 40 });
    expect(visibleInnerExits("丹霞城", "昆氏道果正殿", { varTree: { 世界: { 势力声誉: { 萨迦世家: 39 } } } })).not.toHaveProperty("e");
    expect(visibleInnerExits("丹霞城", "昆氏道果正殿", { varTree: { 世界: { 势力声誉: { 萨迦世家: 40 } } } })).toHaveProperty("e", "八思巴铁券阁");
  });
});

describe("雪域三宗 · 拜师、商坊与死敌闭门", () => {
  const sects = [
    ["萨迦世家", "丹霞城", "三色花墙正门", "外姓护法堂", "wuguan_sajia", "萨迦三色护法牌", "昆氏金刚法杵"],
    ["噶举山人", "焚风渡", "百幡白石山门", "四大八小盘道廊", "wuguan_gaju", "白幡口传信物", "三迦叶赤铜戒刀"],
    ["古象雄苯门", "琼隆古墟", "左旋雍仲正门", "掘藏奇珍阁", "wuguan_benmen", "左旋雍仲黑铜牌", "大鹏裂石爪套"],
  ];

  it.each(sects)("%s 可正常拜入、发信物并在商坊按声誉与门籍购货", (sect, district, entryRoom, shopKey, wuguanId, token, topWeapon) => {
    const entry = FACTION_ENTRIES[sect];
    expect(entry).toBeTruthy();
    expect(checkFactionEntry(entry, { varTree: { 世界: { 势力声誉: { [sect]: 39 } } }, flags: [] }).eligible).toBe(false);
    expect(checkFactionEntry(entry, { varTree: { 世界: { 势力声誉: { [sect]: 40 } } }, flags: [] }).eligible).toBe(true);

    const state = {
      room: { name: district },
      innerRoomName: entryRoom,
      flags: [],
      inv: [],
      skills: [],
      char: { money: 10000, special: { 魅力: 5, 智谋: 5 } },
      varTree: { 世界: { 势力声誉: { [sect]: 40 } }, 角色: {} },
      questProgress: {},
      time: 10,
    };
    const res = joinSect(state);
    expect(res.changes.flags([])).toContain(SECT_MEMBER_FLAGS[sect]);
    expect(res.changes.inv([]).map((it) => it.name)).toContain(token);

    const shopId = getBuildingIdForInnerRoom(district, shopKey);
    const fullState = {
      ...state,
      innerRoomName: shopKey,
      flags: [SECT_MEMBER_FLAGS[sect]],
      varTree: { 世界: { 势力声誉: { [sect]: 100 } } },
    };
    const offer = factionShopOffer(shopKey, fullState.varTree, "vault", fullState.flags);
    expect(offer.items.map((it) => it.name)).toContain(topWeapon);
    const bought = buyFactionShopItem(fullState, shopKey, topWeapon);
    expect(bought.changes.inv([]).map((it) => it.name)).toContain(topWeapon);

    const wuguan = getBuildingsForLocation(district).find((b) => b.id === wuguanId);
    expect(buildingClosedReason(wuguan, district, { 世界: { 势力声誉: { [sect]: -60 } } })).toBeTruthy();
    expect(buildingClosedReason(wuguan, district, { 世界: { 势力声誉: { [sect]: -59 } } })).toBeNull();
    expect(shopId).toBeTruthy();
  });
});

describe("雪域三宗与打箭炉 · 18 门武学与常驻人物", () => {
  it("四组新武学共 18 门，门槛与无门槛分布正确", () => {
    expect(SKILL_CATALOG.打箭炉).toHaveLength(3);
    expect(SKILL_CATALOG.萨迦).toHaveLength(5);
    expect(SKILL_CATALOG.噶举).toHaveLength(5);
    expect(SKILL_CATALOG.苯门).toHaveLength(5);

    const openDjl = SKILL_CATALOG.打箭炉.every((s) => skillUnlockStatus({ flags: [], questProgress: {}, varTree: {} }, s).ok);
    expect(openDjl).toBe(true);

    const topSajia = SKILL_CATALOG.萨迦.find((s) => s.name === "道果大威德功");
    expect(skillUnlockStatus({ flags: [], questProgress: {}, varTree: { 世界: { 势力声誉: { 萨迦世家: 100 } } } }, topSajia).ok).toBe(false);
    expect(skillUnlockStatus({ flags: [SECT_MEMBER_FLAGS.萨迦世家], questProgress: {}, varTree: { 世界: { 势力声誉: { 萨迦世家: 100 } } } }, topSajia).ok).toBe(true);
  });

  it("30 位常驻 NPC 落位对应内层房间且核心高手配齐四槽专属招式", () => {
    expect(RESIDENT_NPCS.打箭炉).toHaveLength(8);
    expect(RESIDENT_NPCS.丹霞城).toHaveLength(7);
    expect(RESIDENT_NPCS.焚风渡).toHaveLength(8);
    expect(RESIDENT_NPCS.琼隆古墟).toHaveLength(7);
    for (const d of ["打箭炉", "丹霞城", "焚风渡", "琼隆古墟"]) {
      for (const npc of RESIDENT_NPCS[d]) {
        expect(getResidentRoomForNpc(d, npc.name), `${d}·${npc.name}`).toBeTruthy();
      }
    }
    for (const master of [
      "康巴总教头·扎巴", "调停客宗喀", "大轮法王·卓玛嘉", "昆·法王丹巴坚赞",
      "拜火大迦叶·燃灯", "转世法王·白衣少年", "金翅武师·阿古顿巴", "象雄大宗主·桑吉坚赞",
    ]) {
      expect(NPC_SIGNATURE_MOVES[master], master).toBeTruthy();
    }
  });
});
