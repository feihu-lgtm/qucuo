import { describe, expect, it, vi } from "vitest";
import { createMockAi } from "../../../engine/ports/ai.js";
import { buildPrompt } from "../prompt/buildPrompt.js";
import {
  parseBookkeep,
  bookkeepToPatches,
  registerBookkeepCalls,
} from "./bookkeep.js";
import { runBookkeep } from "../../../engine/ports/bookkeep.js";
import { getLedger } from "./npcLedger.js";
import { applyPatches } from "../state/applyPatches.js";

const PRESENT = ["才旦", "八云"];

describe("parseBookkeep 解析", () => {
  it("正常 JSON：只在场人物的账（旧版 memory 字段静默忽略）", () => {
    const text = '前言 {"memory":"少侠在鱼定村替才旦寻回猎刀。","ledger":{"才旦":["少侠替才旦寻回猎刀"],"八云":["少侠向八云赔罪"]}} 后记';
    expect(parseBookkeep(text, PRESENT)).toEqual({
      ledger: { 才旦: ["少侠替才旦寻回猎刀"], 八云: ["少侠向八云赔罪"] },
    });
  });

  it("不在场的人名被丢掉", () => {
    const text = '{"ledger":{"路人甲":["这事"],"才旦":["少侠帮了才旦"]}}';
    expect(parseBookkeep(text, PRESENT).ledger).toEqual({ 才旦: ["少侠帮了才旦"] });
  });

  it("每人只收第一句新账，超长截 40 字", () => {
    const long = "账".repeat(60);
    const text = JSON.stringify({
      ledger: { 才旦: [long, "第二句不收"] },
    });
    expect(parseBookkeep(text, PRESENT).ledger.才旦).toEqual([long.slice(0, 40)]);
  });

  it("截断的 ledger 数组：收里面完整的句子", () => {
    const text = '{"ledger":{"才旦":["少侠帮了才旦","半句';
    const r = parseBookkeep(text, PRESENT);
    expect(r.ledger.才旦).toEqual(["少侠帮了才旦"]);
  });

  it("垃圾输入返回空账，不抛错", () => {
    for (const bad of ["", null, undefined, 42, "恭喜发财", "{}", '{"ledger":"x"}', '{"ledger":{"才旦":[123]}}']) {
      const r = parseBookkeep(bad, PRESENT);
      expect(r).toEqual({ ledger: {} });
    }
  });
});

describe("runBookkeep 记账调用", () => {
  const ctx = {
    narration: "少侠把猎刀还给才旦，才旦连连作揖。",
    settleSummary: "才旦好感度 +5",
    presentNames: PRESENT,
    ledgers: { 才旦: ["少侠曾向才旦问路"] },
    turn: 12,
  };

  it("正常返回解析后的账", async () => {
    const ai = createMockAi(['{"ledger":{"才旦":["少侠归还了才旦的猎刀"],"旁人":["丢掉"]}}']);
    const r = await runBookkeep({ ai, apiCfg: {}, ctx });
    expect(r).toEqual({
      ledger: { 才旦: ["少侠归还了才旦的猎刀"] },
    });
  });

  it("AI 缺席/关闭/失败都返回空账", async () => {
    expect(await runBookkeep({ ai: null, apiCfg: {}, ctx })).toEqual({ ledger: {} });
    expect(await runBookkeep({ ai: createMockAi([""]), apiCfg: { offline: true }, ctx }))
      .toEqual({ ledger: {} });
    const throwing = { chat: vi.fn(async () => { throw new Error("网络断了"); }) };
    expect(await runBookkeep({ ai: throwing, apiCfg: {}, ctx })).toEqual({ ledger: {} });
  });
});

describe("bookkeepToPatches 落账", () => {
  it("把各人新账写进 varTree 旧账，memory 不落库", () => {
    const tree = { 角色: { 才旦: { 好感度: 30 } } };
    const result = { memory: "少侠归还了猎刀。", ledger: { 才旦: ["少侠归还了才旦的猎刀"], 八云: ["少侠向八云赔罪"] } };
    const next = applyPatches({ varTree: tree }, bookkeepToPatches(tree, result, 12)).state.varTree;
    expect(getLedger(next, "才旦").lines).toEqual(["少侠归还了才旦的猎刀"]);
    expect(getLedger(next, "八云").lines).toEqual(["少侠向八云赔罪"]);
    expect(next.角色.才旦.好感度).toBe(30);
    expect(next.角色.才旦.旧账.memory).toBeUndefined();
    expect(tree.角色.才旦.旧账).toBeUndefined();
  });

  it("空账不动树", () => {
    const tree = { 角色: {} };
    expect(applyPatches({ varTree: tree }, bookkeepToPatches(tree, { memory: "事", ledger: {} }, 1)).state.varTree).toBe(tree);
    expect(applyPatches({ varTree: tree }, bookkeepToPatches(tree, null, 1)).state.varTree).toBe(tree);
  });
});

describe("bookkeep.turn 提示词快照", () => {
  it("拼装出的 system/user 与登记卡片一致", () => {
    registerBookkeepCalls();
    const built = buildPrompt("bookkeep.turn", {
      narration: "少侠把猎刀还给才旦，才旦连连作揖。",
      settleSummary: "才旦好感度 +5",
      presentNames: ["才旦", "八云"],
      ledgers: { 才旦: ["少侠曾向才旦问路"], 八云: [] },
      turn: 12,
    });
    expect(JSON.stringify({ system: built.system, messages: built.messages, maxTokens: built.maxTokens }))
      .toMatchSnapshot();
  });
});
