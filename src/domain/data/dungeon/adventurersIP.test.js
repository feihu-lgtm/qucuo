import { describe, it, expect } from "vitest";
import { ADVENTURER_POOL_IP, ADVENTURER_IP_BY_NAME } from "./adventurersIP.js";
import { CATALOG_INDEX } from "../items/catalog.js";

const REQUIRED_SCALAR = [
  "id", "name", "title", "archetype", "archetypeLabel", "rainbowStyle",
  "gender", "faction", "brief", "personality", "fullBio",
  "lifeHistory", "likes", "hobby", "tradeStyle",
];

describe("adventurersIP —— IP 改编第三批 54 人 + OC 元朵朵", () => {
  it("共 54 人，id 形如 adv_* 且全局唯一，姓名唯一", () => {
    expect(ADVENTURER_POOL_IP).toHaveLength(55);
    const ids = ADVENTURER_POOL_IP.map((a) => a.id);
    expect(new Set(ids).size).toBe(55);
    for (const id of ids) expect(id).toMatch(/^adv_[a-z_]+$/);
    const names = ADVENTURER_POOL_IP.map((a) => a.name);
    expect(new Set(names).size).toBe(55);
    expect(Object.keys(ADVENTURER_IP_BY_NAME)).toHaveLength(55);
  });

  it.each(ADVENTURER_POOL_IP.map((a) => [a.name, a]))("%s 标量字段齐备", (_n, adv) => {
    for (const k of REQUIRED_SCALAR) {
      expect(adv[k], `${adv.name}.${k}`).toBeTruthy();
    }
    expect(adv.rainbow).toBe(true);
    expect(["白", "绿", "蓝", "紫", "橙", "红"]).not.toContain(adv.gender);
    expect(["男", "女"]).toContain(adv.gender);
    expect(adv.stealBias).toBeGreaterThanOrEqual(0);
    expect(adv.stealBias).toBeLessThanOrEqual(1);
    expect(adv.levelCap).toBeGreaterThanOrEqual(1);
    expect(adv.levelCap).toBeLessThanOrEqual(5);
  });

  it.each(ADVENTURER_POOL_IP.map((a) => [a.name, a]))("%s 随从/武学/商店/可偷结构齐备", (_n, adv) => {
    expect(adv.follower.type).toBeTruthy();
    expect(adv.follower.name).toBeTruthy();
    expect(adv.follower.desc).toBeTruthy();
    expect(adv.kungfu.school).toBeTruthy();
    expect(adv.kungfu.moves.length).toBeGreaterThan(0);
    for (const m of adv.kungfu.moves) {
      expect(m.name).toBeTruthy();
      expect(m.desc).toBeTruthy();
    }
    expect(adv.shop.name).toBeTruthy();
    expect(adv.shop.goods.length).toBeGreaterThan(0);
    expect(adv.stealables.equipment.length).toBeGreaterThan(0);
    for (const it of adv.stealables.equipment) {
      expect(["白", "绿", "蓝", "紫", "橙", "红"]).toContain(it.quality);
      expect(it.name).toBeTruthy();
      expect(it.desc).toBeTruthy();
    }
    for (const it of adv.stealables.sundries) {
      expect(it.name).toBeTruthy();
      expect(it.desc).toBeTruthy();
    }
  });

  it.each(ADVENTURER_POOL_IP.map((a) => [a.name, a]))("%s 的 carry 全部取自 CATALOG_INDEX", (_n, adv) => {
    expect(adv.carry.length).toBeGreaterThan(0);
    for (const c of adv.carry) {
      const entry = CATALOG_INDEX[c.name];
      expect(entry, `${adv.name} carry ${c.name}`).toBeTruthy();
      expect(c.category).toBe(entry.category);
      expect(c.quality).toBe(entry.quality);
    }
  });

  it("fullBio 与 lifeHistory 一致（文档生平原文落地）", () => {
    for (const adv of ADVENTURER_POOL_IP) {
      expect(adv.fullBio).toBe(adv.lifeHistory);
    }
  });

  it("女性角色带私房段，男性按文档留空", () => {
    for (const adv of ADVENTURER_POOL_IP) {
      if (adv.gender === "女") expect(adv.nsfw, adv.name).toBeTruthy();
      else expect(adv.nsfw, adv.name).toBeNull();
    }
  });
});
