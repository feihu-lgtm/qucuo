import { describe, expect, it } from "vitest";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { FACTION_ENTRIES, SECT_MEMBER_FLAGS, checkFactionEntry } from "../../domain/rules/character/factionEntry.js";
import { skillUnlockStatus } from "../../domain/rules/economy/skillUnlock.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import { joinSect } from "../sect/logic.js";
import { buyFactionShopItem, factionShopOffer } from "./factionShop.js";

const SHOP = "天龙军需坊";
const rep = (value, extra = {}) => ({ 世界: { 势力声誉: { 天龙教: value }, ...extra } });
const names = (value, flags) => factionShopOffer(SHOP, rep(value), "vault", flags).items.map((item) => item.name);
const at = (innerRoomName, value, flags = []) => ({
  char: { money: 3000, gender: "男", special: { 智谋: 5 } },
  room: { name: "天龙营" }, innerRoomName,
  inv: [], skills: [], flags, questProgress: {}, varTree: rep(value), time: 1,
});
const building = (room) => getBuildingsForLocation("天龙营").find((b) => b.id === getBuildingIdForInnerRoom("天龙营", room));

describe("天龙营 · 内院", () => {
  it("opens 点将台、军需坊、演武场、磨刀坪 behind the camp rooms", () => {
    expect(building("天龙点将台")).toMatchObject({ type: "sect_entry", sect: "天龙教" });
    expect(building("天龙军需坊")).toMatchObject({ type: "sectshop", shopKey: SHOP });
    expect(building("玄甲校场")).toMatchObject({ type: "wuguan", skillSet: "天龙" });
    expect(getBuildingIdForInnerRoom("大草甸", "血刀营地")).toBe("wuguan_xuedao");
  });

  it("stocks 天龙军需坊 by rep tier and refuses the hostile", () => {
    expect(names(-60)).toEqual([]);
    expect(factionShopOffer(SHOP, rep(-60), "vault").closed).toBeTruthy();
    // -59~-20 敌对：只摆绿品且加价两成
    expect(factionShopOffer(SHOP, rep(-30), "vault").coef).toBe(1.2);
    expect(names(-30)).toEqual(["西域止血散", "胡杨炭火酒", "西域弯刀", "驼绒防风氅"]);
    // 蓝品 15 起、紫品 40 起、橙甲 80 起
    expect(names(0)).toEqual(["西域止血散", "胡杨炭火酒", "西域弯刀", "驼绒防风氅"]);
    expect(names(15)).toEqual(expect.arrayContaining(["狼牙骨哨", "血槽铁刀"]));
    expect(names(40)).toEqual(expect.arrayContaining(["西域雪莲清毒丸", "玄甲护心镜"]));
    expect(names(80)).toContain("龙纹赤铜战甲");
    expect(names(80)).not.toContain("止戈玉令");
  });

  it("deep rep 100 → 0.7 折并摆出二选一秘货，买走一件另一件也撤柜", () => {
    const offer = factionShopOffer(SHOP, rep(100), "vault");
    expect(offer.coef).toBe(0.7);
    expect(offer.items.map((item) => item.name)).toEqual(expect.arrayContaining(["止戈玉令", "陨铁血刃"]));
    // 二选一：买走止戈玉令，陨铁血刃因同组 limitOnce 标记也撤柜
    const state = at("天龙军需坊", 100);
    const bought = buyFactionShopItem(state, SHOP, "止戈玉令", 1);
    const flags = bought.changes.flags([]);
    expect(flags).toContain("shop_bought:天龙军需坊:tianlong_secret");
    expect(factionShopOffer(SHOP, rep(100), "vault", flags).items.map((item) => item.name)).not.toContain("陨铁血刃");
  });
});

describe("拜入天龙教", () => {
  const entry = FACTION_ENTRIES.天龙教;
  const join = (state) => joinSect(state);

  it("needs rep 40、威望 ≥ 0、过点将台试炼、未拜他派", () => {
    const status = checkFactionEntry(entry, { varTree: rep(39), flags: ["tianlong_spar_first"], char: {} });
    expect(status.missing).toContain("rep");
    expect(checkFactionEntry(entry, { varTree: rep(40), flags: [], char: {} }).missing).toContain("trial");
    expect(checkFactionEntry(entry, { varTree: rep(40), flags: ["tianlong_spar_first", "峨眉派弟子"], char: {} }).missing).toContain("single");
  });

  it("joinSect 在点将台发天龙教弟子 flag + 弟子令 + 声誉 +20，结算指向厉苍龙", () => {
    const state = at("天龙点将台", 40, ["tianlong_spar_first"]);
    const result = join(state);
    expect(result.changes.flags([])).toContain("天龙教弟子");
    const tree = result.changes.varTree(state.varTree);
    expect(tree.世界.势力声誉.天龙教).toBe(60);
    expect(result.settleOptions?.settleNpc).toBe("厉苍龙");
  });

  it("rep 不够时 joinSect 只回提示不改状态", () => {
    const result = join(at("天龙点将台", 10, ["tianlong_spar_first"]));
    expect(result.changes).toBeUndefined();
  });
});

describe("天龙教武学声誉解锁", () => {
  const learnable = (value, flags = []) => Object.values(SKILL_CATALOG)
    .flat()
    .filter((skill) => skillUnlockStatus({ varTree: rep(value), flags }, skill).ok)
    .map((skill) => skill.name);

  it("梯度 0/15/40 开门面，80/100 只认门内弟子", () => {
    expect(learnable(0)).toEqual(expect.arrayContaining(["西风踏沙步", "啜血还气"]));
    expect(learnable(15)).toEqual(expect.arrayContaining(["沙暴震岳拳", "刀锈入喉"]));
    expect(learnable(40)).toContain("止戈印");
    expect(learnable(100)).not.toContain("龙渊霸世劲");
    expect(learnable(100)).not.toContain("八部天龙经");
    expect(learnable(100, [SECT_MEMBER_FLAGS.天龙教])).toEqual(expect.arrayContaining(["龙渊霸世劲", "血刀大法", "八部天龙经"]));
  });
});
