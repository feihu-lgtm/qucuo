import { describe, expect, it } from "vitest";
import { buildPartyListBlock } from "./roundNotes.js";
import { unlockImportedCompanion, unlockFollowerCompanion, stationCompanion } from "../../domain/rules/companion/companion.js";
import { ADVENTURER_POOL_IP } from "../../domain/data/dungeon/adventurersIP.js";

const ADV = { name: "小鱼儿", levelCap: 3 };

describe("buildPartyListBlock 随行/留守清单注入", () => {
  it("无同伴时空块", () => {
    expect(buildPartyListBlock(undefined)).toBe("");
    expect(buildPartyListBlock({})).toBe("");
  });

  it("随行（含出战位）与留守分栏，留守标出据点房间", () => {
    let cs = unlockImportedCompanion({}, ADV); // 自动出战随行
    cs = unlockImportedCompanion(cs, { name: "花无缺", levelCap: 4 }); // 顶出战位
    cs = stationCompanion(cs, "imported_小鱼儿", { district: "雅江", roomId: "room_jianping", roomName: "剑坪" });

    const block = buildPartyListBlock(cs);
    expect(block).toContain("【同伴去向】");
    expect(block).toContain("花无缺（出战随行）");
    expect(block).toContain("小鱼儿（留守于雅江·剑坪）");
    expect(block).not.toContain("小鱼儿（随行）");
  });

  it("唤回后归队，留守行消失", () => {
    let cs = unlockImportedCompanion({}, ADV);
    cs = unlockImportedCompanion(cs, { name: "花无缺", levelCap: 4 }); // 顶出战位，小鱼儿才可留守
    cs = stationCompanion(cs, "imported_小鱼儿", { district: "雅江", roomId: "r1", roomName: "剑坪" });
    expect(buildPartyListBlock(cs)).toContain("留守队友");
    cs = { ...cs };
    delete cs["imported_小鱼儿"].stationed;
    const block = buildPartyListBlock(cs);
    expect(block).toContain("随行队友");
    expect(block).not.toContain("留守队友");
  });

  it("不会说话的随从标出开口方式，主叙事不让他们说人话", () => {
    const duoduo = ADVENTURER_POOL_IP.find((a) => a.name === "元朵朵");
    const cs = unlockFollowerCompanion(unlockImportedCompanion({}, { name: "元朵朵", levelCap: 1 }), duoduo);
    const block = buildPartyListBlock(cs);
    expect(block).toContain("元朵朵（出战随行）");
    expect(block).toContain("铁伯（随行·不能言，只有机括声与动作）");
  });
});
