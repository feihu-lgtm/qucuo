import { describe, expect, it } from "vitest";
import { BUILDINGS_BY_LOCATION } from "../../data/buildings/qucuoBuildings.js";
import { FACTIONS } from "../../data/map/factions.js";
import { INNER_MAP } from "../map/innerMap.js";
import { buySkill } from "../../../features/buildings/skills.js";
import { HOSTILE_CLOSURES, buildingClosedReason } from "./strongholdGate.js";

const tree = (faction, rep, prestige = 0) => ({ 世界: { 威望: prestige, 势力声誉: { [faction]: rep } } });
const buildingById = Object.fromEntries(
  Object.entries(BUILDINGS_BY_LOCATION).flatMap(([district, list]) => list.map((b) => [b.id, { ...b, district }])),
);

describe("不共戴天档据点建筑闭门", () => {
  it("登记的势力、建筑都真实存在，且不和土司府整据点门禁重复", () => {
    const names = new Set(FACTIONS.map((f) => f.name));
    for (const entry of HOSTILE_CLOSURES) {
      expect(names.has(entry.faction), entry.faction).toBe(true);
      expect(entry.faction).not.toBe("鱼定土司府");
      for (const id of entry.buildings) expect(buildingById[id], id).toBeTruthy();
    }
  });

  it("声誉 ≤ -60 时打开就给一句原因，-59 照常营业", () => {
    for (const entry of HOSTILE_CLOSURES) {
      for (const id of entry.buildings) {
        const building = buildingById[id];
        expect(buildingClosedReason(building, building.district, tree(entry.faction, -60))).toBe(entry.closed);
        expect(buildingClosedReason(building, building.district, tree(entry.faction, -59))).toBeNull();
      }
    }
  });

  it("只锁合稿点名的建筑：同据点的中立铺子不受牵连", () => {
    const neutral = ["shop_yajiang", "inn_tiandu", "shop_jingguan", "pigeon_coop_xibian", "chest_xibian", "temple_lama"];
    const allHostile = Object.fromEntries(FACTIONS.map((f) => [f.name, -100]));
    for (const id of neutral) {
      const building = buildingById[id];
      expect(buildingClosedReason(building, building.district, { 世界: { 势力声誉: allHostile } }), id).toBeNull();
    }
  });

  it("峨眉剑庐：全局威望 ≤ -60 也闭门", () => {
    const fotang = buildingById.hospital_emei_fotang;
    expect(buildingClosedReason(fotang, "锦官城", tree("峨眉派", 0, -60))).toMatch(/剑庐/);
    expect(buildingClosedReason(fotang, "锦官城", tree("峨眉派", 0, -59))).toBeNull();
  });

  it("文字命令学武也走同一道门：闭门的武馆学不了", () => {
    const [room] = Object.entries(INNER_MAP["天都镇"].rooms || INNER_MAP["天都镇"])
      .find(([, r]) => r?.buildingId === "wuguan_huanxitang");
    const state = {
      room: { name: "天都镇" },
      innerRoomName: room,
      skills: [],
      char: { money: 99999 },
      varTree: tree("欢喜教", -60),
    };
    const result = buySkill(state, { id: "x", name: "x", price: 1 });
    expect(result.logs[0].text).toContain("闭门落锁");
    expect(result.skills).toBeUndefined();
  });
});
