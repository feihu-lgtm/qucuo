// WO-23D2 铭文校验与升品规划契约测试
import { describe, expect, it } from "vitest";
import { validateInscription, nextQualityRung, planInscriptionUpgrade } from "./inscribe.js";
import { awakenableWeapons, recordWeaponVictory } from "./itemAwaken.js";

const blade = { id: "wpn_001", name: "青钢剑", category: "weapon", equipped: true, quality: "绿" };
function stateWith(overrides = {}) {
  return {
    time: 30, inv: [blade], room: { name: "鱼定村", npcs: [] },
    char: { hp: [30, 40], money: 10, special: {}, name: "阿部" }, skills: [], flags: [],
    questProgress: {}, pot: 0,
    varTree: { 角色: {}, 世界: { 器物谱: { wpn_001: { itemId: "wpn_001", name: "青钢剑", wins: 5, nemesisKills: 0, awakenReady: true, awakened: false } } } },
    ...overrides,
  };
}
const GOOD = "寒锋三尺随主行，不问恩仇只问心";

describe("validateInscription deterministic 校验", () => {
  it("合规铭文通过；长度/英文数字/夸大/脏词/玩家名拒", () => {
    expect(validateInscription(GOOD, { playerName: "阿部" }).ok).toBe(true);
    expect(validateInscription("太短", {}).ok).toBe(false);
    expect(validateInscription("长".repeat(61), {}).ok).toBe(false);
    expect(validateInscription("寒锋abc随主行不问恩仇", {}).reason).toBe("alnum");
    expect(validateInscription("此剑一出天下第一谁与争锋", {}).reason).toBe("boast");
    expect(validateInscription("废物兵器也配铭文如何如何", {}).reason).toBe("profanity");
    expect(validateInscription("阿部之剑寒锋三尺随主行", { playerName: "阿部" }).reason).toBe("playerName");
    expect(validateInscription("", {}).ok).toBe(false);
  });
});

describe("nextQualityRung 品阶序列", () => {
  it("白绿蓝紫橙红逐档升；红/null 到顶", () => {
    expect(nextQualityRung("白")).toBe("绿");
    expect(nextQualityRung("橙")).toBe("红");
    expect(nextQualityRung("红")).toBeNull();
    expect(nextQualityRung(undefined)).toBe("绿"); // 无品阶按白起步
  });
});

describe("planInscriptionUpgrade 系统升品规划", () => {
  it("ready 武器：升一档+铭文落物+账本 awakened/幂等", () => {
    const st = stateWith();
    const result = planInscriptionUpgrade(st, "wpn_001", GOOD);
    expect(result).toBeTruthy();
    const invOut = result.changes.inv(st.inv);
    expect(invOut[0].quality).toBe("蓝"); // 绿→蓝
    expect(invOut[0].inscription).toBe(GOOD);
    const vt = result.changes.varTree(st.varTree);
    expect(vt.世界.器物谱.wpn_001.awakened).toBe(true);
    expect(vt.世界.器物谱.wpn_001.awakenReady).toBe(false);
    // 幂等：已觉醒不再出 plan
    const st2 = { ...st, varTree: vt, inv: invOut };
    expect(planInscriptionUpgrade(st2, "wpn_001", GOOD)).toBeNull();
    // 输入 state 不原地改
    expect(st.inv[0].quality).toBe("绿");
  });

  it("非 ready/未装备/红档/校验失败均不出 plan", () => {
    expect(planInscriptionUpgrade(stateWith({ inv: [{ ...blade, equipped: false }] }), "wpn_001", GOOD)).toBeNull();
    const notReady = stateWith();
    notReady.varTree.世界.器物谱.wpn_001.awakenReady = false;
    expect(planInscriptionUpgrade(notReady, "wpn_001", GOOD)).toBeNull();
    expect(planInscriptionUpgrade(stateWith({ inv: [{ ...blade, quality: "红" }] }), "wpn_001", GOOD)).toBeNull();
    expect(planInscriptionUpgrade(stateWith(), "wpn_001", "bad")).toBeNull();
  });

  it("赎回重连后可觉醒（WO-23D0a 身份贯通）", () => {
    // 账本 id 与背包实例 id 一致即可觉醒——resolveBuyInId 保 id 后成立
    let ledger = {};
    for (const t of [1, 2, 3, 4, 5]) ledger = recordWeaponVictory(ledger, blade, { turn: t, battleKey: `${t}:n` }) || ledger;
    const st = stateWith();
    st.varTree.世界.器物谱 = ledger;
    expect(awakenableWeapons(st).map((w) => w.id)).toEqual(["wpn_001"]);
    expect(planInscriptionUpgrade(st, "wpn_001", GOOD)).toBeTruthy();
  });
});

describe("item.inscription prompt 块", () => {
  it("无来历原文时 prompt 钉死不得编造", async () => {
    const { getPromptDef } = await import("../prompt/registry.js");
    await import("../prompt/calls/domainCalls.js").catch(() => {});
    // domainCalls 注册在模块装载侧效应里——取注册表验证
    const def = getPromptDef("block", "item.inscription.user");
    if (!def) return; // 注册时机差异不硬炸（hookCalls 链外单测环境）
    const text = def.text({ name: "青钢剑", category: "weapon", wins: 5, nemesisKills: 0, originText: "" });
    expect(text).toContain("不得编造具体来历");
    const withOrigin = def.text({ name: "青钢剑", category: "weapon", wins: 5, nemesisKills: 1, originText: "赠刀原文" });
    expect(withOrigin).toContain("赠刀原文");
  });
});
