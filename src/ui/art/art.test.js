import { describe, expect, it } from "vitest";
import { buildingArtUrl, districtOfRoomLine, homeArtUrl, mapArtUrl, placeArtUrl } from "./art.js";

describe("按字段查图", () => {
  it("据点按外层名查图，没登记的返回 null", () => {
    expect(placeArtUrl("鱼定村")).toMatch(/art\/place\/L01\.webp$/);
    expect(placeArtUrl("不存在的地方")).toBeNull();
  });

  it("建筑先查个别专图，再查类型图，都没有返回 null", () => {
    const byId = { hot_spring: "B-hotspring" };
    const byType = { hospital: "B05-hospital" };
    expect(buildingArtUrl({ id: "hot_spring", type: "hospital" }, { byId, byType })).toMatch(/B-hotspring\.webp$/);
    expect(buildingArtUrl({ id: "clinic", type: "hospital" }, { byId, byType })).toMatch(/B05-hospital\.webp$/);
    expect(buildingArtUrl({ id: "x", type: "inn" }, { byId, byType })).toBeNull();
    expect(buildingArtUrl(null)).toBeNull();
  });

  it("家园设施与舆图底卷没登记时返回 null", () => {
    expect(homeArtUrl("cooking", {})).toBeNull();
    expect(homeArtUrl("cooking", { cooking: "B09-cooking" })).toMatch(/building\/B09-cooking\.webp$/);
    expect(mapArtUrl(null)).toBeNull();
  });

  it("主栏地名行归到外层据点名", () => {
    expect(districtOfRoomLine("    鱼定村")).toBe("鱼定村");
    expect(districtOfRoomLine("    鱼定村·歇马居")).toBe("鱼定村");
    expect(districtOfRoomLine("    天都镇（马车）")).toBe("天都镇");
    expect(districtOfRoomLine("")).toBe("");
  });
});
