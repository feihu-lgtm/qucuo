// commitRound 的写入契约测试——为「事务提交 + postCommit 处理器」拆分钉死现状。
// 每个 it 注释第一行就是该行为契约；只断言现状，不改实现。

import { mkRef, refAccessors, refValue } from "../../tests/mockRef.js";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NOTE_SOURCE, VIA } from "../../domain/rules/memory/note.js";

vi.mock("../ports/embeddingService.js", () => ({
  embeddingReady: vi.fn(() => true),
  getEmbedding: vi.fn(async () => null),
  embeddingFingerprint: vi.fn(() => "fp"),
}));
vi.mock("../ports/noteMemory.js", () => ({
  writeNote: vi.fn(() => Promise.resolve()),
  reembedStaleNotes: vi.fn(async () => 0),
}));

import { commitRound } from "./commitRound.js";
import { getRoundsSinceLastSave, getPlayedThisSession, resetAutosaveProgress } from "../../features/autosaveScheduler.js";
import { writeNote } from "../ports/noteMemory.js";

// 与 tests/stateWriters.test.js 同一套 deps 形状：state 是可变容器，
// 任意 set<X> 代理成对 state.<x 首字母小写> 的函数式/直接赋值。
function makeDeps(state, proposals = {}, overrides = {}) {
  const logs = [];
  const deps = new Proxy({
    ...state,
    p: proposals,
    apiCfg: {}, mapData: {}, rawFull: "叙事原文", narrativeText: "叙事原文",
    newConvo: [], convo: [], questProgress: {}, time: 25,
    // WO-06：refs 清退后改为 plan 直传字段 + getGameState + 注入回调
    pendDir: null, outerDepart: null, pickupJudgment: null, collectGranted: [],
    pickupExtractionFailed: false,
    roomCache: {},
    getGameState: () => ({ ...state, roomCache: state.roomCache || {} }),
    appendDayMaterial: (entry) => { (state._dayMaterial ||= []).push(entry); },
    getGambleSession: () => state._gambleSession ?? null,
    setGambleSession: (v) => { state._gambleSession = v; },
    mvuCommands: [], addLog: (rows) => logs.push(...rows),
    ...overrides,
  }, {
    get(target, key) {
      if (key in target) return target[key];
      if (typeof key !== "string" || !key.startsWith("set")) return undefined;
      // setLog 在生产里是日志数组的 React setter；测试里落到同一个 logs 数组上
      if (key === "setLog") {
        return (value) => {
          const next = typeof value === "function" ? value(logs) : value;
          logs.length = 0;
          logs.push(...next);
        };
      }
      const path = key[3].toLowerCase() + key.slice(4);
      return (value) => { state[path] = typeof value === "function" ? value(state[path]) : value; };
    },
  });
  return { deps, logs };
}

function baseState() {
  return {
    char: { name: "少侠", hp: [9, 40], money: 30, special: { 体魄: 5, 气运: 5 } },
    room: { name: "鱼定村", npcs: [], items: [] },
    inv: ["药丸"], flags: ["old"], varTree: { 角色: {}, 世界: {} }, gambleNegotiation: {},
    skills: [], pot: 20, exp: 0, time: 25,
  };
}

beforeEach(() => { writeNote.mockClear(); resetAutosaveProgress(); });
afterEach(() => { vi.useRealTimers(); });

describe("delta 写入契约", () => {
  it("flags_add 与现有 flags 取并集去重；commitRound 本身不写 questProgress", () => {
    // 契约：flags 是纯并集；questProgress 由 flag→stage 推进链在别处处理，commit 不动它。
    const state = baseState();
    const { deps } = makeDeps(state, { delta: { flags_add: ["new", "old", "new"] } });
    commitRound(deps);
    expect(state.flags).toEqual(["old", "new"]);
    expect(state.questProgress).toBeUndefined();
  });

  it("scriptOverride：flags_add 命中已登记台本的 stage 时，日志整体替换为台本原文、丢弃 p.output", () => {
    // 契约：quest_village1_s1 → village1_lubujianbuping s1_hear 台本逐行 t:"desc"、前缀两空格。
    const state = baseState();
    const { deps, logs } = makeDeps(state,
      { delta: { flags_add: ["quest_village1_s1"] }, output: ["AI 现场编的正文"] });
    commitRound(deps);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every(l => l.t === "desc" && l.text.startsWith("  "))).toBe(true);
    expect(logs.map(l => l.text).join("\n")).toContain("老猎户上下打量你一眼");
    expect(logs.map(l => l.text).join("\n")).not.toContain("AI 现场编的正文");
    expect(state.flags).toContain("quest_village1_s1"); // flag 本身照常登记
  });

  it("questProgress 已完成的同一 flag 不再触发台本（status !== active 被跳过）", () => {
    // 契约：prog.status !== "active" 的 quest 直接跳过台本检查，落回 p.output 展示。
    const state = baseState();
    const { deps, logs } = makeDeps(state,
      { delta: { flags_add: ["quest_village1_s1"] }, output: ["普通叙事"] },
      { questProgress: { village1_lubujianbuping: { status: "completed", currentStageIndex: 0 } } });
    commitRound(deps);
    expect(logs.map(l => l.text).join("\n")).toContain("普通叙事");
    expect(logs.map(l => l.text).join("\n")).not.toContain("老猎户上下打量你一眼");
  });
});

describe("MVU 裁决契约", () => {
  it("生气解除信号被消费：删除信号字段、生气状态置 inactive、打 ✓ 日志", () => {
    // 契约：set 角色.X.生气解除=true → resolveAngerSignals 清信号 + 写 {active:false,resolvedBy:"persuasion"}。
    const state = baseState();
    state.varTree.角色.侠客 = { 好感度: 50, 生气状态: { active: true } };
    const { deps, logs } = makeDeps(state, {}, {
      mvuCommands: [{ op: "set", path: "角色.侠客.生气解除", value: true }],
    });
    commitRound(deps);
    expect(state.varTree.角色.侠客.生气解除).toBeUndefined();
    expect(state.varTree.角色.侠客.生气状态).toEqual({ active: false, resolvedBy: "persuasion" });
    expect(logs).toContainEqual({ t: "affection", text: "  ✓ 侠客的怒气已经消解，这场风波算是揭过去了。" });
  });

  it("softSettle.target：该角色的 生气解除/生气状态/好感度 指令被整体裁决丢弃，别的指令放行", () => {
    // 契约：系统已结算的字段不再接受 AI 的 mvu 写入。
    const state = baseState();
    state.varTree.角色.侠客 = { 好感度: 50 };
    const { deps } = makeDeps(state, {}, {
      softSettle: { target: "侠客" },
      mvuCommands: [
        { op: "set", path: "角色.侠客.生气解除", value: true },
        { op: "add", path: "角色.侠客.好感度", value: 5 },
        { op: "set", path: "主角.别名", value: "青衣" },
      ],
    });
    commitRound(deps);
    expect(state.varTree.角色.侠客.生气解除).toBeUndefined();
    expect(state.varTree.角色.侠客.好感度).toBe(50); // 未被 AI 指令加
    expect(state.varTree.主角.别名).toBe("青衣");
  });

  it("giftSettlement：只放行该 NPC 的一条 add 好感度指令，其余 mvu 全丢", () => {
    const state = baseState();
    state.varTree.角色.侠客 = { 好感度: 50 };
    const { deps } = makeDeps(state, {}, {
      giftSettlement: { npc: "侠客", range: [0, 5] },
      mvuCommands: [
        { op: "add", path: "角色.侠客.好感度", value: 3 },
        { op: "add", path: "角色.别人.好感度", value: 3 },
        { op: "set", path: "主角.别名", value: "青衣" },
      ],
    });
    commitRound(deps);
    expect(state.varTree.角色.侠客.好感度).toBeGreaterThanOrEqual(50);
    expect(state.varTree.角色.别人).toBeUndefined();
    expect(state.varTree.主角).toBeUndefined();
  });

  it("幽灵好感度：既不在场也非已知角色的 角色.X.好感度 指令被丢弃", () => {
    const state = baseState();
    const { deps } = makeDeps(state, {}, {
      mvuCommands: [
        { op: "add", path: "角色.幽灵村民.好感度", value: 5 },
        { op: "set", path: "主角.别名", value: "青衣" },
      ],
    });
    commitRound(deps);
    expect(state.varTree.角色.幽灵村民).toBeUndefined();
    expect(state.varTree.主角.别名).toBe("青衣");
  });
});

describe("dealResult / 移动契约", () => {
  it("dealResult + gambleTalkCtx：报价 clamp 到 [0.8,1.5] 写入 gambleNegotiation，ctx 即清", () => {
    // 契约：settleNegotiation 的 finalOffer = min(round(baseOffer*mult), cash)，写 [stoneId][bidderName]。
    const state = baseState();
    const ctx = { baseOffer: 100, cash: Infinity, carry: [], stoneId: "s1", bidderName: "商人" };
    const { deps, logs } = makeDeps(state, {}, {
      dealResult: { priceMult: 99 }, // 越界 → clamp 到 1.5
      getGambleSession: () => ctx,
    });
    commitRound(deps);
    expect(state.gambleNegotiation.s1.商人).toBe(150);
    expect(state._gambleSession).toBeNull();
    expect(logs.some(l => l.t === "affection" && l.text.includes("谈妥了"))).toBe(true);
  });

  it("dealResult 但无谈价上下文：不写 gambleNegotiation", () => {
    const state = baseState();
    const { deps } = makeDeps(state, {}, { dealResult: { priceMult: 2 } });
    commitRound(deps);
    expect(state.gambleNegotiation).toEqual({}); // 无 ctx 不写入
  });

  it("lockedDestName：房间名/出口锁死为地图数据，desc 用 AI 的，npcs/items 用缓存", () => {
    // 契约：AI 只负责怎么形容，不负责去哪里。
    const state = baseState();
    const { deps, logs } = makeDeps(state,
      { room: { name: "别处的名字", desc: "AI 写的场景", npcs: [], items: [] } },
      { lockedDestName: "鱼定土司",
        getGameState: () => ({ ...state, roomCache: { 鱼定土司: { npcs: [{ name: "管家" }], items: [{ name: "凳子" }] } } }) });
    commitRound(deps);
    expect(state.room.name).toBe("鱼定土司");
    expect(state.room.exits).toEqual(["e"]);
    expect(state.room.desc).toBe("AI 写的场景");
    expect(state.room.npcs).toEqual([{ name: "管家" }]);
    expect(state.room.items).toEqual([{ name: "凳子" }]);
    expect(logs.some(l => l.text.includes("鱼定土司"))).toBe(true);
  });

  it("原地回合（无移动、在固定地图内）：room.npcs 名单不被 AI 名单覆盖", () => {
    // 契约：非移动回合在场名单以系统 r.npcs 为准——「此地的人一会好几个一会都走光」的防回归。
    const state = baseState();
    state.room.npcs = [{ name: "老面孔" }];
    const { deps } = makeDeps(state, { room: { name: "鱼定村", desc: "新描述", npcs: [{ name: "AI 新报的人" }] } });
    commitRound(deps);
    expect(state.room.npcs.map(n => n.name)).toEqual(["老面孔"]);
    expect(state.room.desc).toBe("新描述");
  });
});

describe("memory / 已知人物 / 收尾契约", () => {
  it("p.memory → dayMaterial 入账 + registerFact 写 varTree.世界.知识领域（在场者目击）+ writeNote 异步落小纸条", () => {
    // 契约：三条记忆通道各自的输入——witnesses=在场 npcs 目击、fact.id=turn_<time>_<第一目击者>。
    const state = baseState();
    state.room.npcs = [{ name: "侠客" }];
    const { deps } = makeDeps(state, { memory: "少侠在村口救了一只猫" });
    commitRound(deps);
    expect(state._dayMaterial).toEqual([{ turn: 25, text: "少侠在村口救了一只猫" }]);
    const facts = state.varTree.世界.知识领域.事实;
    expect(facts["turn_25_侠客"]).toBeDefined();
    expect(facts["turn_25_侠客"].标签).toBe("见闻");
    expect(facts["turn_25_侠客"].知晓者.侠客.途径).toBe("目击");
    expect(writeNote).toHaveBeenCalledOnce();
    const arg = writeNote.mock.calls[0][0];
    expect(arg).toMatchObject({ text: "少侠在村口救了一只猫", turn: 25, source: NOTE_SOURCE.NARRATIVE, place: "鱼定村", owner: [] });
  });

  it("对话模式：witness=对话对象亲历、writeNote owner=该对象 FIRSTHAND、事实标签=私语", () => {
    const state = baseState();
    const { deps } = makeDeps(state, { memory: "少侠答应了侠客一件事" }, { isTalk: true, talkTarget: "侠客" });
    commitRound(deps);
    const facts = state.varTree.世界.知识领域.事实;
    expect(facts["turn_25_侠客"].标签).toBe("私语");
    expect(facts["turn_25_侠客"].知晓者.侠客.途径).toBe("亲历");
    expect(writeNote.mock.calls[0][0]).toMatchObject({
      owner: [{ name: "侠客", via: VIA.FIRSTHAND }], source: NOTE_SOURCE.TALK,
    });
  });

  it("isTalk + talkTarget：对话对象标进 世界.已认识人物（「对话即认识」统一落点）", () => {
    const state = baseState();
    const { deps } = makeDeps(state, {}, { isTalk: true, talkTarget: "侠客" });
    commitRound(deps);
    expect(state.varTree.世界.已认识人物).toContain("侠客");
    expect(state.varTree.角色.侠客.好感度).toBeTypeOf("number"); // needsSeed → 初次好感种子
  });

  it("respondedNpcs 只认在场名单里的名字，幻觉名字丢弃", () => {
    const state = baseState();
    state.room.npcs = [{ name: "在场者" }];
    const { deps } = makeDeps(state, { respondedNpcs: ["在场者", "不在场的幻影"] }, { isTalk: true });
    commitRound(deps);
    expect(state.varTree.世界.已认识人物).toEqual(["在场者"]);
  });

  it("无 memory：不写 dayMaterial / 知识领域 / writeNote", () => {
    const state = baseState();
    const { deps } = makeDeps(state, {});
    commitRound(deps);
    expect(state._dayMaterial || []).toEqual([]);
    expect(state.varTree.世界.知识领域).toBeUndefined();
    expect(writeNote).not.toHaveBeenCalled();
  });

  it("收尾：非对话回合 time+1；convo 追加 assistant 条目带 memory/turn；轮次计数+1", () => {
    const state = baseState();
    const { deps } = makeDeps(state, { memory: "一笔账" });
    commitRound(deps);
    expect(state.time).toBe(26);
    expect(state.convo).toHaveLength(1);
    expect(state.convo[0]).toMatchObject({ role: "assistant", memory: "一笔账", turn: 25 });
    // WO-06：轮次计数收进 autosaveScheduler 模块状态
    expect(getRoundsSinceLastSave()).toBeGreaterThanOrEqual(1);
    expect(getPlayedThisSession()).toBe(true);
  });

  it("isTalk 回合 time 不前进", () => {
    const state = baseState();
    const { deps } = makeDeps(state, {}, { isTalk: true });
    commitRound(deps);
    expect(state.time).toBe(25);
  });

  it("choices 延迟 650ms 成批浮现（叙事之后隔一拍）", () => {
    vi.useFakeTimers();
    const state = baseState();
    const { deps, logs } = makeDeps(state, { choices: ["去北边", "留下"] });
    commitRound(deps);
    expect(logs.some(l => l.t === "choice")).toBe(false);
    vi.advanceTimersByTime(700);
    const choiceLogs = logs.filter(l => l.t === "choice");
    expect(choiceLogs.map(l => l.text)).toEqual(["  你可以：", "  [A] 去北边", "  [B] 留下"]);
    expect(choiceLogs[1].action).toBe("去北边");
  });

  it("p._truncated：追加截断警告 sys 行", () => {
    const state = baseState();
    const { deps, logs } = makeDeps(state, { output: ["半截正文"], _truncated: true });
    commitRound(deps);
    expect(logs.at(-1).text).toContain("被接口中途截断");
  });
});

// WO-13 复审必修：materializeFacts 的 companionState patch 不得静默丢弃。
it("materialized patches 里的 companionState 路径经 commitPatches 落盘不丢", () => {
  const state = baseState();
  state.companionState = { snowLeopard: { unlocked: true } };
  const { deps } = makeDeps(state, {}, {
    materialized: {
      changes: {},
      logs: [],
      patches: [
        { op: "merge", path: ["companionState", "snowLeopard", "bond"], value: { level: 2 }, factId: "F1_1" },
        { op: "add", path: ["varTree", "角色", "才旦", "好感度"], value: 3, factId: "F1_2" },
      ],
      receipts: [],
    },
  });
  commitRound(deps);
  // companionState 切片经 setCompanionState 函数式提交
  expect(state.companionState?.snowLeopard?.bond).toEqual({ level: 2 });
  // 原有键不被 merge 覆盖丢失
  expect(state.companionState?.snowLeopard?.unlocked).toBe(true);
  // 同批 varTree patch 照常落
  expect(state.varTree?.角色?.才旦?.好感度).toBe(3);
});

// WO-13 复审必修②：changes.claimedMilestones 不丢 + receipts 挂落账日志项（LogEntry/EffectReceiptCard 可消费）。
it("materialized changes.claimedMilestones 经 applyPostResult setters 落盘", () => {
  const state = baseState();
  const { deps } = makeDeps(state, {}, {
    materialized: {
      changes: { claimedMilestones: new Set(["根骨蜕凡"]) },
      logs: [],
      patches: [],
      receipts: [],
    },
  });
  commitRound(deps);
  expect(state.claimedMilestones instanceof Set ? [...state.claimedMilestones] : state.claimedMilestones).toContain("根骨蜕凡");
});

it("materialized.receipts 挂在末条落账日志项上，LogEntry 可消费形状保留", () => {
  const state = baseState();
  const receipt = { kind: "grant_item", factId: "F1_1", item: { name: "裂风豹骨哨", quality: "蓝" } };
  const { deps, logs } = makeDeps(state, {}, {
    materialized: {
      changes: {},
      logs: [{ t: "item", text: "  获得 裂风豹骨哨（蓝）" }],
      patches: [],
      receipts: [receipt],
    },
  });
  commitRound(deps);
  const carrier = logs.find((l) => Array.isArray(l.receipts) && l.receipts.length);
  expect(carrier).toBeTruthy();
  expect(carrier.receipts[0].kind).toBe("grant_item");
  expect(carrier.receipts[0].item.name).toBe("裂风豹骨哨");
});

it("materialized 无日志但有 receipts 时单独补一条天机落账行携带", () => {
  const state = baseState();
  const receipt = { kind: "grant_item", factId: "F1_1", item: { name: "残页" } };
  const { deps, logs } = makeDeps(state, {}, {
    materialized: { changes: {}, logs: [], patches: [], receipts: [receipt] },
  });
  commitRound(deps);
  const carrier = logs.find((l) => Array.isArray(l.receipts) && l.receipts.length);
  expect(carrier?.text).toContain("天机落账");
});
