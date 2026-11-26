import { beforeEach, describe, expect, it } from "vitest";
import { observeAi } from "./observeAi.js";
import { turnMonitor } from "./turnMonitor.js";

beforeEach(() => turnMonitor.clear());

function warningNodes() {
  return turnMonitor.getTrees().flatMap((tree) => tree.nodes).filter((node) => node.kind === "ai-warning");
}

async function runObserved({ reasoningTokens, disableThinking = true }) {
  const turn = turnMonitor.start("测试");
  const usage = { completion_tokens_details: { reasoning_tokens: reasoningTokens } };
  await observeAi(
    [{ role: "user", content: "hi" }],
    { cfg: { model: "gemini-3.8-flash" }, modelOptions: { disableThinking } },
    async () => ({ text: "ok", usage, finishReason: "stop", raw: { id: "call-abc" } }),
  );
  turnMonitor.finish(turn);
}

describe("A1 短调用思考档警告进全流程日志", () => {
  it("disableThinking 短调用 reasoning_tokens 超 200 时记 ai-warning，含模型与调用 id", async () => {
    await runObserved({ reasoningTokens: 300 });
    const nodes = warningNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].label).toContain("reasoning_tokens=300");
    expect(nodes[0]).toMatchObject({ status: "warn", model: "gemini-3.8-flash", callId: "call-abc", reasoningTokens: 300 });
    expect(nodes[0].label).not.toContain("hi");
  });

  it("reasoning_tokens 不超 200 时不记警告", async () => {
    await runObserved({ reasoningTokens: 150 });
    expect(warningNodes()).toHaveLength(0);
  });

  it("非 disableThinking 调用不记警告", async () => {
    await runObserved({ reasoningTokens: 500, disableThinking: false });
    expect(warningNodes()).toHaveLength(0);
  });
});
