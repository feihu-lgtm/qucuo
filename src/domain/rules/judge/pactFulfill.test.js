// WO-22B-P3 履约判定契约测试：判官窄规则核验签发 + materializeFacts 物化奖励/幂等/违约闸。
import { describe, expect, it } from "vitest";
import { judgeTurn } from "./judgeTurn.js";
import { materializeFacts } from "../effects/materializeFacts.js";

function seqRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

const PACTS = {
  才旦: {
    pact_1: { npc: "才旦", promise: "把青钢剑送还给我", deadlineHours: 24, rewardHint: "50 两", bindTurn: 10, witnesses: ["主角", "才旦"] },
  },
};

function envelope(extra = {}) {
  return {
    turn: 20, day: 2, place: "鱼定村", npcs: [{ name: "才旦", personality: "豪爽", levelCap: 2 }],
    varTree: { 角色: {}, 世界: { 契约: PACTS } },
    inv: [{ id: "it_sword1", name: "青钢剑", category: "weapon", quality: "白" }],
    entries: [], budget: { riskLevel: 1 }, ...extra,
  };
}
// give 动作高好感豪爽 NPC 低骰必收——构造 TRANSFER_ITEM player→才旦
const giveAction = { kind: "give", target: "才旦", item: "青钢剑", itemId: "it_sword1", direction: "none", stance: "casual" };

describe("judgeTurn 履约核验签发", () => {
  it("交付类履约：送还的物在 promise 里且 TRANSFER 已签 → settle 签发", () => {
    const verdict = judgeTurn(envelope(), { read: "", refIds: [], actions: [giveAction], proposals: [] }, { rng: seqRng([0.01]) });
    const settle = verdict.facts.find((f) => f.op === "BIND_OR_SETTLE_PACT" && f.settle === true);
    expect(settle).toBeTruthy();
    expect(settle.settleKey).toBe("pact_1");
    expect(settle.npc).toBe("才旦");
  });

  it("对象 NPC 不在场不签", () => {
    const verdict = judgeTurn(envelope({ npcs: [] }), { read: "", refIds: [], actions: [giveAction], proposals: [] }, { rng: seqRng([0.01]) });
    expect(verdict.facts.some((f) => f.op === "BIND_OR_SETTLE_PACT" && f.settle)).toBe(false);
  });

  it("文不对题不签：送的东西 promise 里没提", () => {
    const env = envelope({ inv: [{ id: "it_x", name: "牛皮靴", category: "armor" }] });
    const act = { ...giveAction, item: "牛皮靴", itemId: "it_x" };
    const verdict = judgeTurn(env, { read: "", refIds: [], actions: [act], proposals: [] }, { rng: seqRng([0.01]) });
    expect(verdict.facts.some((f) => f.op === "BIND_OR_SETTLE_PACT" && f.settle)).toBe(false);
    expect(verdict.notes.join()).toContain("无法核验");
  });

  it("到达/重逢类履约：promise 含当前地且 NPC 在场", () => {
    const env = envelope({
      varTree: { 角色: {}, 世界: { 契约: { 才旦: { pact_2: { npc: "才旦", promise: "三日内到鱼定村见我", deadlineHours: 72, rewardHint: "", bindTurn: 10 } } } } },
    });
    const verdict = judgeTurn(env, { read: "", refIds: [], actions: [{ kind: "free_act", target: "无", outcome: "无", risk: "无", text: "四下看看" }], proposals: [] }, { rng: seqRng([0.5]) });
    expect(verdict.facts.some((f) => f.op === "BIND_OR_SETTLE_PACT" && f.settle && f.settleKey === "pact_2")).toBe(true);
  });

  it("违约 breachTurn 不签；已 settled 不签", () => {
    const breached = envelope({
      varTree: { 角色: {}, 世界: { 契约: { 才旦: { pact_1: { ...PACTS.才旦.pact_1, breachTurn: 15 } } } } },
    });
    const v1 = judgeTurn(breached, { read: "", refIds: [], actions: [giveAction], proposals: [] }, { rng: seqRng([0.01]) });
    expect(v1.facts.some((f) => f.settle)).toBe(false);
    const done = envelope({
      varTree: { 角色: {}, 世界: { 契约: { 才旦: { pact_1: { ...PACTS.才旦.pact_1, settled: { turn: 12 } } } } } },
    });
    const v2 = judgeTurn(done, { read: "", refIds: [], actions: [giveAction], proposals: [] }, { rng: seqRng([0.01]) });
    expect(v2.facts.some((f) => f.settle)).toBe(false);
  });

  it("无法核验类 promise 不签且 notes 留痕", () => {
    const env = envelope({
      varTree: { 角色: {}, 世界: { 契约: { 才旦: { pact_3: { npc: "才旦", promise: "帮我教训黑风寨的人", deadlineHours: 48, rewardHint: "", bindTurn: 10 } } } } },
    });
    const verdict = judgeTurn(env, { read: "", refIds: [], actions: [{ kind: "talk", target: "才旦", itemId: "", direction: "none", stance: "casual" }], proposals: [] }, { rng: seqRng([0.5]) });
    expect(verdict.facts.some((f) => f.settle)).toBe(false);
    expect(verdict.notes.join()).toContain("无法核验");
  });
});

describe("materializeFacts 履约物化", () => {
  function baseState() {
    return {
      time: 20, inv: [], room: { name: "鱼定村", items: [], npcs: [{ name: "才旦", carriedItems: [{ id: "it_whistle", name: "骨哨", category: "accessory" }] }] },
      char: { hp: [30, 40], money: 10, special: {} }, skills: [], exp: 0, pot: 0,
      dao: {}, flags: [],
      varTree: { 角色: {}, 世界: { 契约: { 才旦: { pact_1: { ...PACTS.才旦.pact_1, rewardHint: "50 两加骨哨" } } }, 威望: 0 } },
      claimedMilestones: new Set(), companionState: {},
    };
  }
  const settleFact = { id: "F_s1", op: "BIND_OR_SETTLE_PACT", npc: "才旦", settle: true, settleKey: "pact_1", note: "履约" };

  it("奖励物化：银两+实物+威望+恩账+settled 标记", () => {
    const out = materializeFacts(baseState(), [settleFact], {});
    expect(out.changes.char.money).toBe(60); // 10+50
    expect(out.changes.inv.some((e) => e.name === "骨哨")).toBe(true);
    const settledPatch = out.patches.find((p) => p.path.join("/") === "varTree/世界/契约/才旦/pact_1/settled");
    expect(settledPatch).toBeTruthy();
    const prestige = out.patches.find((p) => p.path.join("/") === "varTree/世界/威望");
    expect(prestige.value(0)).toBe(5);
    const ledger = out.patches.find((p) => p.path.join("/") === "varTree/角色/才旦/心账");
    const entries = ledger.value([]);
    expect(entries).toHaveLength(1);
    expect(entries[0].tag).toBe("恩");
    expect(entries[0].summary).toContain("践行");
  });

  it("违约后不可履约：settle 整条拒落零奖励", () => {
    const st = baseState();
    st.varTree.世界.契约.才旦.pact_1.breachTurn = 15;
    const out = materializeFacts(st, [settleFact], {});
    expect(out.changes.char?.money ?? 10).toBe(10);
    expect(out.patches.filter((p) => p.path.join("/").includes("settled"))).toHaveLength(0);
    expect(out.patches.filter((p) => p.path.join("/") === "varTree/世界/威望")).toHaveLength(0);
    expect(out.logs.map((l)=>l.text).join(" ")).toContain("违约在先");
  });

  it("重复履约幂等：已 settled 不重发奖励", () => {
    const st = baseState();
    st.varTree.世界.契约.才旦.pact_1.settled = { turn: 12 };
    const out = materializeFacts(st, [settleFact], {});
    expect(out.changes.char?.money ?? 10).toBe(10);
    expect(out.patches.filter((p) => p.path.join("/") === "varTree/世界/威望")).toHaveLength(0);
    expect(out.logs.map((l)=>l.text).join(" ")).toContain("幂等");
  });
});
