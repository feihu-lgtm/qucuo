import { describe, it, expect } from "vitest";
import {
  declaredContainers, isContainerCollapsed, containerViewForRoom, intakeContainerLines,
} from "./containers.js";
import { judgeTurn } from "../judge/judgeTurn.js";
import { materializeFacts } from "../effects/materializeFacts.js";
import { applyPatches } from "../state/applyPatches.js";
import { buildIntakeUserContent } from "../../../engine/turn/intakeTurn.js";

const roomDef = {
  containers: [
    { name: "铁柜", presetItems: [{ name: "冰镇酸梅汤" }] },
    { name: "书桌", presetItems: [] },
    { name: "" }, // 非法条目应被丢弃
  ],
};

describe("WO-22A 容器坍缩——纯函数", () => {
  it("declaredContainers 规整化并丢弃非法条目", () => {
    const list = declaredContainers(roomDef);
    expect(list.map((c) => c.name)).toEqual(["铁柜", "书桌"]);
    expect(list[0].presetItems[0].name).toBe("冰镇酸梅汤");
  });

  it("旧档无容器字段：isContainerCollapsed 不炸返 false", () => {
    expect(isContainerCollapsed(undefined, "天都镇/一楼客厅", "铁柜")).toBe(false);
    expect(isContainerCollapsed({}, "天都镇/一楼客厅", "铁柜")).toBe(false);
    expect(isContainerCollapsed({ 世界: {} }, "x", "y")).toBe(false);
  });

  it("containerViewForRoom 合并声明与坍缩状态", () => {
    const vt = { 世界: { 容器: { "天都镇/一楼客厅": { 铁柜: { collapsed: true } } } } };
    const view = containerViewForRoom(vt, "天都镇/一楼客厅", roomDef);
    expect(view.铁柜.collapsed).toBe(true);
    expect(view.书桌.collapsed).toBe(false);
    expect(view.铁柜.presetItems[0].name).toBe("冰镇酸梅汤");
  });

  it("intakeContainerLines 只列未坍缩容器", () => {
    const vt = { 世界: { 容器: { "p": { 铁柜: { collapsed: true } } } } };
    expect(intakeContainerLines(vt, "p", roomDef)).toEqual(["书桌"]);
    expect(intakeContainerLines({}, "p", null)).toEqual([]);
  });
});

describe("WO-22A 判官坍缩接线", () => {
  const envelope = {
    turn: 3, day: 1, place: "天都镇", containerPlace: "天都镇/一楼客厅",
    npcs: [], varTree: {}, inv: [], entries: [],
    containers: {
      铁柜: { collapsed: false, presetItems: [{ name: "冰镇酸梅汤" }] },
      书桌: { collapsed: true, presetItems: [] },
    },
    budget: { riskLevel: 0, luck: 0 },
  };

  it("首翻未定容器：出预设物事实 + COLLAPSE_CONTAINER 坍缩事实", () => {
    const v = judgeTurn(envelope, { actions: [{ kind: "inspect_container", target: "铁柜" }], proposals: [] }, { rng: () => 0.99 });
    const grant = v.facts.find((f) => f.op === "GRANT_ITEM");
    expect(grant?.itemName).toBe("冰镇酸梅汤");
    const collapse = v.facts.find((f) => f.op === "COLLAPSE_CONTAINER");
    expect(collapse?.containerName).toBe("铁柜");
    expect(collapse?.place).toBe("天都镇/一楼客厅");
  });

  it("已坍缩容器：只有翻不出新东西，零事实", () => {
    const v = judgeTurn(envelope, { actions: [{ kind: "inspect_container", target: "书桌" }], proposals: [] }, { rng: () => 0.99 });
    expect(v.facts.filter((f) => f.op === "COLLAPSE_CONTAINER")).toHaveLength(0);
    expect(v.facts.filter((f) => f.op === "GRANT_ITEM")).toHaveLength(0);
    expect(v.notes.some((n) => n.includes("翻不出新东西"))).toBe(true);
  });

  it("未声明容器：不进三关、不留坍缩记录", () => {
    const v = judgeTurn(envelope, { actions: [{ kind: "inspect_container", target: "空气柜" }], proposals: [] }, { rng: () => 0.99 });
    expect(v.facts.filter((f) => f.op === "COLLAPSE_CONTAINER")).toHaveLength(0);
    expect(v.facts.filter((f) => f.op === "GRANT_ITEM")).toHaveLength(0);
  });

  it("翻无所获降级残页也照样坍缩（翻完即定）", () => {
    const env2 = { ...envelope, containers: { 书桌2: { collapsed: false, presetItems: [] } }, prepItems: [] };
    const v = judgeTurn(env2, { actions: [{ kind: "inspect_container", target: "书桌2" }], proposals: [] }, { rng: () => 0.999 });
    expect(v.facts.some((f) => f.op === "COLLAPSE_CONTAINER" && f.containerName === "书桌2")).toBe(true);
  });
});

describe("WO-22A materializeFacts 坍缩落账", () => {
  it("COLLAPSE_CONTAINER → merge patch 进 varTree.世界.容器，旧档懒初始化", () => {
    const state = { inv: [], room: {}, char: {}, skills: [], flags: [], time: 3, varTree: {} };
    const out = materializeFacts(state, [{ id: "F1", op: "COLLAPSE_CONTAINER", place: "天都镇/一楼客厅", containerName: "铁柜" }]);
    expect(out.patches?.length).toBeGreaterThan(0);
    const patched = applyPatches({ varTree: state.varTree }, out.patches);
    expect(patched.state.varTree.世界.容器["天都镇/一楼客厅"].铁柜.collapsed).toBe(true);
    expect(patched.rejected).toHaveLength(0);
  });

  it("重复坍缩幂等覆盖同值", () => {
    const varTree = { 世界: { 容器: { p: { 铁柜: { collapsed: true, turn: 1 } } } } };
    const out = materializeFacts({ inv: [], room: {}, char: {}, skills: [], flags: [], time: 5, varTree },
      [{ id: "F2", op: "COLLAPSE_CONTAINER", place: "p", containerName: "铁柜" }]);
    const patched = applyPatches({ varTree }, out.patches);
    expect(patched.state.varTree.世界.容器.p.铁柜.collapsed).toBe(true);
  });
});

describe("WO-22A 前哨清单渲染", () => {
  it("containers 渲染进 intake 材料", () => {
    const content = buildIntakeUserContent({ playerInput: "翻翻铁柜", containers: ["铁柜", "书桌"] });
    expect(content).toContain("可翻找容器：铁柜、书桌");
  });
  it("空清单不渲染该段", () => {
    const content = buildIntakeUserContent({ playerInput: "看看", containers: [] });
    expect(content).not.toContain("可翻找容器");
  });
});
