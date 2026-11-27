import { describe, expect, it } from "vitest";
import { classifyError, playerLineFor, presentError, redactSecrets } from "./apiErrors.js";

const LITELLM = "主叙事 HTTP 422：Budget has been exceeded! Key=qucuo-admin (sk-...a1b2), Team=default";

describe("报错脱敏", () => {
  it("去掉密钥别名、截断的 sk- 残片、Bearer 与查询参数里的 key", () => {
    const out = redactSecrets(`${LITELLM} Bearer abc.def x-api-key: zzz https://h.example/v1?key=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXX`);
    expect(out).not.toMatch(/qucuo-admin|sk-|abc\.def|zzz|AIza/);
    expect(out).toContain("Budget has been exceeded");
  });

  it("把已配置的完整密钥原文替换掉", () => {
    expect(redactSecrets("bad key sk-live-1234567890abcdef", "sk-live-1234567890abcdef")).not.toContain("1234567890");
  });

  it("没有敏感内容的文字原样返回", () => {
    expect(redactSecrets("接口超时（60 秒）")).toBe("接口超时（60 秒）");
  });
});

describe("错误分类", () => {
  it("HTTP 422 带 budget exceeded 判为额度用尽，不可重试，玩家一句话不提接口地址", () => {
    const err = Object.assign(new Error(LITELLM), { httpStatus: 422 });
    const ec = classifyError(err);
    expect(ec.kind).toBe("quota");
    expect(ec.retryable).toBe(false);
    expect(ec.line).toBe("天机不畅（接口额度已尽）");
    expect(ec.detail).not.toMatch(/qucuo-admin|sk-/);
  });

  it("429 限流措辞仍按限流处理，可重试", () => {
    const err = Object.assign(new Error("HTTP 429 rate limit, retry after 2s"), { httpStatus: 429 });
    expect(classifyError(err).kind).toBe("rateLimit");
  });

  it("presentError 给出主栏一句话与脱敏详情", () => {
    const pe = presentError(Object.assign(new Error("HTTP 401 invalid api key sk-abcdef0123456789"), { httpStatus: 401 }));
    expect(pe.line).toBe(playerLineFor("auth"));
    expect(pe.retryable).toBe(false);
    expect(pe.detail).not.toContain("sk-abcdef");
  });
});
