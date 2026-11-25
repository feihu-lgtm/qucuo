import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSession } from "./runner.mjs";
import { gameActions } from "../src/store/gameStore.js";
import { createMockAi } from "../src/engine/ports/ai.js";

let tempDir;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "qucuo-cli-anger-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("CLI angry NPC appeasement", () => {
  it("routes a failed steal into an AI-judged trade appeasement without opening a shop", async () => {
    const output = [];
    const prompts = [];
    let aiCalls = 0;
    const ai = createMockAi([
      `{"output":["他沉默片刻，怒意渐渐平息。"]}
<mvu>_.set('角色.杂货商人.生气解除', true);
_.add('角色.杂货商人.好感度', 3);</mvu>`,
    ], { onRequest: (messages) => {
      aiCalls += 1;
      prompts.push(messages.map((message) => message.content || "").join("\n"));
    } });
    const session = createSession({
      out: (text) => output.push(text), cwd: tempDir, ai,
      // 本用例走 mvu 生气解除老路（软结算关，行动识别关），mock 回复按顺序供主叙事。
      apiCfg: { intentRecognitionEnabled: false, extractionEnabled: false },
    });

    await session.runLine(":new");
    await session.runLine(':set room.name="怒气试炼场"');
    await session.runLine(':set room.npcs=[{"id":"merchant","name":"杂货商人","brief":"商人","innerRoom":"村口","levelCap":1,"special":{"身法":1,"气运":5},"moveset":[],"carriedItems":[{"id":"knife","name":"小刀","category":"weapon","quality":"白","stolen":false}],"combatStats":{"hp":[100,100]}}]');
    const currentTree = session.store.getState().varTree;
    gameActions.setVarTreeState({
      ...currentTree,
      角色: { ...currentTree.角色, 杂货商人: { 好感度: 0 } },
    });
    await session.runLine(":seed 1");
    await session.runLine("偷 杂货商人");

    expect(output.join("\n")).not.toContain("此处没有 杂货商人");
    expect(session.store.getState().varTree.角色.杂货商人.生气状态.active).toBe(true);
    expect(session.store.getState().varTree.角色.杂货商人.生气状态.attempts)
      .toEqual([]);

    await session.runLine("交易 杂货商人");

    expect(session.store.getState().varTree.角色.杂货商人.生气状态.active).toBe(false);
    expect(session.store.getState().varTree.角色.杂货商人.生气状态.resolvedBy).toBe("persuasion");
    expect(aiCalls).toBe(1);
    expect(prompts.join("\n")).not.toContain("此前已尝试：偷窃");
    expect(output.join("\n")).not.toContain("已开张");
  });
});
