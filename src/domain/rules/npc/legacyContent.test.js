import { describe, it, expect } from "vitest";
import {
  LEGACY_NPC_RENAMES, LEGACY_NPC_ID_RENAMES, migrateLegacySnapshot,
} from "./legacyContent.js";
import { RESIDENT_NPCS } from "../../data/npc/residentNpcs.js";

// #274 天龙教改回原作名：石重岳→厉苍龙、安世衡→厉苍天（含 resident id）。
// 老存档读档时按这套表迁移，迁错或漏迁会直接表现在玩家档里，逐项断言。

describe("legacyContent 迁移表与现网人物对得上", () => {
  const tianlong = RESIDENT_NPCS["天龙营"] || [];
  it("每个新名都真实存在于天龙营人物表", () => {
    for (const newName of Object.values(LEGACY_NPC_RENAMES)) {
      expect(tianlong.map(n => n.name)).toContain(newName);
    }
  });
  it("每个新 id 都真实存在于天龙营人物表", () => {
    for (const newId of Object.values(LEGACY_NPC_ID_RENAMES)) {
      expect(tianlong.map(n => n.id)).toContain(newId);
    }
  });
  it("旧名/旧 id 已不在人物表里（防改名回滚后误迁）", () => {
    const names = tianlong.map(n => n.name);
    const ids = tianlong.map(n => n.id);
    for (const old of Object.keys(LEGACY_NPC_RENAMES)) expect(names).not.toContain(old);
    for (const old of Object.keys(LEGACY_NPC_ID_RENAMES)) expect(ids).not.toContain(old);
  });
});

describe("migrateLegacySnapshot", () => {
  const baseSnap = () => ({
    preset: { id: "village" },
    char: { name: "石重岳", hp: [10, 10], neigong: 0, waigong: 0, special: {} },
    room: { name: "天龙营点将台", desc: "高台", exits: [], items: [],
      npcs: [{ id: "resident_shizhongyue", name: "石重岳" }] },
    roomMap: {
      "西风隘": { npcs: [{ id: "resident_anshiheng", name: "安世衡" }, { id: "resident_litianxing", name: "厉天行" }] },
    },
    varTree: {
      角色: {
        石重岳: { 好感: 5, 已细看: true },
        安世衡: { 好感: 3 },
      },
      世界: { 曾经出现人物: ["石重岳", "厉天行", "安世衡"] },
    },
    log: [
      { t: "sys", text: "石重岳按刀坐在图后。" },
      { t: "npc", name: "安世衡", text: "安世衡抬眼看了你一下。" },
    ],
    convo: [{ role: "assistant", content: "石重岳点了点头。" }],
    inv: [{ name: "玄铁重刀", desc: "石重岳的佩刀。" }],
    flags: ["quest_done_tianlong-1"],
  });

  it("在场 NPC 与 roomMap 的 name/id 一起迁", () => {
    const s = migrateLegacySnapshot(baseSnap());
    expect(s.room.npcs[0]).toEqual({ id: "resident_licanglong", name: "厉苍龙" });
    expect(s.roomMap["西风隘"].npcs[0]).toEqual({ id: "resident_licangtian", name: "厉苍天" });
    expect(s.roomMap["西风隘"].npcs[1].id).toBe("resident_litianxing");
  });

  it("varTree.角色 键与 曾经出现人物 迁移", () => {
    const s = migrateLegacySnapshot(baseSnap());
    expect(s.varTree.角色["厉苍龙"]).toEqual({ 好感: 5, 已细看: true });
    expect(s.varTree.角色["厉苍天"]).toEqual({ 好感: 3 });
    expect(s.varTree.角色["石重岳"]).toBeUndefined();
    expect(s.varTree.世界.曾经出现人物).toEqual(["厉苍龙", "厉天行", "厉苍天"]);
  });

  it("日志/私聊/物品描述里的旧名文本一并迁", () => {
    const s = migrateLegacySnapshot(baseSnap());
    expect(s.log[0].text).toContain("厉苍龙");
    expect(s.log[1].name).toBe("厉苍天");
    expect(s.convo[0].content).toContain("厉苍龙");
    expect(s.inv[0].desc).toContain("厉苍龙");
  });

  it("新旧名并存时以新名为准、旧名补缺失字段", () => {
    const snap = baseSnap();
    snap.varTree.角色["厉苍龙"] = { 好感: 9 };
    const s = migrateLegacySnapshot(snap);
    expect(s.varTree.角色["厉苍龙"]).toEqual({ 好感: 9, 已细看: true });
  });

  it("玩家自己取的名字不动", () => {
    const s = migrateLegacySnapshot(baseSnap());
    expect(s.char.name).toBe("石重岳");
  });

  it("无旧名的存档原样返回", () => {
    const snap = { preset: { id: "village" }, varTree: { 角色: { 厉天行: { 好感: 1 } } }, flags: [] };
    const s = migrateLegacySnapshot(snap);
    expect(s.varTree.角色["厉天行"]).toEqual({ 好感: 1 });
  });

  it("空快照直接返回", () => {
    expect(migrateLegacySnapshot(null)).toBe(null);
    expect(migrateLegacySnapshot(undefined)).toBe(undefined);
  });
});
