import { describe, expect, it } from "vitest";
import { classifyError, isRetryableError } from "./apiErrors.js";

const http = (status, message) => Object.assign(new Error(message), { httpStatus: status });

describe("classifyError", () => {
  it("把空响应体的 404 归为接口地址/模型名错误，而不是格式异常", () => {
    const ec = classifyError(http(404, "OpenAI 兼容调用 HTTP 404：Unexpected end of JSON input"));
    expect(ec.kind).toBe("endpoint");
    expect(ec.title).toContain("接口地址或模型名");
    expect(ec.hint).toContain("模型名");
    expect(ec.retryable).toBe(false);
  });

  it.each([
    [400, "parameter", false],
    [401, "auth", false],
    [403, "auth", false],
    [405, "request", false],
    [408, "timeout", true],
    [422, "request", false],
    [429, "rateLimit", true],
    [500, "server", true],
    [502, "server", true],
    [503, "server", true],
  ])("HTTP %i → %s，可重试=%s", (status, kind, retryable) => {
    const ec = classifyError(http(status, `调用 HTTP ${status}：{"error":"bad JSON field"}`));
    expect(ec.kind).toBe(kind);
    expect(ec.title).toContain(String(status));
    expect(ec.retryable).toBe(retryable);
  });

  it("HTTP 码优先于报错文字里的超时、网页字样", () => {
    expect(classifyError(http(400, "HTTP 400：max_tokens 超过 8192 上限"))).toMatchObject({ kind: "parameter", retryable: false });
    const gateway = Object.assign(new Error("接口返回的是网页而不是数据（HTTP 502）"), { code: "html", httpStatus: 502 });
    expect(classifyError(gateway)).toMatchObject({ kind: "server", retryable: true });
  });

  it("200 但内容无法解析时重试，不当成密钥错误", () => {
    const err = Object.assign(new Error("接口返回的内容无法解析（HTTP 200）。返回开头是「oops」——请检查设置里的接口地址和接口类型。"), { code: "unparsable", httpStatus: 200 });
    expect(classifyError(err)).toMatchObject({ kind: "unparsable", retryable: true });
  });

  it("429 余额不足不重试，普通限流重试", () => {
    expect(classifyError(http(429, "HTTP 429：You exceeded your current quota, check your billing"))).toMatchObject({ kind: "quota", retryable: false });
    expect(classifyError(http(429, "HTTP 429：Rate limit reached"))).toMatchObject({ kind: "rateLimit", retryable: true });
    expect(classifyError(http(429, "HTTP 429：Quota exceeded for quota metric 'Generate Content API requests per minute'"))).toMatchObject({ kind: "rateLimit", retryable: true });
  });

  it("从报错文字里读 HTTP 码，也认 status 字段", () => {
    expect(classifyError(new Error("OpenAI 兼容 API HTTP 404")).kind).toBe("endpoint");
    expect(classifyError(Object.assign(new Error("AI request failed"), { status: 401 })).kind).toBe("auth");
  });

  it("分开空响应、网络断开、超时和真正的格式错误", () => {
    expect(classifyError(Object.assign(new Error("接口返回了空响应（HTTP 200）"), { code: "empty", httpStatus: 200 })).kind).toBe("empty");
    expect(classifyError(Object.assign(new Error("流式传输中途断开：network error"), { code: "network" })).kind).toBe("network");
    expect(classifyError(Object.assign(new Error("请求超过 60 秒没有响应"), { code: "timeout" })).kind).toBe("timeout");
    const format = classifyError(new Error("AI reply format is invalid"));
    expect(format.kind).toBe("format");
    expect(format.retryable).toBe(true);
  });

  it("网页当数据的错误不重试", () => {
    const err = Object.assign(new Error("接口返回的是网页而不是数据（HTTP 200）"), { code: "html", httpStatus: 200 });
    expect(classifyError(err).kind).toBe("endpoint");
    expect(isRetryableError(err)).toBe(false);
  });
});
