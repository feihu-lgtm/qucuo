// 主回合挂外露度：在场 NPC 被扒到「只剩零星饰物 / 衣不蔽体」时，
// buildNpcContext 要把衣着状态写进发给 AI 的上下文（npcLoreBlockWithQuest）。
// 判定复用 attireExposure；甲刃被买空的证据在 npcState 台账 sold 快照。
import { describe, it, expect } from "vitest";
import { buildNpcContext } from "./roundNotes.js";
import { applyNpcTradeDelta, EMPTY_TRADE } from "../../domain/rules/npc/npcTrade.js";

const SWORD = { id: "c1", name: "青锋剑", category: "weapon", quality: "绿", slot: "equipment", sellable: true, price: 80 };
const ROBE = { id: "c2", name: "素布襦装", category: "armor", quality: "白", slot: "equipment", sellable: true, price: 30 };
const BUN = { id: "c3", name: "桂花糕", category: "misc", slot: "bag", sellable: true, price: 5 };

const base = (npcs) => ({
  convo: [], preset: {}, room: { name: "集市", npcs, items: [] },
  visibleNpcs: npcs, cmd: "你好", isTalk: true,
  questProgress: {}, varTree: {}, time: 100, companionState: {}, nsfwOn: false,
});

describe("在场人物衣着状态块", () => {
  it("被扒空的 NPC 进上下文：搭话轮出现衣着状态行", () => {
    // 朵朵襦装已被偷走（stolen 标记还在条目上）。
    const npc = { id: "dd", name: "朵朵", carriedItems: [{ ...ROBE, stolen: true }, BUN] };
    const out = buildNpcContext(base([npc]));
    expect(out.npcLoreBlockWithQuest).toContain("【在场人物衣着状态】");
    expect(out.npcLoreBlockWithQuest).toContain("朵朵：衣不蔽体");
  });

  it("行动轮（isTalk=false）照样挂；未被扒的 NPC 不出现", () => {
    const stripped = { id: "dd", name: "朵朵", carriedItems: [{ ...ROBE, stolen: true }] };
    const intact = { id: "xx", name: "行脚僧", carriedItems: [SWORD] };
    const out = buildNpcContext({ ...base([stripped, intact]), isTalk: false });
    expect(out.npcLoreBlockWithQuest).toContain("朵朵：衣不蔽体");
    expect(out.npcLoreBlockWithQuest).not.toContain("行脚僧：");
    // 全无暴露者时整块不挂
    const clean = buildNpcContext(base([intact]));
    expect(clean.npcLoreBlockWithQuest).not.toContain("衣着状态");
  });

  it("甲刃被买空的普通 NPC：实例无痕迹，台账 sold 快照作证", () => {
    // buyFromNpcCarry 走「剔除」——carriedItems 里只剩糕点，实例上没有任何
    // 曾披甲的痕迹；唯一证据是 npcState.trade.sold 的条目快照。
    const npc = { id: "wk", name: "武师", carriedItems: [BUN] };
    const trade = applyNpcTradeDelta(EMPTY_TRADE, { sold: SWORD });
    const npcState = { wk: { trade } };
    const out = buildNpcContext({ ...base([npc]), npcState });
    expect(out.npcLoreBlockWithQuest).toContain("武师：衣不蔽体");
    // 同 NPC 无台账 → 保守不报（生成即空/本就没装备不叫被扒）
    const noLedger = buildNpcContext(base([npc]));
    expect(noLedger.npcLoreBlockWithQuest).not.toContain("武师：");
  });

  it("台账只记过杂物买卖不算扒：糕点快照不触发", () => {
    const npc = { id: "ps", name: "小贩", carriedItems: [] };
    const npcState = { ps: { trade: applyNpcTradeDelta(EMPTY_TRADE, { sold: BUN }) } };
    const out = buildNpcContext({ ...base([npc]), npcState });
    expect(out.npcLoreBlockWithQuest).not.toContain("衣着状态");
  });
});
