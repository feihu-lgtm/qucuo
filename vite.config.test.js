import { describe, expect, it, vi, afterEach } from "vitest";
import config from "./vite.config.js";

// cors-proxy 中间件单测：重点是流式转发途中上游断流时不能再 writeHead（会抛
// ERR_HTTP_HEADERS_SENT 打崩 dev server），必须销毁响应让浏览器读到连接中断。

function getProxyHandler() {
  const plugin = config.plugins.find((p) => p.name === "cors-proxy");
  let handler;
  plugin.configureServer({ middlewares: { use: (_path, fn) => { handler = fn; } } });
  return handler;
}

function mockReq(body = "") {
  const listeners = {};
  return {
    method: "POST",
    url: "/api/proxy?url=" + encodeURIComponent("https://api.example.com/v1/stream"),
    headers: { host: "localhost:5171", "content-type": "application/json" },
    on(evt, fn) { listeners[evt] = fn; },
    emit() {
      if (body) listeners.data?.(body);
      listeners.end?.();
    },
  };
}

function mockRes() {
  const listeners = {};
  return {
    headersSent: false,
    writableFinished: false,
    writes: [],
    writeHead(status) {
      if (this.headersSent) throw new Error("ERR_HTTP_HEADERS_SENT");
      this.headersSent = true;
      this.status = status;
    },
    write(chunk) { this.writes.push(chunk); },
    end() { this.ended = true; this.writableFinished = true; },
    destroy(e) { this.destroyed = e; this.emitClose(); },
    on(evt, fn) { (listeners[evt] ||= []).push(fn); },
    off(evt, fn) { listeners[evt] = (listeners[evt] || []).filter((f) => f !== fn); },
    emitClose() { (listeners.close || []).forEach((f) => f()); },
    listenerCount(evt) { return (listeners[evt] || []).length; },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("cors-proxy 中间件", () => {
  it("headers 已发后 body iteration 抛错 → destroy 响应而非二次 writeHead", async () => {
    vi.stubGlobal("fetch", async () => ({
      status: 200,
      headers: new Map([["content-type", "text/event-stream"]]),
      body: (async function* () {
        yield new TextEncoder().encode("data: {}\n\n");
        throw new Error("upstream reset");
      })(),
    }));
    const handler = getProxyHandler();
    const req = mockReq("{}");
    const res = mockRes();
    const done = handler(req, res);
    req.emit();
    await done; // 不抛 ERR_HTTP_HEADERS_SENT
    expect(res.status).toBe(200); // headers 已正常发出
    expect(res.destroyed).toBeInstanceOf(Error); // 响应被销毁
    expect(res.ended).toBeUndefined(); // 没有干净 end 半截正文
  });

  it("上游在 headers 前失败 → 仍能写 502", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("connect refused"); });
    const handler = getProxyHandler();
    const req = mockReq("{}");
    const res = mockRes();
    const done = handler(req, res);
    req.emit();
    await done;
    expect(res.status).toBe(502);
    expect(res.ended).toBeDefined();
  });

  it("下游提前 close → 上游 fetch 的 AbortSignal 触发", async () => {
    let upstreamSignal;
    vi.stubGlobal("fetch", async (_url, opts) => {
      upstreamSignal = opts.signal;
      return {
        status: 200,
        headers: new Map([["content-type", "text/event-stream"]]),
        body: (async function* () {
          yield new TextEncoder().encode("data: a\n\n");
          // 上游 body 长时间不结束：等 abort 后迭代抛错收尾
          await new Promise((_, rej) => {
            opts.signal.addEventListener("abort", () => rej(new Error("aborted upstream")));
          });
        })(),
      };
    });
    const handler = getProxyHandler();
    const req = mockReq("{}");
    const res = mockRes();
    const done = handler(req, res);
    req.emit();
    await new Promise((r) => setTimeout(r, 20)); // 等首块到达、迭代挂起
    expect(upstreamSignal.aborted).toBe(false);
    res.emitClose(); // 浏览器端提前断开（idle 超时 cancel 下游）
    await done;
    expect(upstreamSignal.aborted).toBe(true);
  });

  it("正常 SSE 完成后 close 不误 abort 上游", async () => {
    let upstreamSignal;
    vi.stubGlobal("fetch", async (_url, opts) => {
      upstreamSignal = opts.signal;
      return {
        status: 200,
        headers: new Map([["content-type", "text/event-stream"]]),
        body: (async function* () { yield new TextEncoder().encode("data: a\n\n"); })(),
      };
    });
    const handler = getProxyHandler();
    const req = mockReq("{}");
    const res = mockRes();
    const done = handler(req, res);
    req.emit();
    await done;
    res.emitClose(); // 正常完成后的 close（writableFinished=true）
    expect(upstreamSignal.aborted).toBe(false);
    expect(res.listenerCount("close")).toBe(0); // listener 已移除
  });

  it("正常流式逐块转发（不整包缓冲）", async () => {
    const c1 = new TextEncoder().encode("data: a\n\n");
    const c2 = new TextEncoder().encode("data: b\n\n");
    vi.stubGlobal("fetch", async () => ({
      status: 200,
      headers: new Map([["content-type", "text/event-stream"]]),
      body: (async function* () { yield c1; yield c2; })(),
    }));
    const handler = getProxyHandler();
    const req = mockReq("{}");
    const res = mockRes();
    const done = handler(req, res);
    req.emit();
    await done;
    expect(res.writes).toEqual([c1, c2]);
    expect(res.ended).toBeDefined();
  });
});
