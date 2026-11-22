import { describe, expect, it } from "vitest";
import { giftNpc } from "./exchange.js";

const deed = { id: "deed1", name: "曲措旧田契残页", category: "misc", quality: "绿" };
const state = (stageIndex, status = "active") => ({
  inv: [deed],
  flags: [],
  varTree: {},
  questProgress: { emei_1_xichengshiyao: { status, currentStageIndex: stageIndex } },
});

describe("送礼不吞任务道具", () => {
  it("峨1 交还阶段把田契残页当礼物送给了因师太：不扣物品，提示去任务面板", () => {
    const result = giftNpc(state(2), { name: "了因师太" }, deed, 0);
    expect(result.changes).toBeUndefined();
    expect(result.logs[0].text).toMatch(/峨1·西城施药.*任务面板/);
  });

  it("还没拿到道具的阶段、任务已结束时照常能送", () => {
    expect(giftNpc(state(1), { name: "了因师太" }, deed, 0).changes.inv).toEqual([]);
    expect(giftNpc(state(2, "completed"), { name: "了因师太" }, deed, 0).changes.inv).toEqual([]);
  });

  it("任务奖励里的普通货（fromCatalog）照常能送", () => {
    const lotus = { id: "l1", name: "铁莲子" };
    const result = giftNpc({
      inv: [lotus], flags: [], varTree: {},
      questProgress: { tangmen_3_zhulintingfeng: { status: "active", currentStageIndex: 99 } },
    }, { name: "了因师太" }, lotus, 0);
    expect(result.changes.inv).toEqual([]);
  });

  it("对上当前阶段 deliver 的照常交付并推进", () => {
    const tooth = { id: "t1", name: "虎王的牙筋" };
    const result = giftNpc({
      inv: [tooth], flags: [], varTree: {},
      questProgress: { divine_huxiao: { status: "active", currentStageIndex: 3 } },
    }, { name: "老猎户" }, tooth, 0);
    expect(result.deliveredQuest?.id).toBe("divine_huxiao");
  });
});
