import { describe, expect, it, vi } from "vitest";
import { roamReactionBackfill } from "./roamReactionBackfill.js";

// 同拍合并/换房丢弃/离线保底三护栏 + 喂入形状，全走注入桩不碰真 AI 网关。
const mkState = (over = {}) => ({
  room: { name: "鱼定村", desc: "村口泥地，酒旗斜挑。", npcs: [
    { name: "老孙", brief: "灶前掌柜", innerRoom: "村口" },
    { name: "路人甲", brief: "行脚客", innerRoom: "村口" },
  ] },
  innerRoomName: "村口",
  char: { name: "少侠", hp: [80, 100] },
  inv: [],
  time: 7,
  convo: [{ role: "assistant", content: "你推门进屋，酒气扑面。⟦好感2⟧" }],
  varTree: { 角色: { 路人甲: { 好感度: 45, 心账: [{ tag: "怨", summary: "言语冲撞", turn: 3 }] } } },
  ...over,
});

const movements = [
  { name: "路人甲", kind: "arrive", from: "歇马居", to: "村口", dir: "w", turn: 7 },
];

function harness(stateOver = {}, opts = {}) {
  const state = mkState(stateOver);
  const inserted = [];
  const setLog = (fn) => { inserted.push(fn([{ t: "sys", text: "  脚步声近，路人甲从「歇马居」走了过来。", fillKey: "k1", fillSlot: 0 }])); };
  const ask = vi.fn(async () => ({ text: "  门帘一掀，寒气裹着个行脚客进来，他朝掌柜点了点头，自寻角落坐下。" }));
  const ok = roamReactionBackfill(movements, {
    key: "k1", triggerRoomName: "鱼定村", triggerInnerRoomName: "村口",
    getState: () => state, setLog, canAsk: () => true, ask,
    ...opts,
  });
  return { state, inserted, ask, ok };
}

describe("roamReactionBackfill 三护栏", () => {
  it("同拍多人进出合并单次调用，喂入带关系心账与天时余波", async () => {
    const two = [...movements, { name: "老孙", kind: "depart", from: "村口", to: "歇马居", dir: "e", turn: 7 }];
    const setLog = vi.fn();
    const ask = vi.fn(async () => ({ text: "白描一段。" }));
    roamReactionBackfill(two, {
      key: "k2", triggerRoomName: "鱼定村", triggerInnerRoomName: "村口",
      getState: () => mkState(), setLog, canAsk: () => true, ask,
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(ask).toHaveBeenCalledTimes(1);
    const ctx = ask.mock.calls[0][0];
    expect(ctx.movements).toHaveLength(2);
    expect(ctx.movements[0].relationBrief).toContain("熟络");
    expect(ctx.movements[0].latestLedger).toContain("怨·言语冲撞");
    expect(ctx.movements[0].dirLabel).toBe("西");
    expect(ctx.lastBeatEcho).toContain("酒气扑面");
    expect(ctx.lastBeatEcho).not.toContain("⟦");
    expect(ctx.diegeticLine).toBeTruthy();
  });

  it("离线/无 Key：不发起调用，占位行原样保底", async () => {
    const ask = vi.fn();
    roamReactionBackfill(movements, {
      key: "k3", triggerRoomName: "鱼定村", triggerInnerRoomName: "村口",
      getState: () => mkState(), setLog: vi.fn(), canAsk: () => false, ask,
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(ask).not.toHaveBeenCalled();
  });

  it("换房静默丢弃：落屏前 innerRoomName 变了不插行", async () => {
    const state = mkState();
    const setLog = vi.fn((fn) => fn([]));
    const ask = vi.fn(async () => {
      state.innerRoomName = "歇马居"; // 玩家中途抬脚走人
      state.room = { ...state.room, name: "鱼定村" };
      return { text: "白描一段。" };
    });
    roamReactionBackfill(movements, {
      key: "k4", triggerRoomName: "鱼定村", triggerInnerRoomName: "村口",
      getState: () => state, setLog, canAsk: () => true, ask,
    });
    await new Promise((r) => setTimeout(r, 30));
    // insertWhenIdle 以 stale 拒绝——setLog 内落插应从未生效（roomGone 在 stale 链上）
    // 由于 stale 在 insertWhenIdle 首轮即 true，setLog 可能一次都未被调用或调用后原样返回
    for (const fn of setLog.mock.calls) {
      const out = fn[0]([{ t: "sys", text: "x", fillKey: "k4", fillSlot: 0 }]);
      expect(out.every((e) => !e.fillProse)).toBe(true);
    }
  });

  it("Review 修：单调用 JSON 原包剥 output 当余波，剥不动则空", async () => {
    const json = JSON.stringify({ output: "你刚跟老孙算完账，算盘声还响着。", delta: {} });
    const state = mkState({ convo: [{ role: "assistant", content: json }] });
    const ask = vi.fn(async () => ({ text: "白描。" }));
    roamReactionBackfill(movements, {
      key: "k6", triggerRoomName: "鱼定村", triggerInnerRoomName: "村口",
      getState: () => state, setLog: vi.fn(), canAsk: () => true, ask,
    });
    await new Promise((r) => setTimeout(r, 30));
    const ctx = ask.mock.calls[0][0];
    expect(ctx.lastBeatEcho).toContain("算盘声还响着");
    expect(ctx.lastBeatEcho).not.toContain("output");
    expect(ctx.lastBeatEcho).not.toContain("{");
    // 截断的 raw JSON：output 裸文本可挽救则挽救（纯散文无 JSON 残渣），
    // 关键是绝不含 JSON 语法外壳
    const state2 = mkState({ convo: [{ role: "assistant", content: json.slice(0, 20) }] });
    const ask2 = vi.fn(async () => ({ text: "白描。" }));
    roamReactionBackfill(movements, {
      key: "k7", triggerRoomName: "鱼定村", triggerInnerRoomName: "村口",
      getState: () => state2, setLog: vi.fn(), canAsk: () => true, ask: ask2,
    });
    await new Promise((r) => setTimeout(r, 30));
    const echo2 = ask2.mock.calls[0][0].lastBeatEcho;
    expect(echo2).not.toContain("{");
    expect(echo2).not.toContain("output");
    expect(echo2).not.toContain('"');
  });

  it("Review 修：旁观者含随行同伴；内层房取 INNER_MAP 房间描写", async () => {
    const state = mkState({
      companionState: { bailang: { unlocked: true, data: { name: "白狼" } } },
    });
    const ask = vi.fn(async () => ({ text: "白描。" }));
    roamReactionBackfill(movements, {
      key: "k8", triggerRoomName: "鱼定村", triggerInnerRoomName: "村口",
      getState: () => state, setLog: vi.fn(), canAsk: () => true, ask,
    });
    await new Promise((r) => setTimeout(r, 30));
    const ctx = ask.mock.calls[0][0];
    expect(ctx.bystanders.some((b) => b.includes("白狼"))).toBe(true);
    // 村口内层房描写应来自 INNER_MAP 而非据点级 room.desc
    const { getInnerRoom } = await import("../../domain/rules/map/innerMap.js");
    const innerDesc = getInnerRoom("鱼定村", "村口")?.desc;
    if (innerDesc) {
      expect(ctx.roomDescBrief).toBe(innerDesc.replace(/\s+/g, "").slice(0, 40));
    }
  });

  it("返回文本 trim 空串不插行", async () => {
    const setLog = vi.fn();
    roamReactionBackfill(movements, {
      key: "k5", triggerRoomName: "鱼定村", triggerInnerRoomName: "村口",
      getState: () => mkState(), setLog, canAsk: () => true,
      ask: async () => ({ text: "   \n  " }),
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(setLog).not.toHaveBeenCalled();
  });
});

describe("V6 原位替换占位行（验收）", () => {
  const placeholderLog = () => [
    { t: "sys", text: "  你掸了掸衣襟上的雪。", turn: 7 },
    { t: "sys", text: "  脚步声近，路人甲从「歇马居」走了过来。", fillKey: "k9", fillSlot: 0, turn: 7 },
  ];

  it("补写成功：日志总条数不变，占位行被白描原位替换", async () => {
    const state = mkState();
    let log = placeholderLog();
    const setLog = (fn) => { log = fn(log); };
    const ask = vi.fn(async () => ({ text: "门帘一掀，寒气裹着个行脚客进来，他朝掌柜点了点头。" }));
    roamReactionBackfill(movements, {
      key: "k9", triggerRoomName: "鱼定村", triggerInnerRoomName: "村口",
      getState: () => state, setLog, canAsk: () => true, ask,
    });
    await new Promise((r) => setTimeout(r, 60));
    expect(log).toHaveLength(2);
    const replaced = log.find((e) => e.fillKey === "k9");
    expect(replaced.text).toContain("门帘一掀");
    expect(replaced.text).not.toContain("脚步声近");
    expect(replaced.t).toBe("desc");
    expect(replaced.turn).toBe(7);
  });

  it("返回空文本/离线：占位行原样保留保底", async () => {
    const state = mkState();
    let log = placeholderLog();
    const setLog = (fn) => { log = fn(log); };
    const ask = vi.fn(async () => ({ text: "   " }));
    roamReactionBackfill(movements, {
      key: "k9", triggerRoomName: "鱼定村", triggerInnerRoomName: "村口",
      getState: () => state, setLog, canAsk: () => true, ask,
    });
    await new Promise((r) => setTimeout(r, 60));
    const row = log.find((e) => e.fillKey === "k9");
    expect(row.text).toContain("脚步声近");
    expect(log).toHaveLength(2);
  });

  it("换房后静默丢弃：不改写日志，占位行原样", async () => {
    const state = mkState();
    let log = placeholderLog();
    const setLog = (fn) => { log = fn(log); };
    const ask = vi.fn(async () => {
      state.innerRoomName = "老孙饭馆"; // 回调前玩家已换房
      return { text: "这段白描不该落屏。" };
    });
    roamReactionBackfill(movements, {
      key: "k9", triggerRoomName: "鱼定村", triggerInnerRoomName: "村口",
      getState: () => state, setLog, canAsk: () => true, ask,
    });
    await new Promise((r) => setTimeout(r, 60));
    const row = log.find((e) => e.fillKey === "k9");
    expect(row.text).toContain("脚步声近");
    expect(row.text).not.toContain("不该落屏");
  });
});
