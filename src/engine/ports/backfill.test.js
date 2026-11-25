import { describe, expect, it, vi } from "vitest";
import { backfillInBackground, newBackfillKey, streamWithFirstTokenFallback } from "./backfill.js";
import { tagBackfill } from "../../domain/rules/log/backfill.js";

describe("backfillInBackground", () => {
  const run = (overrides) => {
    let log = tagBackfill([{ t: "sys", text: "  事实" }], "k");
    const setLog = vi.fn((fn) => { log = fn(log); });
    const opts = { ask: async () => "描写", parse: (text) => [text], setLog, ...overrides };
    return backfillInBackground("k", opts).then((ok) => ({ ok, log, setLog }));
  };

  it("inserts the parsed lines", async () => {
    const { ok, log } = await run();
    expect(ok).toBe(true);
    expect(log.map((entry) => entry.text.trim())).toEqual(["事实", "描写"]);
  });

  it("does nothing without an API, on failure, or on unparsable text", async () => {
    for (const overrides of [
      { canAsk: () => false },
      { ask: async () => null },
      { ask: async () => { throw new Error("boom"); } },
      { parse: () => null },
    ]) {
      const { ok, setLog } = await run(overrides);
      expect(ok).toBe(false);
      expect(setLog).not.toHaveBeenCalled();
    }
  });

  it("waits for a streaming entry to finish before inserting", async () => {
    let log = [...tagBackfill([{ t: "sys", text: "  事实" }], "k"), { t: "desc", text: "  ▌", streaming: true }];
    let calls = 0;
    const setLog = (fn) => {
      if (++calls === 2) log = log.map((entry) => ({ ...entry, streaming: false }));
      log = fn(log);
    };
    const ok = await backfillInBackground("k", { ask: async () => "描写", parse: (text) => [text], setLog, retryMs: 0 });
    expect(ok).toBe(true);
    expect(calls).toBe(2);
    expect(log.map((entry) => entry.text.trim())).toEqual(["事实", "描写", "▌"]);
  });

  it("gives up, keeping only the facts, if the stream outlasts the retries", async () => {
    let log = [...tagBackfill([{ t: "sys", text: "  事实" }], "k"), { t: "desc", text: "  ▌", streaming: true }];
    const setLog = vi.fn((fn) => { log = fn(log); });
    const ok = await backfillInBackground("k", { ask: async () => "描写", parse: (text) => [text], setLog, retryMs: 0, maxTries: 3 });
    expect(ok).toBe(false);
    expect(setLog).toHaveBeenCalledTimes(3);
    expect(log.map((entry) => entry.text.trim())).toEqual(["事实", "▌"]);
  });

  it("ignores stale streaming rows before the fact lines", async () => {
    let log = [{ t: "desc", text: "  ▌", streaming: true }, ...tagBackfill([{ t: "sys", text: "  事实" }], "k")];
    const setLog = vi.fn((fn) => { log = fn(log); });
    const ok = await backfillInBackground("k", { ask: async () => "描写", parse: (text) => [text], setLog, retryMs: 0 });
    expect(ok).toBe(true);
    expect(setLog).toHaveBeenCalledTimes(1);
    expect(log.map((entry) => entry.text.trim())).toEqual(["▌", "事实", "描写"]);
  });

  it("makes distinct keys", () => {
    expect(newBackfillKey("duel")).toMatch(/^duel-/);
    expect(newBackfillKey()).not.toBe(newBackfillKey());
  });

  it("discards late backfill results when isStale turns true after ask resolves", async () => {
    let stale = false;
    const { ok, log, setLog } = await run({
      ask: async () => {
        stale = true;
        return "迟来的描写";
      },
      isStale: () => stale,
    });
    expect(ok).toBe(false);
    expect(setLog).not.toHaveBeenCalled();
    expect(log.map((entry) => entry.text.trim())).toEqual(["事实"]);
  });
});

describe("streamWithFirstTokenFallback（WO-08 三态）", () => {
  const harness = () => {
    let log = [{ t: "sys", text: "  前文" }];
    const setLog = (fn) => { log = fn(log); };
    return { getLog: () => log, setLog };
  };
  const tick = (ms) => new Promise((r) => setTimeout(r, ms));

  it("快响应：预算内首字到达，不插过渡行，直接流式上屏并转永久", async () => {
    const { getLog, setLog } = harness();
    const res = await streamWithFirstTokenFallback({
      invoke: async (onChunk) => {
        onChunk("你", "你");
        onChunk("好", "你好");
        return { text: "你好。", finishReason: "stop" };
      },
      setLog,
      key: "k1",
      fallback: { kind: "交谈", npc: { name: "才旦" } },
      firstTokenBudgetMs: 50,
    });
    expect(res.ok).toBe(true);
    expect(res.fallbackUsed).toBe(false);
    const last = getLog().at(-1);
    expect(last.text).toBe("  你好。");
    expect(last.streaming).toBe(false);
    expect(last.streamed).toBe(true);
    expect(last.timeoutFallback).toBeUndefined();
  });

  it("插入→原位替换：首字超时先插过渡行，首字抵达后同位置替换", async () => {
    const { getLog, setLog } = harness();
    const res = await streamWithFirstTokenFallback({
      invoke: async (onChunk) => {
        await tick(30); // 超过 10ms 预算 → 过渡行先上屏
        onChunk("风雪", "风雪");
        await tick(1);
        onChunk("风雪夜归人", "风雪夜归人");
        return { text: "风雪夜归人。", finishReason: "stop" };
      },
      setLog,
      key: "k2",
      fallbackLine: "才旦抬眼看你，似在等你把话说完。",
      firstTokenBudgetMs: 10,
    });
    expect(res.ok).toBe(true);
    expect(res.fallbackUsed).toBe(true);
    expect(res.degraded).toBe(false);
    const rows = getLog();
    // 过渡行已被原位替换：日志只有前文+最终行，位置仍在末尾同一行位
    expect(rows).toHaveLength(2);
    expect(rows[1].text).toBe("  风雪夜归人。");
    expect(rows[1].fillKey).toBe("k2");
    expect(rows[1].timeoutFallback).toBeUndefined();
  });

  it("降级：整次请求报错且从未见首字，过渡行原样保留", async () => {
    const { getLog, setLog } = harness();
    const res = await streamWithFirstTokenFallback({
      invoke: async () => {
        await tick(30);
        throw new Error("timeout");
      },
      setLog,
      key: "k3",
      fallbackLine: "风雪掠过檐角，四下里静了一瞬。",
      firstTokenBudgetMs: 10,
    });
    expect(res.ok).toBe(false);
    expect(res.degraded).toBe(true);
    const last = getLog().at(-1);
    expect(last.text).toBe("  风雪掠过檐角，四下里静了一瞬。");
    expect(last.timeoutFallback).toBe(true);
  });

  it("降级但已见首字：流式部分内容保留，不硬掰回过渡行", async () => {
    const { getLog, setLog } = harness();
    const res = await streamWithFirstTokenFallback({
      invoke: async (onChunk) => {
        onChunk("半截话", "半截话");
        throw new Error("boom");
      },
      setLog,
      key: "k4",
      fallbackLine: "过渡句",
      firstTokenBudgetMs: 10,
    });
    expect(res.ok).toBe(false);
    expect(res.fallbackUsed).toBe(false);
    const partial = getLog().at(-1);
    expect(partial.text).toContain("半截话");
    // Review 修复：请求已终结，streaming 旗与光标必须摘掉
    expect(partial.streaming).toBe(false);
    expect(partial.text).not.toContain("▌");
    expect(partial.interrupted).toBe(true);
  });

  it("isStale 期间回滚：不再写日志", async () => {
    const { getLog, setLog } = harness();
    let stale = false;
    const res = await streamWithFirstTokenFallback({
      invoke: async (onChunk) => {
        stale = true;
        onChunk("字", "字");
        return { text: "字。", finishReason: "stop" };
      },
      setLog,
      isStale: () => stale,
      key: "k5",
      fallbackLine: "过渡句",
      firstTokenBudgetMs: 10,
    });
    expect(res.ok).toBe(true);
    expect(getLog()).toHaveLength(1); // 只有前文
  });

  it("空响应且从未见首字：过渡行静默降级保留", async () => {
    const { getLog, setLog } = harness();
    const res = await streamWithFirstTokenFallback({
      invoke: async () => {
        await tick(30);
        return { text: "", finishReason: "stop" };
      },
      setLog,
      key: "k6",
      fallback: { kind: "交易", npc: { name: "老孙" } },
      firstTokenBudgetMs: 10,
    });
    expect(res.ok).toBe(true);
    expect(res.degraded).toBe(true);
    expect(getLog().at(-1).text).toContain("算盘");
  });
});
