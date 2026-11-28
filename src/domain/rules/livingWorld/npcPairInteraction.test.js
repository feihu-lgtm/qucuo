import { describe, expect, it } from "vitest";
import {
  pickPairVignette, scorePair, collectPairCandidates, pairKey,
  VIGNETTE_COOLDOWN_TURNS, npcPairVignetteRule,
} from "./npcPairInteraction.js";

// 鱼定村内层房「村口」双人在场的基本盘
const mkState = (over = {}) => ({
  room: {
    name: "鱼定村",
    npcs: [
      { name: "阿甲", brief: "好酒的老客", personality: "贪杯，无酒不欢", innerRoom: "村口" },
      { name: "阿乙", brief: "贪杯的行脚商", personality: "馋酒闻名", innerRoom: "村口" },
    ],
  },
  innerRoomName: "村口",
  time: 100,
  companionState: {},
  varTree: { 世界: {} },
  ...over,
});

// 扫一个时间窗找出一个确定起戏的刻（ seeded 确定性，不是随机赌博）
function findFiringTime(state, lo = 24, hi = 24 * 30) {
  for (let t = lo; t < hi; t += 1) {
    if (pickPairVignette({ ...state, time: t })) return t;
  }
  return null;
}

describe("WO-25K 微互动筛选与结算", () => {
  it("同好 quirks 圈子配成一对：拼桌叙旧，关系册落边", () => {
    const st = mkState();
    const t = findFiringTime(st);
    expect(t).not.toBeNull();
    const picked = pickPairVignette({ ...st, time: t });
    expect(picked).not.toBeNull();
    expect(new Set([picked.a.name, picked.b.name])).toEqual(new Set(["阿甲", "阿乙"]));
    expect(picked.kind).toBe("bond");
    expect(picked.outcome).toContain("不得推翻");
    // 确定性结算：关系册写边 + closeness 起步为 1
    const patch = picked.writeWorld(st.varTree.世界);
    const edge = patch.关系册[pairKey("阿甲", "阿乙")];
    expect(edge.closeness).toBe(1);
    expect(edge.tag).toBe("同好");
  });

  it("全局冷却：6 回合内不再起第二幕", () => {
    const st = mkState();
    const t = findFiringTime(st);
    for (let dt = 0; dt < VIGNETTE_COOLDOWN_TURNS; dt += 1) {
      const cooled = {
        ...st,
        time: t + dt,
        varTree: { 世界: { 微戏: { lastTurn: t } } },
      };
      if (dt === 0) continue; // 同刻本来就被时间 deps 挡住
      expect(pickPairVignette(cooled)).toBeNull();
    }
  });

  it("低概率门槛：非全起非全不起，且同刻同输入恒同", () => {
    const st = mkState();
    let fires = 0;
    const total = 200;
    for (let t = 24; t < 24 + total; t += 1) {
      if (pickPairVignette({ ...st, time: t })) fires += 1;
    }
    expect(fires).toBeGreaterThan(0);
    expect(fires).toBeLessThan(total * 0.7);
    const t = findFiringTime(st);
    expect(pickPairVignette({ ...st, time: t })?.line).toBe(pickPairVignette({ ...st, time: t })?.line);
  });

  it("传闻同步：一方知情一方不知情，结算把风声同步给对方", () => {
    const fact = { id: "f1", 摘要: "黑风寨暗哨换了岗", 知晓者: { 阿甲: { 途径: "亲见", 得知回合: 90 } }, 诞生回合: 90 };
    const st = mkState({
      varTree: { 世界: { 知识领域: { 事实: { f1: fact } } } },
    });
    const t = findFiringTime(st);
    const picked = pickPairVignette({ ...st, time: t });
    expect(picked.kind).toBe("rumor");
    expect(picked.outcome).toContain("阿甲");
    expect(picked.outcome).toContain("阿乙");
    const patch = picked.writeWorld(st.varTree.世界);
    expect(patch.知识领域.事实.f1.知晓者.阿乙).toBeTruthy();
    expect(patch.知识领域.事实.f1.知晓者.阿乙.途径).toContain("阿甲");
    // 原知情者不受影响
    expect(patch.知识领域.事实.f1.知晓者.阿甲.途径).toBe("亲见");
  });

  it("无亲和的一对不起戏：零关系零同好零同门零风声", () => {
    const st = mkState({
      room: {
        name: "鱼定村",
        npcs: [
          { name: "路人丙", brief: "行脚客", personality: "沉默寡言", innerRoom: "村口" },
          { name: "路人丁", brief: "过路商贩", personality: "精明", innerRoom: "村口" },
        ],
      },
    });
    for (let t = 24; t < 24 * 20; t += 1) {
      expect(pickPairVignette({ ...st, time: t })).toBeNull();
    }
  });

  it("同伴与敌对者不入选", () => {
    const st = mkState();
    const candidates = collectPairCandidates({
      ...st,
      room: {
        name: "鱼定村",
        npcs: [
          ...st.room.npcs,
          { name: "敌对者", hostile: true, innerRoom: "村口" },
        ],
      },
    });
    expect(candidates.map((c) => c.name)).not.toContain("敌对者");
  });

  it("旧识关系边加分", () => {
    const a = { name: "阿甲", brief: "好酒" };
    const b = { name: "阿乙", brief: "贪杯" };
    const noEdge = scorePair(a, b, {});
    const withEdge = scorePair(a, b, { 关系册: { [pairKey("阿甲", "阿乙")]: { closeness: 2 } } });
    expect(withEdge.score).toBeGreaterThan(noEdge.score);
  });

  it("世界规则形态：时间不动不触发，动了才判定", () => {
    const st = mkState();
    expect(npcPairVignetteRule.run(st, { firstRun: true })).toBeNull();
    // previousDeps 同刻 → 不动
    expect(npcPairVignetteRule.run(st, { firstRun: false, previousDeps: [100, "鱼定村", "村口"] })).toBeNull();
    // 换房那一刻不动
    expect(npcPairVignetteRule.run({ ...st, time: 101 }, { firstRun: false, previousDeps: [100, "鱼定村", "歇马居"] })).toBeNull();
  });

  it("规则结果带占位行与 varTree 写入，微戏冷却落账", () => {
    const st = mkState();
    const t = findFiringTime(st);
    const fired = { ...st, time: t };
    // 直接验证纯函数层冷却写
    const picked = pickPairVignette(fired);
    expect(picked.cooldownWrite.lastTurn).toBe(t);
    expect(picked.line).toContain("低声搭上了话");
  });
});
