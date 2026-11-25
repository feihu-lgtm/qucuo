import { describe, expect, it } from "vitest";
import { collectDeferredIntents, deferredIntentReceipt, deferredFailureReceipt } from "./deferredIntents.js";

const npcs = [{ name: "铁匠" }, { name: "掌柜" }];
const act = (kind, target, extra = {}) => ({
  kind, target, text: "", condition: "无", ...extra,
});

describe("WO-16F-F2c collectDeferredIntents", () => {
  it("在场目标正常收集，输出去重留首条", () => {
    const { intents, failures } = collectDeferredIntents([
      act("duel", "铁匠"), act("duel", "铁匠"), act("trade", "掌柜"),
    ], { npcs });
    expect(intents).toHaveLength(2);
    expect(intents[0]).toMatchObject({ kind: "duel", target: "铁匠" });
    expect(intents[1]).toMatchObject({ kind: "trade", target: "掌柜" });
    expect(failures).toHaveLength(0);
  });

  it("目标不在场/为「无」写失败原因，不进 intents", () => {
    const { intents, failures } = collectDeferredIntents([
      act("duel", "路人甲"), act("trade", "无"),
    ], { npcs });
    expect(intents).toHaveLength(0);
    expect(failures).toHaveLength(2);
    expect(failures[0].reason).toContain("不在场");
  });

  it("condition≠无 不收集（前提未裁）", () => {
    const { intents } = collectDeferredIntents([
      act("duel", "铁匠", { condition: "遇敌" }),
    ], { npcs });
    expect(intents).toHaveLength(0);
  });

  it("talkOnly（isTalk）一律不收集", () => {
    const { intents, failures } = collectDeferredIntents([
      act("duel", "铁匠"), act("trade", "掌柜"),
    ], { npcs, isTalk: true });
    expect(intents).toHaveLength(0);
    expect(failures).toHaveLength(0);
  });

  it("非 deferred kind（equip/give 等）不碰", () => {
    const { intents } = collectDeferredIntents([
      act("equip", "无"), act("give", "铁匠"),
    ], { npcs });
    expect(intents).toHaveLength(0);
  });
});

describe("WO-16F-F2c 回执文案意向口径", () => {
  it("duel 回执只许邀战不许写胜负", () => {
    const text = deferredIntentReceipt({ kind: "duel", target: "铁匠" });
    expect(text).toContain("邀战");
    expect(text).toContain("不得写已开打或胜负");
    expect(text).not.toContain("战胜");
  });
  it("trade 回执只许问价不许写成交", () => {
    const text = deferredIntentReceipt({ kind: "trade", target: "掌柜" });
    expect(text).toContain("问价");
    expect(text).toContain("不得写已成交");
  });
  it("失败回执写未能如愿", () => {
    const text = deferredFailureReceipt({ kind: "duel", target: "路人", reason: "路人不在场" });
    expect(text).toContain("未能如愿");
    expect(text).toContain("不得写成已发起");
  });
});
