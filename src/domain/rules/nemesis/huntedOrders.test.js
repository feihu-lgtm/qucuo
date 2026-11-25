import { describe, it, expect } from "vitest";
import { huntedOrdersOf, followingTraitors, huntedConflictWithNpc, pendingHuntedNotices, huntedNoticeRule } from "./huntedOrders.js";

const ORDER = { faction: "黑风寨", entryId: "heifeng_麻三", name: "麻三", turn: 5, note: "麻三背黑风寨投敌，悬令追杀" };

function stateWith({ orders = [ORDER], companionName = "麻三", stationed = false, room = "黑风寨" } = {}) {
  return {
    time: 20,
    room: { name: room, npcs: [] },
    companionState: companionName ? {
      [`imported_${companionName}`]: {
        unlocked: true, active: true, label: companionName,
        data: { name: companionName },
        ...(stationed ? { stationed: { district: "天都镇" } } : {}),
      },
    } : {},
    varTree: { 世界: { 追杀令: orders } },
  };
}

describe("WO-23C6 追杀令后果纯函数层", () => {
  it("huntedOrdersOf 坏账不炸、滤坏条目", () => {
    expect(huntedOrdersOf(null)).toEqual([]);
    expect(huntedOrdersOf({ 世界: { 追杀令: "oops" } })).toEqual([]);
    expect(huntedOrdersOf({ 世界: { 追杀令: [ORDER, null, { nofaction: 1 }] } })).toEqual([ORDER]);
  });
  it("followingTraitors：随行叛徒命中；留守/未入队不算", () => {
    expect(followingTraitors(stateWith().companionState, stateWith().varTree)).toHaveLength(1);
    expect(followingTraitors(stateWith({ stationed: true }).companionState, stateWith().varTree)).toHaveLength(0);
    expect(followingTraitors({}, stateWith().varTree)).toHaveLength(0);
    expect(followingTraitors(stateWith({ companionName: "旁人" }).companionState, stateWith().varTree)).toHaveLength(0);
  });
  it("huntedConflictWithNpc：同势力 NPC 命中、外势力/无势力 null", () => {
    const st = stateWith();
    expect(huntedConflictWithNpc(st, { name: "山寨头目", faction: "黑风寨" })?.order).toEqual(ORDER);
    expect(huntedConflictWithNpc(st, { name: "雪山弟子", faction: "雪山派" })).toBeNull();
    expect(huntedConflictWithNpc(st, { name: "路人" })).toBeNull();
    expect(huntedConflictWithNpc(st, null)).toBeNull();
  });
  it("pendingHuntedNotices：入原势力地盘且未提点；已提点/外地盘不出", () => {
    expect(pendingHuntedNotices(stateWith({ room: "黑风寨" }))).toHaveLength(1);
    const noticed = { ...ORDER, noticedTurn: 10 };
    expect(pendingHuntedNotices(stateWith({ orders: [noticed] }))).toHaveLength(0);
    expect(pendingHuntedNotices(stateWith({ room: "天都镇" }))).toHaveLength(0);
  });
  it("huntedNoticeRule：一次性提点+noticedTurn 落账不刷屏；firstRun 不补历史", () => {
    const st = stateWith();
    const res = huntedNoticeRule.run(st, { firstRun: false });
    expect(res.logs).toHaveLength(1);
    expect(res.logs[0].text).toContain("追杀令");
    const vt = res.changes.varTree(st.varTree);
    expect(vt.世界.追杀令[0].noticedTurn).toBe(20);
    // 提点过不再出
    expect(huntedNoticeRule.run({ ...st, varTree: vt }, { firstRun: false })).toBeNull();
    // firstRun 静默
    expect(huntedNoticeRule.run(st, { firstRun: true })).toBeNull();
  });
});
