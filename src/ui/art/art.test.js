import { describe, expect, it } from "vitest";
import {
  buildingArtUrl,
  classifyItemArtKey,
  districtOfRoomLine,
  homeArtUrl,
  itemArtUrl,
  mapArtUrl,
  narratorArtUrl,
  npcArtUrl,
  placeArtUrl,
  questArtUrl,
  roomArtUrl,
} from "./art.js";

describe("按字段查图", () => {
  it("据点按外层名查图，没登记的返回 null", () => {
    expect(placeArtUrl("鱼定村")).toMatch(/art\/place\/L01\.webp$/);
    expect(placeArtUrl("不存在的地方")).toBeNull();
  });

  it("内层房间按所属据点查专图，不把同名房间或建筑当作场景", () => {
    expect(roomArtUrl("打箭炉", "折多索桥")).toBe("/art/room/dajianlu-04.webp");
    expect(roomArtUrl("丹霞城", "折多索桥")).toBeNull();
    expect(roomArtUrl("打箭炉", "榷茶官栈")).toBeNull();
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

  it("人物头像优先玩家上传覆盖，再查已入库 webp，未入库返回 null", () => {
    expect(npcArtUrl("元朵朵")).toMatch(/art\/npc\/.*\.webp$/);
    expect(npcArtUrl("不存在的NPC")).toBeNull();
    expect(npcArtUrl("元朵朵", { 元朵朵: "data:image/png;base64,abc" })).toBe("data:image/png;base64,abc");
  });

  it("uses generated role art without treating random names as curated characters", () => {
    const npc = { name: "韩石头", passerArt: "passer-mountain-hunter" };
    expect(npcArtUrl(npc)).toMatch(/art\/passer\/passer-mountain-hunter\.webp$/);
    expect(npcArtUrl(npc.name)).toBeNull();
    expect(npcArtUrl(npc, { 韩石头: "data:image/png;base64,abc" })).toBe("data:image/png;base64,abc");
  });

  it("物品按类别与关键词归入 36 类实物图标", () => {
    expect(classifyItemArtKey({ name: "鱼定长枪", category: "weapon" })).toBe("weapon-spear");
    expect(classifyItemArtKey({ name: "青布长衫", category: "armor" })).toBe("armor-cloth");
    expect(classifyItemArtKey({ name: "玉器轩断簪", category: "accessory" })).toBe("accessory-hairpin");
    expect(classifyItemArtKey("青稞炒面")).toBe("misc-food");
    expect(itemArtUrl("雪山当归")).toMatch(/art\/item\/misc-herb\.webp$/);
  });

  it("具名物品优先显示专图，同名不同品质未匹配时仍走类别图", () => {
    expect(decodeURIComponent(itemArtUrl("康巴厚背重刀"))).toBe("/art/item/康巴厚背重刀.webp");
    expect(decodeURIComponent(itemArtUrl({ name: "九眼天珠", quality: "紫" }))).toBe("/art/item/九眼天珠.webp");
    expect(itemArtUrl({ name: "九眼天珠", quality: "橙" })).toBe("/art/item/accessory-beads.webp");
  });

  it("任务插图与旁白立绘按 ID 和好感档查图", () => {
    expect(questArtUrl("gaze_1_mitu")).toMatch(/art\/quest\/gaze_1_mitu\.webp$/);
    expect(questArtUrl("no_such_quest")).toBeNull();
    expect(narratorArtUrl(0)).toMatch(/portraits\/narrator\/tier1\.webp$/);
    expect(narratorArtUrl(55)).toMatch(/portraits\/narrator\/tier3\.webp$/);
    expect(narratorArtUrl(95)).toMatch(/portraits\/narrator\/true\.webp$/);
  });
});
