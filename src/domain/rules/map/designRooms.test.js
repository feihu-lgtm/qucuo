import { describe, it, expect } from "vitest";
import { getInnerRoom, isInnerExitUnlocked, visibleInnerExits } from "./innerMap.js";
import { tryInnerMove } from "./innerMove.js";

const ADDED = [
  ["黑风寨", "狼曲暗道·旧契藏窟", "寨后岩洞"],
  ["锦官城", "玄清道院", "抄经堂"],
  ["锦官城", "府衙花厅·青鸢书房", "都事府"],
  ["锦官城", "书房暗格·青囊密档室", "府衙花厅·青鸢书房"],
  ["锦官城", "暗巷隔间·验货室", "唐门暗巷"],
  ["锦官城", "北衙地底·铁栅暗牢", "城东营房"],
];

const rep = (faction, v) => ({ 世界: { 势力声誉: { [faction]: v } } });
const active = (id) => ({ [id]: { status: "active" } });
const done = (id) => ({ [id]: { status: "completed" } });

describe("合稿补建的内层房间", () => {
  it.each(ADDED)("%s·%s 与 %s 双向相通", (d, room, from) => {
    expect(getInnerRoom(d, room)).toBeTruthy();
    expect(Object.values(getInnerRoom(d, from).exits)).toContain(room);
    expect(Object.values(getInnerRoom(d, room).exits)).toContain(from);
  });

  it("府衙花厅：锦官城声誉 ≥15 或接了官1", () => {
    const lock = getInnerRoom("锦官城", "府衙花厅·青鸢书房").unlockCondition;
    expect(isInnerExitUnlocked(lock, {})).toBe(false);
    expect(isInnerExitUnlocked(lock, { varTree: rep("锦官城", 14) })).toBe(false);
    expect(isInnerExitUnlocked(lock, { varTree: rep("锦官城", 15) })).toBe(true);
    expect(isInnerExitUnlocked(lock, { questProgress: active("jinguancheng_guan1_xinren") })).toBe(true);
  });

  it("青囊密档室：官1 完成 + 柳青鸢好感 ≥60 + 声誉 ≥40，缺一不可", () => {
    const lock = getInnerRoom("锦官城", "书房暗格·青囊密档室").unlockCondition;
    const varTree = { 世界: { 势力声誉: { 锦官城: 40 } }, 角色: { 柳青鸢: { 好感度: 60 } } };
    const questProgress = done("jinguancheng_guan1_xinren");
    expect(isInnerExitUnlocked(lock, { varTree, questProgress })).toBe(true);
    expect(isInnerExitUnlocked(lock, { varTree, questProgress: active("jinguancheng_guan1_xinren") })).toBe(false);
    expect(isInnerExitUnlocked(lock, { varTree: { ...varTree, 角色: { 柳青鸢: { 好感度: 59 } } }, questProgress })).toBe(false);
    expect(isInnerExitUnlocked(lock, { varTree: { ...varTree, 世界: { 势力声誉: { 锦官城: 39 } } }, questProgress })).toBe(false);
  });

  it("铁栅暗牢：声誉 ≥40 且接了官2", () => {
    const lock = getInnerRoom("锦官城", "北衙地底·铁栅暗牢").unlockCondition;
    expect(isInnerExitUnlocked(lock, { varTree: rep("锦官城", 40) })).toBe(false);
    expect(isInnerExitUnlocked(lock, { varTree: rep("锦官城", 40), questProgress: active("jinguancheng_guan2_guitu") })).toBe(true);
    expect(isInnerExitUnlocked(lock, { varTree: rep("锦官城", 39), questProgress: active("jinguancheng_guan2_guitu") })).toBe(false);
  });

  it("旧契藏窟：声誉 ≥40 且完成黑3，或接了黑5", () => {
    const lock = getInnerRoom("黑风寨", "狼曲暗道·旧契藏窟").unlockCondition;
    expect(isInnerExitUnlocked(lock, { varTree: rep("黑风寨", 40) })).toBe(false);
    expect(isInnerExitUnlocked(lock, { varTree: rep("黑风寨", 40), questProgress: done("heifengzhai_3_shangshan") })).toBe(true);
    expect(isInnerExitUnlocked(lock, { questProgress: active("heifengzhai_5_langyanjiuzhang") })).toBe(true);
  });

  it("验货室：唐门声誉 ≥15 或接了唐1", () => {
    const lock = getInnerRoom("锦官城", "暗巷隔间·验货室").unlockCondition;
    expect(isInnerExitUnlocked(lock, { varTree: rep("唐门", 15) })).toBe(true);
    expect(isInnerExitUnlocked(lock, { questProgress: active("tangmen_1_anxianglaike") })).toBe(true);
    expect(isInnerExitUnlocked(lock, { varTree: rep("唐门", 14) })).toBe(false);
  });

  it("锁着的房间不出现在出口里，解锁后出现", () => {
    expect(Object.values(visibleInnerExits("锦官城", "都事府", {}))).not.toContain("府衙花厅·青鸢书房");
    expect(Object.values(visibleInnerExits("锦官城", "都事府", { varTree: rep("锦官城", 15) }))).toContain("府衙花厅·青鸢书房");
    expect(Object.values(visibleInnerExits("锦官城", "抄经堂", {}))).toContain("玄清道院");
  });

  it("走到都事府时，到达描述的四周出口按声誉列出青鸢书房", () => {
    const move = (varTree) => tryInnerMove({
      movingDir: "e", room: { name: "锦官城", npcs: [] }, innerRoomName: "天下商行",
      flags: [], varTree, questProgress: {}, inv: [], char: {},
    });
    const text = (r) => r.arrivalLines.map((l) => l.text).join("\n");
    expect(text(move({}))).not.toContain("府衙花厅·青鸢书房");
    expect(text(move(rep("锦官城", 15)))).toContain("府衙花厅·青鸢书房");
  });
});
