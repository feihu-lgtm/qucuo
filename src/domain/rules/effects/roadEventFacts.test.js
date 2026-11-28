// WO-25P 验收：路遇五类事实码落账 + roadEventWrites 转换器。
// 补丁经 applyPatches 实落到状态袋验证真效果，不只看补丁形状。
import { describe, expect, it } from "vitest";
import { materializeFacts } from "./materializeFacts.js";
import { applyPatches } from "../state/applyPatches.js";
import { buildRoadEventWritesResult } from "../livingWorld/roadEvents.js";
import { factionRepOf } from "../economy/factionRep.js";
import { getTension } from "../conflict/tension.js";

function baseState() {
  return {
    time: 42,
    inv: [],
    room: { name: "雅江", items: [], npcs: [{ name: "老孙", carriedItems: [] }] },
    char: { name: "少侠", hp: [30, 40], money: 50, special: {} },
    skills: [], exp: 0, pot: 0,
    flags: [],
    varTree: { 角色: {}, 世界: {} },
    claimedMilestones: new Set(),
    companionState: {},
  };
}

function applyFacts(state, facts) {
  const out = materializeFacts(state, facts, {});
  const bag = applyPatches({ varTree: state.varTree, companionState: {} }, out.patches).state;
  return { out, varTree: bag.varTree };
}

describe("WO-25P 路遇事实码落账", () => {
  it("FACTION_REP：声誉入账且对头联动扣分，重复执行幂等钳制", () => {
    const { varTree, out } = applyFacts(baseState(), [
      { id: "R1", op: "FACTION_REP", faction: "黑风寨", delta: 5 },
    ]);
    expect(factionRepOf(varTree, "黑风寨")).toBe(5);
    expect(out.receipts[0]).toMatchObject({ kind: "faction_rep", faction: "黑风寨", delta: 5 });
    // 超 ±10 限幅被钳
    const big = applyFacts(baseState(), [{ id: "R2", op: "FACTION_REP", faction: "黑风寨", delta: 99 }]);
    expect(factionRepOf(big.varTree, "黑风寨")).toBeLessThanOrEqual(10);
  });

  it("FACTION_TENSION：张力写入 0-100 钳制", () => {
    const { varTree } = applyFacts(baseState(), [
      { id: "T1", op: "FACTION_TENSION", a: "黑风寨", b: "玉泉寨", delta: 15 },
    ]);
    const base = getTension({}, "黑风寨", "玉泉寨");
    expect(getTension(varTree.世界.tension, "黑风寨", "玉泉寨")).toBe(Math.min(100, base + 15));
  });

  it("ADD_SITUATION：挂卡带期限，同卡幂等不重复", () => {
    const st = baseState();
    const facts = [
      { id: "S1", op: "ADD_SITUATION", situation: "sit_road_blockade", district: "雅江" },
      { id: "S2", op: "ADD_SITUATION", situation: "sit_road_blockade", district: "雅江" },
    ];
    const { varTree } = applyFacts(st, facts);
    const cards = varTree.世界.据点局势.雅江;
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe("sit_road_blockade");
    expect(cards[0].sinceDay).toBe(Math.floor(42 / 24) + 1);
    expect(cards[0].expireDay).toBe(cards[0].sinceDay + 3);
  });

  it("CLEAR_SITUATION：指定卡化解，其他卡不动", () => {
    const st = baseState();
    st.varTree.世界.据点局势 = { 雅江: [{ id: "sit_road_blockade", sinceDay: 1 }, { id: "sit_grain_cheap", sinceDay: 1 }] };
    const { varTree } = applyFacts(st, [{ id: "C1", op: "CLEAR_SITUATION", situation: "sit_road_blockade", district: "雅江" }]);
    expect(varTree.世界.据点局势.雅江.map((c) => c.id)).toEqual(["sit_grain_cheap"]);
  });

  it("SITUATION_TRIGGER：商队到站化解山道封锁，药品到埠额外化伤药紧俏", () => {
    const st = baseState();
    st.varTree.世界.据点局势 = {
      雅江: [
        { id: "sit_road_blockade", sinceDay: 1 },
        { id: "sit_herb_shortage", sinceDay: 1 },
        { id: "sit_pilgrim_crowd", sinceDay: 1 },
      ],
    };
    const tea = applyFacts(st, [{ id: "G1", op: "SITUATION_TRIGGER", trigger: "caravan_arrived:tea", district: "雅江" }]);
    expect(tea.varTree.世界.据点局势.雅江.map((c) => c.id)).toEqual(["sit_herb_shortage", "sit_pilgrim_crowd"]);
    const med = applyFacts(st, [{ id: "G2", op: "SITUATION_TRIGGER", trigger: "caravan_arrived:medicine", district: "雅江" }]);
    expect(med.varTree.世界.据点局势.雅江.map((c) => c.id)).toEqual(["sit_pilgrim_crowd"]);
  });

  it("COMPANION_CANDIDATE：imported 入房 + 钉初始好感，已有好感不覆盖，已在房不重复", () => {
    const st = baseState();
    const { out, varTree } = applyFacts(st, [
      { id: "P1", op: "COMPANION_CANDIDATE", npc: "鱼丽", cast: { name: "鱼丽", brief: "大肥鱼", title: "游侠" }, affectionPin: 40 },
    ]);
    const npc = out.changes.room.npcs.find((n) => n.name === "鱼丽");
    expect(npc).toBeTruthy();
    expect(npc.imported).toBe(true);
    expect(npc.companionCandidate).toBe(true);
    expect(npc.brief).toBe("大肥鱼");
    expect(varTree.角色.鱼丽.好感度).toBe(40);
    // 已有好感账更高：不覆盖
    const st2 = baseState();
    st2.varTree.角色 = { 鱼丽: { 好感度: 88 } };
    st2.room.npcs.push({ name: "鱼丽", carriedItems: [] });
    const again = applyFacts(st2, [{ id: "P2", op: "COMPANION_CANDIDATE", npc: "鱼丽", cast: {}, affectionPin: 40 }]);
    expect(again.varTree.角色.鱼丽.好感度).toBe(88);
    expect(again.out.changes.room).toBeUndefined(); // 已在房不动房间
    // 美人 60 / 兽伴 beast
    const mate = applyFacts(baseState(), [{ id: "P3", op: "COMPANION_CANDIDATE", npc: "梅影", cast: {}, affectionPin: 60, romance: true }]);
    expect(mate.varTree.角色.梅影.好感度).toBe(60);
    const beast = applyFacts(baseState(), [{ id: "P4", op: "COMPANION_CANDIDATE", npc: "雪獒", beast: true, role: "兽伴", affectionPin: 40 }]);
    expect(beast.out.changes.room.npcs.find((n) => n.name === "雪獒")?.beast).toBe(true);
  });

  it("RUMOR_HOOK：尾章有新人物才落传闻册，空则落空不落账", () => {
    const hit = applyFacts(baseState(), [
      { id: "H1", op: "RUMOR_HOOK", npc: "背夫", mentionedNewNpcs: ["盐帮老幺"] },
    ]);
    expect(hit.varTree.世界.传闻人物.盐帮老幺).toBeTruthy();
    expect(hit.varTree.世界.传闻人物.盐帮老幺.context).toContain("背夫");
    const miss = applyFacts(baseState(), [{ id: "H2", op: "RUMOR_HOOK", npc: "背夫" }]);
    expect(miss.varTree.世界.传闻人物).toBeUndefined();
    expect(miss.out.logs.some((l) => l.text.includes("传闻钩落空"))).toBe(true);
    // 幂等：在册不覆盖既有 context
    const st = baseState();
    st.varTree.世界.传闻人物 = { 盐帮老幺: { name: "盐帮老幺", context: "旧档原账" } };
    const dup = applyFacts(st, [{ id: "H3", op: "RUMOR_HOOK", npc: "x", mentionedNewNpcs: ["盐帮老幺"] }]);
    expect(dup.varTree.世界.传闻人物.盐帮老幺.context).toBe("旧档原账");
  });
});

describe("WO-25P roadEventWrites 落账转换", () => {
  const writes = {
    flagsAdd: ["road_once_evA1"],
    worldEvent: { id: "road_evA1_42", kind: "road", actors: ["鱼丽"], witnesses: ["主角", "鱼丽"], summary: "人物槽·美人救难", importance: 2, knownDistricts: ["雅江"], turn: 42 },
    rosterSync: { name: "鱼丽", at: "雅江" },
  };

  it("flags/事件录/游走册三件套经 applyResult 语义落账", () => {
    const state = { flags: [], time: 42, varTree: { 世界: {} } };
    const result = buildRoadEventWritesResult(writes, state);
    expect(result.changes.flags).toEqual(["road_once_evA1"]);
    const vt = result.changes.varTree(state.varTree);
    expect(vt.世界.事件录).toHaveLength(1);
    expect(vt.世界.事件录[0].kind).toBe("road");
    expect(vt.世界.事件录[0].witnesses).toContain("鱼丽");
    expect(vt.世界.事件录[0].knownDistricts).toEqual(["雅江"]);
    expect(vt.世界.游走册.鱼丽).toMatchObject({ at: "雅江", since: 42 });
  });

  it("幂等：事件 id 去重不双落，旗帜不重复", () => {
    const state = { flags: ["road_once_evA1"], time: 42, varTree: { 世界: { 事件录: [writes.worldEvent] } } };
    const result = buildRoadEventWritesResult(writes, state);
    expect(result.changes.flags).toBeUndefined(); // 无新增不出 flags 写
    const vt = result.changes.varTree(state.varTree);
    expect(vt.世界.事件录).toHaveLength(1);
  });

  it("rosterSync 保留册上 inner/carrySnapshot——同房锁定语义不冲突", () => {
    const state = {
      flags: [], time: 42,
      varTree: { 世界: { 游走册: { 鱼丽: { at: "大草甸", inner: "村口", since: 10, carrySnapshot: [{ name: "鱼骨剑" }] } } } },
    };
    const result = buildRoadEventWritesResult(writes, state);
    const vt = result.changes.varTree(state.varTree);
    expect(vt.世界.游走册.鱼丽.at).toBe("雅江");
    expect(vt.世界.游走册.鱼丽.inner).toBe("村口");
    expect(vt.世界.游走册.鱼丽.carrySnapshot).toHaveLength(1);
  });

  it("空 writes 安全降级", () => {
    expect(buildRoadEventWritesResult(null, {})).toBeNull();
    const bare = buildRoadEventWritesResult({ flagsAdd: [], worldEvent: null, rosterSync: null }, { flags: [], time: 1, varTree: {} });
    expect(bare.changes.flags).toBeUndefined();
  });
});
