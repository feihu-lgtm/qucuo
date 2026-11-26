// W-FIX3：流式首包看门狗回归测试——上游中转假死（headers 到 body 不出）18 秒内
// abort 抛可重试超时错切重试，不再傻等整包 60 秒×2（验收第 18 式卡 138 秒）。
import { describe, it, expect, vi } from "vitest";
import { readSSE } from "./apiSse.js";

// 构造可控 reader：chunks 数组每项 {delay, data}，delay=null 表示永不返回
function fakeRes(script) {
  let idx = 0;
  return {
    body: {
      getReader: () => ({
        read: () => {
          const step = script[Math.min(idx++, script.length - 1)];
          if (step.delay == null) return new Promise(() => {});
          return new Promise((resolve) => setTimeout(() => resolve(step.end ? { done: true } : { done: false, value: new TextEncoder().encode(step.data || "") }), step.delay));
        },
        cancel: () => Promise.resolve(),
      }),
    },
  };
}

describe("readSSE 首包看门狗", () => {
  it("首包 18s 未到即抛可重试 timeout 错（不等整包 60s）", async () => {
    const res = fakeRes([{ delay: null }]); // body 永远不出字
    const t0 = Date.now();
    await expect(readSSE(res, () => {}, { idleTimeoutMs: 60000, firstByteTimeoutMs: 30 })).rejects.toMatchObject({ code: "timeout" });
    expect(Date.now() - t0).toBeLessThan(1000); // 远早于 idleTimeoutMs
  });
  it("首包超时错误消息明示中转假死", async () => {
    const res = fakeRes([{ delay: null }]);
    await expect(readSSE(res, () => {}, { idleTimeoutMs: 60000, firstByteTimeoutMs: 30 })).rejects.toThrow(/首包/);
  });
  it("首包及时到达后后续 chunk 走 idle 超时不被首包闸误杀", async () => {
    vi.useRealTimers();
    const events = [];
    // 首包 10ms 到，第二包 40ms 到（超过 firstByte 30ms 但小于 idle 100ms）
    const res = fakeRes([
      { delay: 10, data: 'data: {"a":1}\n' },
      { delay: 40, data: 'data: {"b":2}\n' },
      { delay: 5, end: true },
    ]);
    await readSSE(res, (e) => events.push(e), { idleTimeoutMs: 100, firstByteTimeoutMs: 30 });
    expect(events).toEqual([{ a: 1 }, { b: 2 }]);
  });
  it("首包到后 body 卡住仍按 idleTimeoutMs 超时", async () => {
    const res = fakeRes([
      { delay: 5, data: 'data: {"a":1}\n' },
      { delay: null },
    ]);
    await expect(readSSE(res, () => {}, { idleTimeoutMs: 40, firstByteTimeoutMs: 5000 })).rejects.toMatchObject({ code: "timeout" });
  });
  it("未配 firstByteTimeoutMs 行为不变（向后兼容）", async () => {
    const events = [];
    const res = fakeRes([
      { delay: 5, data: 'data: {"x":1}\n' },
      { delay: 5, end: true },
    ]);
    await readSSE(res, (e) => events.push(e), { idleTimeoutMs: 100 });
    expect(events).toEqual([{ x: 1 }]);
  });
});
