import { existsSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BUILDING_ART,
  BUILDING_ID_ART,
  HOME_ART,
  ITEM_ART,
  ITEM_NAME_ART,
  MAP_ART,
  NPC_ART,
  PLACE_ART,
  QUEST_ART,
  ROOM_ART,
} from "./artManifest.js";
import { QUCUO_MAP } from "../map/qucuoMap.js";
import { BUILDING_TYPE, getBuildingsForLocation } from "../buildings/qucuoBuildings.js";
import { HOMESTEAD_FEATURES } from "../../rules/map/homestead.js";
import { getInnerRoom } from "../../rules/map/innerMap.js";
import { passerRolesOf } from "../npc/randomPassers.js";
import { FACTIONS } from "../map/factions.js";
import { QUCUO_PRESET } from "../presets/qucuo.js";
import snowlandItems from "../../../content/item/snowland-sects-1.js";

const webpFile = (kind, name) => `public/art/${kind}/${name}.webp`;

describe("美术素材登记表", () => {
  it("登记的据点都是真实存在的外层据点，文件都在 public/art/place", () => {
    for (const [name, f] of Object.entries(PLACE_ART)) {
      expect(QUCUO_MAP[name], name).toBeTruthy();
      expect(existsSync(webpFile("place", f)), webpFile("place", f)).toBe(true);
    }
  });

  it("25 个外层据点的头图都已入库", () => {
    expect(Object.keys(PLACE_ART).sort()).toEqual(Object.keys(QUCUO_MAP).sort());
  });

  it("建筑类型图、个别建筑专图、家园设施图的键都对得上游戏数据，文件都在", () => {
    const types = new Set(Object.values(BUILDING_TYPE));
    const ids = new Set(Object.keys(QUCUO_MAP).flatMap((d) => getBuildingsForLocation(d).map((b) => b.id)));
    const homeIds = new Set(Object.values(HOMESTEAD_FEATURES).flatMap((h) => h.features.map((f) => f.id)));
    for (const [k, f] of Object.entries(BUILDING_ART)) { expect(types.has(k), k).toBe(true); expect(existsSync(webpFile("building", f)), f).toBe(true); }
    for (const [k, f] of Object.entries(BUILDING_ID_ART)) { expect(ids.has(k), k).toBe(true); expect(existsSync(webpFile("building", f)), f).toBe(true); }
    for (const [k, f] of Object.entries(HOME_ART)) { expect(homeIds.has(k), k).toBe(true); expect(existsSync(webpFile("building", f)), f).toBe(true); }
    if (MAP_ART) expect(existsSync(webpFile("map", MAP_ART))).toBe(true);
  });

  it("内层房间图对应真实房间，目录内每张图都有映射", () => {
    const files = new Set();
    for (const [district, rooms] of Object.entries(ROOM_ART)) {
      for (const [room, file] of Object.entries(rooms)) {
        expect(getInnerRoom(district, room), `${district}·${room}`).toBeTruthy();
        files.add(`${file}.webp`);
      }
    }
    expect(readdirSync("public/art/room").sort()).toEqual([...files].sort());
  });

  it("NPC 头像、物品图标、任务插图登记表均非空且对应 .webp 文件全部存在", () => {
    expect(NPC_ART.length).toBeGreaterThanOrEqual(260);
    expect(ITEM_ART.length).toBe(36);
    expect(QUEST_ART.length).toBeGreaterThanOrEqual(81);
    for (const name of NPC_ART) expect(existsSync(webpFile("npc", name)), name).toBe(true);
    for (const key of ITEM_ART) expect(existsSync(webpFile("item", key)), key).toBe(true);
    for (const id of QUEST_ART) expect(existsSync(webpFile("quest", id)), id).toBe(true);
  });

  it("雪域具名物品都有专图，物品目录只含已登记的专图和类别图", () => {
    for (const { name, quality } of Object.values(snowlandItems.item)) {
      const file = ITEM_NAME_ART[`${name}:${quality}`] ?? ITEM_NAME_ART[name];
      expect(file, name).toBeTruthy();
    }
    const files = new Set([...ITEM_ART, ...Object.values(ITEM_NAME_ART)].map((name) => `${name}.webp`));
    expect(readdirSync("public/art/item").sort()).toEqual([...files].sort());
  });

  it("开局预设里的每位 NPC 都能按游戏显示名找到立绘", () => {
    for (const { name } of QUCUO_PRESET.room.npcs) {
      expect(NPC_ART.includes(name) && existsSync(webpFile("npc", name)), name).toBe(true);
    }
  });

  it("覆盖率硬门禁：public/art/npc 与 quest 目录里每张图都必须登记——有图未登记即缺口", () => {
    const npcFiles = readdirSync("public/art/npc").filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5));
    const questFiles = readdirSync("public/art/quest").filter((f) => f.endsWith(".webp")).map((f) => f.slice(0, -5));
    for (const f of npcFiles) expect(NPC_ART.includes(f), `npc/${f} 有图未登记`).toBe(true);
    for (const f of questFiles) expect(QUEST_ART.includes(f), `quest/${f} 有图未登记`).toBe(true);
  });

  it("每日过路人的身份模板与 WebP 立绘一一对应，随机性别各有一张", () => {
    const roles = new Set(["鱼定村", "散人", ...FACTIONS.map(({ name }) => name)].flatMap(passerRolesOf));
    const keys = [...new Set([...roles].flatMap(({ art, gender }) => gender
      ? [`passer-${art}`] : [`passer-${art}-male`, `passer-${art}-female`]))];
    expect(readdirSync("public/art/passer").sort()).toEqual(keys.map((key) => `${key}.webp`).sort());
  });
});

describe("素材目录体积", () => {
  it("public/art 下只放 webp，单张不超过 400KB（舆图底卷除外），避免原尺寸 png 拖慢加载", () => {
    for (const kind of readdirSync("public/art")) {
      for (const name of readdirSync(`public/art/${kind}`)) {
        expect(name.endsWith(".webp"), `${kind}/${name}`).toBe(true);
        if (kind !== "map") expect(statSync(`public/art/${kind}/${name}`).size, `${kind}/${name}`).toBeLessThan(400 * 1024);
      }
    }
  });
});
