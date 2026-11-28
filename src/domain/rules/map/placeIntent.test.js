// #670 文字指令认地名/建筑名：进门、走到门前、隔得远、出村、去不了，以及不误判。
import { describe, expect, it } from "vitest";
import { resolveBuildingIntent, resolveOuterPlaceIntent, visibleBuildingsAt } from "./placeIntent.js";
import { fillMoveSlots } from "../intent/moveSlots.js";
import { validatePlan } from "../intent/systemGate.js";
import { ACTION_KINDS, NONE } from "../intent/actionKinds.js";

const atDuanan = { room: { name: "大草甸", npcs: [] }, innerRoomName: "断鞍古驿", flags: [], inv: [] };
const atEdge = { room: { name: "大草甸", npcs: [] }, innerRoomName: "草甸边缘", flags: [], inv: [] };
const atDeep = { room: { name: "大草甸", npcs: [] }, innerRoomName: "草甸深处", flags: [], inv: [] };
const atVillage = { room: { name: "鱼定村", npcs: [] }, innerRoomName: "村口", flags: [], inv: [] };

describe("建筑名解析", () => {
  it("门前说「进入断鞍古驿」→ 直接进门", () => {
    const r = resolveBuildingIntent(atDuanan, "进入断鞍古驿");
    expect(r.type).toBe("enter");
    expect(r.building.id).toBe("dacaodian_duanan_post");
  });

  it("隔一间房 → 先往东走一步到门前；说「进」才开门，说「去」只走到", () => {
    expect(resolveBuildingIntent(atEdge, "进断鞍古驿")).toMatchObject({ type: "approach", dir: "e", innerRoom: "断鞍古驿", wantsEnter: true });
    expect(resolveBuildingIntent(atEdge, "去断鞍古驿")).toMatchObject({ type: "approach", dir: "e", wantsEnter: false });
  });

  it("隔得远 → 回报所在位置", () => {
    expect(resolveBuildingIntent(atDeep, "去断鞍古驿看看")).toMatchObject({ type: "far", innerRoom: "断鞍古驿" });
  });

  it("只是顺口提到、或建筑是出发点时不当成进门", () => {
    expect(resolveBuildingIntent(atDuanan, "断鞍古驿这一带风真大，我坐下歇歇")).toBeNull();
    expect(resolveBuildingIntent(atVillage, "从铁匠铺出来去村口")).toBeNull();
    expect(resolveBuildingIntent(atVillage, "离开老孙饭馆")).toBeNull();
  });

  it("可见建筑口径与左栏一致：有内层图的据点只显示当前房的那一座", () => {
    expect(visibleBuildingsAt("大草甸", "断鞍古驿").map((b) => b.id)).toEqual(["dacaodian_duanan_post"]);
    expect(visibleBuildingsAt("大草甸", "草甸深处")).toEqual([]);
  });
});

describe("外层地名解析", () => {
  it("鱼定村说「去大草甸」→ 向南出村", () => {
    expect(resolveOuterPlaceIntent(atVillage, "去大草甸")).toMatchObject({ type: "outer", dir: "s", dest: "大草甸" });
  });

  it("不相邻的据点 → unreachable", () => {
    expect(resolveOuterPlaceIntent(atVillage, "去锦官城")).toMatchObject({ type: "unreachable", dest: "锦官城", from: "鱼定村" });
  });

  it("带建物后缀的整词不算点名据点", () => {
    expect(resolveOuterPlaceIntent(atVillage, "去大草甸营地")).toBeNull();
  });
});

describe("旧行动识别链：闸门前补齐 MOVE 槽位", () => {
  const move = (text) => ({ kind: ACTION_KINDS.MOVE, target: null, item: null, direction: NONE, text, confidence: 0.9 });

  it("「进入断鞍古驿」不再被拒成「没说清往哪走」", () => {
    const plan = validatePlan(atDuanan, fillMoveSlots(atDuanan, [move("进入断鞍古驿")]));
    expect(plan.rejected).toBeFalsy();
    expect(plan.valid[0].enterBuilding.name).toBe("断鞍古驿");
  });

  it("「去大草甸」补成向南、标明出村", () => {
    const plan = validatePlan(atVillage, fillMoveSlots(atVillage, [move("去大草甸")]));
    expect(plan.rejected).toBeFalsy();
    expect(plan.valid[0]).toMatchObject({ direction: "南", outerDest: "大草甸" });
  });

  it("去不了时给出具体原因，说不清时给出引导", () => {
    const far = validatePlan(atVillage, fillMoveSlots(atVillage, [move("去锦官城")]));
    expect(far.rejected.reason).toContain("没有直通「锦官城」的路");
    const vague = validatePlan(atVillage, fillMoveSlots(atVillage, [move("随便走走")]));
    expect(vague.rejected.reason).toContain("点左栏建筑卡片");
  });
});
