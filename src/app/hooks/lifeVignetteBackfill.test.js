import { describe, expect, it, vi } from "vitest";
import { lifeVignetteBackfill } from "./lifeVignetteBackfill.js";

// WO-25K 验收：换房/读档 stale 静默丢弃、不污染 convo、成功时原位替换占位行。
const mkState = (over = {}) => ({
  room: { name: "鱼定村", desc: "村口泥地", npcs: [
    { name: "阿甲", brief: "好酒的老客", personality: "贪杯", innerRoom: "村口" },
    { name: "阿乙", brief: "贪杯的行脚商", personality: "馋酒", innerRoom: "村口" },
  ] },
  innerRoomName: "村口",
  char: { name: "少侠" },
  time: 100,
  convo: [{ role: "assistant", content: "你推门进屋。" }],
  varTree: { 世界: {} },
  companionState: {},
  ...over,
});

const vignette = {
  aName: "阿甲", bName: "阿乙", kind: "bond",
  outcome: "阿甲与阿乙拼桌叙旧——两人关系又近了半分", relationTag: "同好相交",
};

function harness(stateOver = {}, opts = {}) {
  const state = mkState(stateOver);
  const logWrites = [];
  let log = [{ t: "sys", text: "  阿甲与阿乙在一旁低声搭上了话……", fillKey: "vk1", fillSlot: 0 }];
  const setLog = (fn) => { log = fn(log); logWrites.push(log); };
  const ask = vi.fn(async () => ({ text: "阿甲把碗一推，阿乙笑着又满上一杯，两人低声算起路上的行情。" }));
  const ok = lifeVignetteBackfill(vignette, {
    key: "vk1", triggerRoomName: "鱼定村", triggerInnerRoomName: "村口",
    getState: () => state, setLog, canAsk: () => true, ask,
    ...opts,
  });
  return { state, ask, ok, getLog: () => log };
}

describe("lifeVignetteBackfill 护栏", () => {
  it("成功：白描原位替换占位行，带切片喂料，零 convo 写入", async () => {
    const h = harness();
    expect(h.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 30));
    expect(h.ask).toHaveBeenCalledTimes(1);
    const ctx = h.ask.mock.calls[0][0];
    expect(ctx.npcA.name).toBe("阿甲");
    expect(ctx.npcB.name).toBe("阿乙");
    expect(ctx.deterministicOutcome).toContain("拼桌叙旧");
    expect(ctx.pairRelationTag).toBe("同好相交");
    expect(ctx.shichen).toBeTruthy();
    const finalLog = h.getLog();
    expect(finalLog[0].text).toContain("阿甲把碗一推");
    expect(finalLog[0].fillKey).toBe("vk1");
    // convo 自始至终没被碰
    expect(h.state.convo).toHaveLength(1);
  });

  it("换房作废锁：触发后换了房间，白描静默丢弃不调用", async () => {
    const h = harness({ innerRoomName: "歇马居" }); // getState 已不在触发房
    await new Promise((r) => setTimeout(r, 30));
    expect(h.ask).not.toHaveBeenCalled();
    expect(h.getLog()[0].text).toContain("低声搭上了话"); // 占位行原样保底
  });

  it("离线/无 Key：不发起调用，占位行保底", async () => {
    const ask = vi.fn();
    lifeVignetteBackfill(vignette, {
      key: "vk2", triggerRoomName: "鱼定村", triggerInnerRoomName: "村口",
      getState: () => mkState(), setLog: (fn) => fn([]), canAsk: () => false, ask,
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(ask).not.toHaveBeenCalled();
  });

  it("白描不含当事者名字：信息降级，保留占位行", async () => {
    const h = harness({}, { ask: vi.fn(async () => ({ text: "屋里暖烘烘的，没人注意门外的风。" })) });
    await new Promise((r) => setTimeout(r, 30));
    expect(h.getLog()[0].text).toContain("低声搭上了话");
  });

  it("缺关键参数直接不启动", () => {
    expect(lifeVignetteBackfill(null, { key: "x" })).toBe(false);
    expect(lifeVignetteBackfill(vignette, {})).toBe(false);
  });
});

describe("Review 回归：户外房间不借别家场子的活计", () => {
  it("无锚定建筑时 activityDetail 为空（回退通用句），心境银囊仍带", async () => {
    // 村口有鸽子笼建筑——改用无建筑的外层房场景：innerRoomName 为 null
    const h = harness({ innerRoomName: null }, { triggerInnerRoomName: null });
    await new Promise((r) => setTimeout(r, 30));
    const ctx = h.ask.mock.calls[0][0];
    expect(ctx.npcA.activityDetail).toBe("");
  });
});
