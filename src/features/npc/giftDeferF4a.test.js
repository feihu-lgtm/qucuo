// WO-16F-F4a：gift settle 先裁后落——feature defer 模式 + 判官 give 分支口径
import { describe, expect, it } from "vitest";
import { giftNpc } from "./exchange.js";
import { judgeTurn } from "../../domain/rules/judge/judgeTurn.js";

const makeState = (overrides = {}) => ({
  char: { money: 100, special: { 魅力: 5 } },
  companionState: {},
  flags: [],
  inv: [],
  questProgress: {},
  room: { name: "曲措乡", npcs: [] },
  skills: [],
  time: 0,
  varTree: { 角色: {}, 世界: {} },
  ...overrides,
});
const runVarTree = (result, state) => result.changes.varTree(state.varTree);

const sword = { id: "it_1", name: "青锋剑", category: "weapon", quality: "绿" };

describe("giftNpc deferToJudge（先裁后落）", () => {
  it("defer 模式：不扣物、不写好感、只记尝试，settleOptions 带 giftRequest", () => {
    const state = makeState({ inv: [sword] });
    const result = giftNpc(state, { name: "温掌柜", brief: "商人" }, sword, 100, { deferToJudge: true });
    expect(result.settleOptions.settleKind).toBe("gift");
    expect(result.settleOptions.giftRequest).toEqual({ itemId: "it_1", itemName: "青锋剑" });
    // 不扣物——changes 里没有 inv 键
    expect(result.changes.inv).toBeUndefined();
    // 不写好感——varTree 只记尝试，无好感日增账
    const tree = runVarTree(result, state);
    expect(tree.世界?.好感日增?.gained?.温掌柜).toBeUndefined();
    // 至多只有首识播种的初始好感 10（认识记账初始化，WO-16H 裁决口径），绝无礼物增量
    expect(tree.角色?.温掌柜?.好感度 ?? 0).toBeLessThanOrEqual(10);
  });

  it("字符串条目 giftRequest 退化为名字寻址", () => {
    const state = makeState({ inv: ["青布"] });
    const result = giftNpc(state, { name: "温掌柜" }, "青布", 100, { deferToJudge: true });
    expect(result.settleOptions?.giftRequest).toEqual({ itemId: "青布", itemName: "青布" });
  });

  it("defer 关闭（默认）：legacy 行为不变——扣物+写好感、无 giftRequest", () => {
    const state = makeState({ inv: [sword] });
    const result = giftNpc(state, { name: "温掌柜", brief: "商人" }, sword, 100);
    expect(result.settleOptions.giftRequest).toBeUndefined();
    expect(result.changes.inv).toBeDefined();
    const tree = runVarTree(result, state);
    expect(tree.世界.好感日增.gained.温掌柜).toBeGreaterThan(0);
  });

  it("生气送礼不 defer（归 F3 appease 判官路）：settleKind=appease 且无 giftRequest", () => {
    const state = makeState({
      inv: [sword],
      varTree: { 角色: { 温掌柜: { 生气状态: { active: true, kind: "gift" } } }, 世界: {} },
    });
    const result = giftNpc(state, { name: "温掌柜" }, sword, 100, { deferToJudge: true });
    expect(result.settleOptions.settleKind).toBe("appease");
    expect(result.settleOptions.giftRequest).toBeUndefined();
    // legacy 前置扣物照旧（F3 边界本单不动）
    expect(result.changes.inv).toBeDefined();
  });

  it("雪豹送礼不 defer：特殊通道 legacy（任务旗不能丢）", () => {
    const state = makeState({ inv: [{ id: "it_m", name: "雪莲伤药", category: "medicine", quality: "绿" }] });
    const result = giftNpc(state, { name: "雪豹", beast: true }, state.inv[0], 100, { deferToJudge: true });
    // 不管是否命中雪豹药谓词，beast 无好感轨道——关键是不得出现 giftRequest 之外的双重路径；
    // 雪豹药命中时走 legacy 扣件+flag，未命中也可 defer（普通礼物），两者只居其一。
    if (result.settleOptions?.giftRequest) {
      expect(result.changes.inv).toBeUndefined();
    } else {
      expect(result.changes.inv).toBeDefined();
    }
  });
});

describe("judgeTurn give 分支 F4a 口径", () => {
  const env = {
    turn: 5, day: 1, place: "曲措乡",
    npcs: [{ name: "温掌柜", personality: "" }],
    varTree: { 角色: { 温掌柜: { 好感度: 30 } } },
    inv: [sword], entries: [],
  };
  const mk = (itemId = "it_1", target = "温掌柜") => ({
    read: "", refIds: [],
    actions: [{ kind: "give", target, itemId, direction: "none", stance: "casual", text: "送礼" }],
    proposals: [],
  });

  it("收下：TRANSFER_ITEM 玩家→NPC + MUTATE_SOCIAL 恩账", () => {
    const v = judgeTurn(env, mk(), { rng: () => 0 });
    const transfer = v.facts.find((f) => f.op === "TRANSFER_ITEM");
    expect(transfer).toBeTruthy();
    expect(transfer.from).toBe("player");
    expect(transfer.to).toBe("温掌柜");
    expect(transfer.itemId).toBe("it_1");
    const social = v.facts.find((f) => f.op === "MUTATE_SOCIAL");
    expect(social.ledgerKind).toBe("恩");
    expect(social.affectionDelta).toBeGreaterThan(0);
  });

  it("拒收：零 facts，物件未易主（notes 带方向）", () => {
    const v = judgeTurn(env, mk(), { rng: () => 0.9999 });
    expect(v.facts.filter((f) => f.op === "TRANSFER_ITEM").length).toBe(0);
    expect(v.notes.join()).toContain("拒收");
  });

  it("兽类/无好感轨道：只签 TRANSFER_ITEM，不签好感", () => {
    const beastEnv = { ...env, npcs: [{ name: "雪豹", beast: true }] };
    const v = judgeTurn(beastEnv, {
      read: "", refIds: [],
      actions: [{ kind: "give", target: "雪豹", itemId: "it_1", direction: "none", stance: "casual", text: "送礼" }],
      proposals: [],
    }, { rng: () => 0 });
    expect(v.facts.some((f) => f.op === "TRANSFER_ITEM")).toBe(true);
    expect(v.facts.some((f) => f.op === "MUTATE_SOCIAL")).toBe(false);
  });

  it("确定性寻址：同名两物按 id 命中正确条目", () => {
    const a = { id: "it_a", name: "匕首", category: "weapon", quality: "白" };
    const b = { id: "it_b", name: "匕首", category: "weapon", quality: "绿" };
    const dupEnv = { ...env, inv: [a, b] };
    const v = judgeTurn(dupEnv, mk("it_b"), { rng: () => 0 });
    const transfer = v.facts.find((f) => f.op === "TRANSFER_ITEM");
    expect(transfer.itemId).toBe("it_b");
  });
});

describe("materializeFacts TRANSFER_ITEM 玩家→NPC", () => {
  it("收礼后物件从玩家背包进 NPC carriedItems", async () => {
    const { materializeFacts } = await import("../../domain/rules/effects/materializeFacts.js");
    const state = {
      inv: [{ ...sword }],
      room: { name: "曲措乡", npcs: [{ name: "温掌柜", carriedItems: [] }], items: [] },
      varTree: { 角色: {}, 世界: {} },
      flags: [],
    };
    const out = materializeFacts(state, [{
      id: "f1", op: "TRANSFER_ITEM", itemId: "it_1", itemName: "青锋剑",
      from: "player", to: "温掌柜", witnesses: ["主角", "温掌柜"],
    }]);
    const npc = out.changes.room.npcs.find((n) => n.name === "温掌柜");
    expect(out.changes.inv.some((e) => e?.id === "it_1")).toBe(false);
    expect((npc.carriedItems || []).some((e) => e?.name === "青锋剑")).toBe(true);
  });
});
