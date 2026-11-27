import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILDING_ART, BUILDING_ID_ART, HOME_ART, MAP_ART, PLACE_ART } from "./artManifest.js";
import { QUCUO_MAP } from "../map/qucuoMap.js";
import { BUILDING_TYPE, getBuildingsForLocation } from "../buildings/qucuoBuildings.js";
import { HOMESTEAD_FEATURES } from "../../rules/map/homestead.js";

const file = (kind, name) => `public/art/${kind}/${name}.webp`;

describe("美术素材登记表", () => {
  it("登记的据点都是真实存在的外层据点，文件都在 public/art/place", () => {
    for (const [name, f] of Object.entries(PLACE_ART)) {
      expect(QUCUO_MAP[name], name).toBeTruthy();
      expect(existsSync(file("place", f)), file("place", f)).toBe(true);
    }
  });

  it("21 个外层据点的头图都已入库", () => {
    expect(Object.keys(PLACE_ART).sort()).toEqual(Object.keys(QUCUO_MAP).sort());
  });

  it("建筑类型图、个别建筑专图、家园设施图的键都对得上游戏数据，文件都在", () => {
    const types = new Set(Object.values(BUILDING_TYPE));
    const ids = new Set(Object.keys(QUCUO_MAP).flatMap((d) => getBuildingsForLocation(d).map((b) => b.id)));
    const homeIds = new Set(Object.values(HOMESTEAD_FEATURES).flatMap((h) => h.features.map((f) => f.id)));
    for (const [k, f] of Object.entries(BUILDING_ART)) { expect(types.has(k), k).toBe(true); expect(existsSync(file("building", f)), f).toBe(true); }
    for (const [k, f] of Object.entries(BUILDING_ID_ART)) { expect(ids.has(k), k).toBe(true); expect(existsSync(file("building", f)), f).toBe(true); }
    for (const [k, f] of Object.entries(HOME_ART)) { expect(homeIds.has(k), k).toBe(true); expect(existsSync(file("building", f)), f).toBe(true); }
    if (MAP_ART) expect(existsSync(file("map", MAP_ART))).toBe(true);
  });
});
