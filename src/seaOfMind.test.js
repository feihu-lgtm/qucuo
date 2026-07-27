import { describe, it, expect } from "vitest";
import {
  SEA_OF_MIND, shouldTriggerXuannu, buildXuannuScene,
  canEnterSea, describeSeaGate,
} from "./seaOfMind.js";
import { initialVarTree, narratorVars, setNarratorVars } from "./mvu.js";
import { getInnerRoom, getInnerRoomNames, getResidentRoomForNpc, visibleInnerExits } from "./innerMap.js";
import { QUCUO_MAP, isNodeUnlocked } from "./qucuoMap.js";
import { getResidentNpcs } from "./residentNpcs.js";
import { NPC_SIGNATURE_MOVES } from "./npcSignatureMoves.js";
import { SAFE_HOUSES } from "./safeHouse.js";

const known = (...names) => ({ 世界: { 已认识人物: names } });

describe("玄女这个人存在且站对了地方", () => {
  it("注册为雪山派驻场，绑在后山温泉", () => {
    const n = getResidentNpcs("雪山派").find(x => x.name === "玄女");
    expect(n, "玄女未注册").toBeTruthy();
    expect(getResidentRoomForNpc("雪山派", "玄女")).toBe(SEA_OF_MIND.guideRoom);
  });
  it("后山温泉这间房存在，且从内堂进得去", () => {
    expect(getInnerRoom("雪山派", "后山温泉")).toBeTruthy();
    expect(Object.values(getInnerRoom("雪山派", "内堂").exits)).toContain("后山温泉");
  });
  it("温泉不上锁——玄女这一幕不该被弟子身份挡住", () => {
    expect(getInnerRoom("雪山派", "后山温泉").unlockCondition).toBeUndefined();
  });
  it("levelCap 4 的人配了专属四招", () => {
    expect(Object.keys(NPC_SIGNATURE_MOVES["玄女"])).toEqual(["攻击", "防御", "状态", "回气"]);
  });
});

describe("玄女触发门槛：好感≥90 且已跟她说过话", () => {
  const t = initialVarTree();
  it("两条都满足才触发", () => {
    expect(shouldTriggerXuannu({ affection: 90, varTree: t, knownNames: ["玄女"] })).toBe(true);
  });
  it("好感不到不触发", () => {
    expect(shouldTriggerXuannu({ affection: 89, varTree: t, knownNames: ["玄女"] })).toBe(false);
  });
  it("没跟她说过话不触发（哪怕好感满）", () => {
    expect(shouldTriggerXuannu({ affection: 100, varTree: t, knownNames: [] })).toBe(false);
    expect(shouldTriggerXuannu({ affection: 100, varTree: t, knownNames: ["何雨谢", "呼延雪"] })).toBe(false);
  });
  it("触发过就不再触发（metXuannu 闸门，防引导重播）", () => {
    const after = setNarratorVars(t, { metXuannu: true });
    expect(shouldTriggerXuannu({ affection: 100, varTree: after, knownNames: ["玄女"] })).toBe(false);
  });
  it("老存档没有 世界.旁白 这一支也不炸", () => {
    expect(() => shouldTriggerXuannu({ affection: 90, varTree: { 世界: { 威望: 3 } }, knownNames: ["玄女"] })).not.toThrow();
    expect(shouldTriggerXuannu({ affection: 90, varTree: {}, knownNames: ["玄女"] })).toBe(true);
  });
});

describe("玄女那一幕的内容", () => {
  const scene = buildXuannuScene("少侠");
  it("三句话都在，且旁白当场失态", () => {
    const all = scene.map(l => l.text).join("\n");
    expect(all).toContain("她不是这里的人");
    expect(all).toContain("她在等");
    expect(all).toContain("去她心里看看");
    expect(all).toContain("你别听她胡说");
  });
  it("末尾明确告诉玩家下一步去哪（不留悬空）", () => {
    expect(scene[scene.length - 1].text).toContain("安全屋");
  });
  it("旁白台词用 narrator 类型上色", () => {
    expect(scene.some(l => l.t === "narrator")).toBe(true);
  });
});

describe("进海门禁：必须站在自己的安全屋里", () => {
  const unlocked = setNarratorVars(initialVarTree(), { seaUnlocked: true });

  it("未解锁时一律进不去，且不剧透还差什么", () => {
    const r = canEnterSea({ flags: [], varTree: initialVarTree(), districtName: "鱼定村", innerRoomName: "溪边小屋" });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("locked");
    expect(describeSeaGate("locked")).not.toContain("玄女");
  });

  it.each(SAFE_HOUSES)("已解锁 + 站在 $label 里 → 进得去", ({ district, room }) => {
    const r = canEnterSea({ flags: [], varTree: unlocked, districtName: district, innerRoomName: room });
    expect(r.ok).toBe(true);
    expect(r.house.room).toBe(room);
  });

  it("已解锁但站在公共场所 → 进不去，且告诉你回哪", () => {
    const r = canEnterSea({ flags: [], varTree: unlocked, districtName: "鱼定村", innerRoomName: "村口" });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("notInSafeHouse");
    expect(describeSeaGate("notInSafeHouse")).toContain("溪边小屋");
  });

  it("flag 与 MVU 变量任一为真都算解锁（两套记账互为兜底）", () => {
    const byFlag = canEnterSea({ flags: [SEA_OF_MIND.flag], varTree: initialVarTree(), districtName: "锦官城", innerRoomName: "蜀王庄" });
    expect(byFlag.ok).toBe(true);
  });
});

describe("心灵之海这个据点", () => {
  it("外层节点存在，且按 flag 上锁", () => {
    const node = QUCUO_MAP[SEA_OF_MIND.district];
    expect(node).toBeTruthy();
    expect(isNodeUnlocked(SEA_OF_MIND.district, { flags: [] })).toBe(false);
    expect(isNodeUnlocked(SEA_OF_MIND.district, { flags: [SEA_OF_MIND.flag] })).toBe(true);
  });

  it("不与任何据点接壤——不能靠寻路走过去", () => {
    expect(Object.keys(QUCUO_MAP[SEA_OF_MIND.district].exits)).toHaveLength(0);
    for (const [name, node] of Object.entries(QUCUO_MAP)) {
      expect(Object.values(node.exits || {}), `${name} 竟然通向心灵之海`).not.toContain(SEA_OF_MIND.district);
    }
  });

  it("五间房齐全，锚点是浅滩", () => {
    expect(getInnerRoomNames(SEA_OF_MIND.district).sort())
      .toEqual(["地下室", "沙滩尽头", "浅滩", "椰林", "白色别墅"].sort());
  });

  it("地下室锁着，等传送门那一步才开", () => {
    expect(Object.values(visibleInnerExits(SEA_OF_MIND.district, "白色别墅", { flags: [] }))).not.toContain("地下室");
    expect(Object.values(visibleInnerExits(SEA_OF_MIND.district, "白色别墅", { flags: ["传送门已开"] }))).toContain("地下室");
  });

  it("每间房都走得回锚点（不会把玩家困死）", () => {
    for (const rn of getInnerRoomNames(SEA_OF_MIND.district)) {
      expect(Object.keys(getInnerRoom(SEA_OF_MIND.district, rn).exits).length,
        `${rn} 没有任何出口`).toBeGreaterThan(0);
    }
  });
});

describe("MVU 世界.旁白 读写", () => {
  it("新档带全四个字段", () => {
    expect(Object.keys(narratorVars(initialVarTree())).sort())
      .toEqual(["metXuannu", "questStage", "seaUnlocked", "seaVisited"]);
  });
  it("setNarratorVars 不就地改原对象", () => {
    const t = initialVarTree();
    const snap = JSON.stringify(t);
    setNarratorVars(t, { seaUnlocked: true });
    expect(JSON.stringify(t)).toBe(snap);
  });
  it("写入保留其他世界变量", () => {
    const t = setNarratorVars({ 世界: { 威望: 42 } }, { seaUnlocked: true });
    expect(t.世界.威望).toBe(42);
    expect(t.世界.旁白.seaUnlocked).toBe(true);
  });
});
