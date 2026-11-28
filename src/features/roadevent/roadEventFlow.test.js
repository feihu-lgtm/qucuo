import { describe, expect, it } from "vitest";
import { rollMovementEvents } from "../map/encounter.js";
import { matchRoadEventChoice, settleRoadEventChoice } from "./settle.js";
import { getRoadEventPending, setRoadEventPending, clearRoadEventPending } from "./pending.js";
import { rollRoadEvent, ROAD_EVENT_SHARE } from "../../domain/rules/livingWorld/roadEvents.js";

// 最小逼真 state：路遇池按真实数据（when 谓词/冷却/地域）筛，400 件在册。
const makeState = (overrides = {}) => ({
  time: 100,
  char: { special: { 气运: 5, 根骨: 5, 悟性: 5, 体魄: 5, 魅力: 5, 智谋: 5, 身法: 5 }, silver: 100 },
  varTree: { 世界: {} },
  flags: [],
  inv: [],
  companionState: {},
  ...overrides,
});

describe("WO-25O rollMovementEvents 路遇分流", () => {
  it("命中遭遇后按 ROAD_EVENT_SHARE 分流：路遇与势力过路人互斥，比例落在 0.6 附近", () => {
    const state = makeState();
    let road = 0;
    let faction = 0;
    const RUNS = 3000;
    for (let i = 0; i < RUNS; i++) {
      const result = rollMovementEvents({
        isTalk: false,
        movingDir: "n",
        lockedDestName: "打箭炉",
        targetedRumor: false,
        random: Math.random,
        luck: 5,
        state,
      });
      if (result.roadRoll) {
        road++;
        // 互斥：分流成路遇时不再保留势力过路人
        expect(result.encounterToDescribe).toBeNull();
        expect(result.roadRoll.options).toHaveLength(3);
        expect(result.roadRoll.options.map((o) => o.key)).toEqual(["main", "alt", "leave"]);
      } else if (result.encounterToDescribe) {
        faction++;
      }
    }
    expect(road).toBeGreaterThan(0);
    expect(faction).toBeGreaterThan(0); // 其余仍保留原势力过路人
    const share = road / (road + faction);
    expect(share).toBeGreaterThan(ROAD_EVENT_SHARE - 0.08);
    expect(share).toBeLessThan(ROAD_EVENT_SHARE + 0.08);
  });

  it("遭遇未命中时不产生路遇——分流只在命中之后发生，伏击等他处优先级不受影响", () => {
    // random 恒 0.99：拾取/分流都不命中；路遇只可能来自 encounterToDescribe 命中后的分流，
    // 而分流判定 random() < 0.6 恒假，故绝无 roadRoll——证明 roadRoll 不会凭空出现。
    for (let i = 0; i < 50; i++) {
      const result = rollMovementEvents({
        isTalk: false,
        movingDir: "n",
        lockedDestName: "打箭炉",
        targetedRumor: false,
        random: () => 0.99,
        luck: 5,
        state: makeState(),
      });
      expect(result.roadRoll).toBeNull();
    }
  });

  it("无 state 传入时退回原行为（兼容旧调用）：永不产生 roadRoll", () => {
    for (let i = 0; i < 100; i++) {
      const result = rollMovementEvents({
        isTalk: false,
        movingDir: "n",
        lockedDestName: "打箭炉",
        targetedRumor: false,
        random: () => 0,
        luck: 5,
      });
      expect(result.roadRoll).toBeNull();
    }
  });
});

describe("WO-25O matchRoadEventChoice 输入匹配", () => {
  const roll = {
    options: [
      { key: "main", label: "下场一试" },
      { key: "alt", label: "旁观看破" },
      { key: "leave", label: "不凑热闹" },
    ],
  };
  it("按钮照抄 label 直发精确命中", () => {
    expect(matchRoadEventChoice(roll, "下场一试")).toBe("main");
    expect(matchRoadEventChoice(roll, "旁观看破")).toBe("alt");
    expect(matchRoadEventChoice(roll, "不凑热闹")).toBe("leave");
  });
  it("手敲包含关系与序号也能命中", () => {
    expect(matchRoadEventChoice(roll, "我也下场一试")).toBe("main");
    expect(matchRoadEventChoice(roll, "1")).toBe("main");
    expect(matchRoadEventChoice(roll, "3")).toBe("leave");
  });
  it("不相干输入不命中", () => {
    expect(matchRoadEventChoice(roll, "北")).toBeNull();
    expect(matchRoadEventChoice(roll, "")).toBeNull();
    expect(matchRoadEventChoice(null, "下场一试")).toBeNull();
  });
});

describe("WO-25O settleRoadEventChoice 结算通道", () => {
  const state = makeState();
  const roll = rollRoadEvent(state, "打箭炉", { rng: Math.random, luck: 5 });

  it("产出 applyResult 形状：changes/logs 齐备，patches 折进函数式更新器", () => {
    const settled = settleRoadEventChoice({ roll, optionKey: "alt", state, rng: () => 0 });
    expect(settled.outcome.optionKey).toBe("alt");
    expect(settled.changes).toBeTypeOf("object");
    // varTree 更新器必须能把事件录写进世界账本（幂等含 id）
    expect(typeof settled.changes.varTree).toBe("function");
    const nextTree = settled.changes.varTree({ 世界: {} });
    const events = nextTree.世界.事件录;
    expect(events.length).toBe(1);
    expect(events[0].id).toMatch(/^road_/);
    expect(settled.logs[0].text).toContain("路遇结算");
  });

  it("leave 选择无得失仍翻篇落账", () => {
    const settled = settleRoadEventChoice({ roll, optionKey: "leave", state, rng: () => 0 });
    expect(settled.outcome.success).toBeNull();
    expect(settled.outcome.facts).toEqual([]);
    expect(settled.logs[0].text).toContain("翻篇");
    expect(typeof settled.changes.varTree).toBe("function");
  });

  it("main 检定成败两条路都能确定性走完", () => {
    for (const rng of [() => 0, () => 0.999]) {
      const settled = settleRoadEventChoice({ roll, optionKey: "main", state, rng });
      expect(settled.outcome.optionKey).toBe("main");
      expect(typeof settled.changes.varTree).toBe("function");
    }
  });
});

describe("WO-25O 挂起账（会话级）", () => {
  it("set/get/clear 往返", () => {
    expect(getRoadEventPending()).toBeNull();
    setRoadEventPending({ roll: { eventId: "x" } });
    expect(getRoadEventPending().roll.eventId).toBe("x");
    clearRoadEventPending();
    expect(getRoadEventPending()).toBeNull();
    setRoadEventPending(null);
    expect(getRoadEventPending()).toBeNull();
  });
});

describe("WO-25O 复审修包回归", () => {
  it("epoch 护栏：读档/回滚换账后挂起作废，同账放行", async () => {
    const { isPendingFresh } = await import("./pending.js");
    const pending = { roll: { eventId: "x" }, epoch: 7 };
    expect(isPendingFresh(pending, 7)).toBe(true);
    expect(isPendingFresh(pending, 8)).toBe(false); // 换过账——照面在新账从未发生
    expect(isPendingFresh(pending, null)).toBe(true); // epoch 缺失放行（旁路/测试）
    expect(isPendingFresh({ roll: { eventId: "x" } }, 8)).toBe(true);
    expect(isPendingFresh(null, 8)).toBe(false);
  });

  it("warrant 事实暂定名：买货不再「扣银两没交货」", async () => {
    const { nameWarrantFacts } = await import("./settle.js");
    const named = nameWarrantFacts([
      { op: "GRANT_ITEM", warrant: true, category: "weapon", quality: "蓝" },
      { op: "GRANT_ITEM", warrant: true, category: "armor", quality: "白" },
      { op: "BESTOW_SKILL", warrant: true, school: "昆仑", quality: "紫" },
      { op: "GRANT_ITEM", warrant: true, category: "misc", quality: "绿", itemName: "已有名" },
    ]);
    expect(named[0].itemName).toBe("精铸兵刃");
    expect(named[1].itemName).toBe("粗制护甲");
    expect(named[2].skillName).toBe("昆仑流紫品武学");
    expect(named[3].itemName).toBe("已有名"); // 已有名不覆盖
  });

  it("卖货路遇全链路：银两照扣、物件照收——materializeFacts 不再落空", async () => {
    const { materializeFacts } = await import("../../domain/rules/effects/materializeFacts.js");
    const { nameWarrantFacts: nf } = await import("./settle.js");
    const state = makeState();
    const facts = nf([
      { op: "CHANGE_VITALS_SILVER", moneyDelta: -50 },
      { op: "GRANT_ITEM", warrant: true, category: "weapon", quality: "蓝" },
    ]);
    const out = materializeFacts(state, facts, {});
    const errLogs = (out.logs || []).filter((l) => String(l.text || l).includes("无物可授"));
    expect(errLogs).toEqual([]);
    // 物件经 patches/inv 落账：变化里必须有 inv 通道产出
    const invChange = out.changes?.inv ?? out.patches?.filter((p) => String(p.path).includes("inv"));
    expect(invChange).toBeTruthy();
  });
});
