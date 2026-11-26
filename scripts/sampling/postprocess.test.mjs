import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { postprocess } from "./postprocess.mjs";
import { scanDir } from "./scanPack.mjs";

const dir = mkdtempSync(join(tmpdir(), "a4post-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function writeFixtures() {
  // 两个回合：turn1 一次 intake + 一次判官叙事（含 SEAL）；turn2 群聊叙事无 SEAL
  const turns = [
    { turn: 1, trace: "fullhp-single-l0-t1", cmd: "跟老猎户搭话", turnBefore: 1, turnAfter: 2, newLog: ["x"] },
    { turn: 2, trace: "fullhp-single-l0-t2", cmd: "招呼大伙聊聊", turnBefore: 2, turnAfter: 2, newLog: ["y"] },
  ];
  writeFileSync(join(dir, "fullhp_single_lane0_turns.jsonl"), turns.map((t) => JSON.stringify(t)).join("\n") + "\n");
  const intakeResp = {
    id: "c1", trace: "fullhp-single-l0-t1", ms: 2000, status: 200,
    request: { messages: [{ role: "system", content: "你是《天都·曲措》的前哨听意员" }] },
    response: { choices: [{ message: { content: JSON.stringify({ read: "x", actions: [{ kind: "talk", text: "跟老猎户搭话" }] }) } }] },
    usage: { prompt_tokens: 100, completion_tokens: 50, completion_tokens_details: { reasoning_tokens: 0 } },
  };
  const narrativeResp = {
    id: "c2", trace: "fullhp-single-l0-t1", ms: 14000, status: 200, stream: true,
    request: { messages: [{ role: "system", content: "叙事" }] },
    sseRaw: 'data: {"choices":[{"delta":{"content":"正文一段\\n---SEAL---\\n{\\"ok\\":1}"}}]}\ndata: [DONE]\ndata: {"usage":{"prompt_tokens":900,"completion_tokens":300,"completion_tokens_details":{"reasoning_tokens":200}}}\n',
  };
  const groupResp = {
    id: "c3", trace: "fullhp-single-l0-t2", ms: 12000, status: 200, stream: true,
    request: { messages: [{ role: "system", content: "群聊叙事多人" }] },
    sseRaw: 'data: {"choices":[{"delta":{"content":"众人七嘴八舌。"}}]}\ndata: [DONE]\n',
  };
  writeFileSync(join(dir, "ai_calls.jsonl"), [intakeResp, narrativeResp, groupResp].map((c) => JSON.stringify(c)).join("\n") + "\n");
}
writeFixtures();

describe("A4 后处理：头归属 + 尾章两线 + 配额核对", () => {
  it("按 trace 头归属， intake 合格率/尾章统计正确", () => {
    const r = postprocess(dir);
    const g = r.groups["fullhp_single"];
    expect(g.turns).toBe(2);
    expect(g.turnsWithCalls).toBe(2);
    expect(g.attributedCalls).toBe(3);
    expect(g.intake.calls).toBe(1);
    expect(g.intake.passRate).toBe(1);
    expect(g.seal.judge.total).toBe(1);
    expect(g.seal.judge.hasSeal).toBe(1);
    expect(g.seal.judge.parseRate).toBe(1);
    expect(g.seal.group.total).toBe(1);
    expect(g.seal.group.hasSeal).toBe(0);
    expect(g.usage.reasoning).toBe(200);
    expect(g.latencyMsMedian.intake).toBe(2000);
    expect(g.kindsDistribution.talk).toBe(1);
    // 样本太少，配额缺口如实列出
    expect(g.quotaGaps.length).toBeGreaterThan(0);
    expect(g.quotaGaps.some((x) => x.startsWith("kind:trade"))).toBe(true);
  });

  it("密钥扫描：干净目录通过、藏 key 必命中", () => {
    expect(scanDir(dir)).toEqual([]);
    writeFileSync(join(dir, "evil.txt"), "token = \"sk-abcdefghijklmnop123456\"");
    const hits = scanDir(dir);
    expect(hits.length).toBeGreaterThan(0);
    rmSync(join(dir, "evil.txt"));
  });
});
