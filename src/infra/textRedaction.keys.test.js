import { describe, expect, it } from "vitest";
import { scrubCredentialPatterns, scrubString } from "./textRedaction.js";

describe("调试包脱敏补漏", () => {
  it("上游报错里的密钥别名与截断残片都被拦下", () => {
    const out = scrubCredentialPatterns("Budget has been exceeded! Key=qucuo-admin (sk-...), x-api-key: abc123");
    expect(out).not.toMatch(/qucuo-admin|sk-|abc123/);
    expect(out).toContain("Budget has been exceeded");
  });

  it("短的、带连字符的 sk- 密钥也会被替换", () => {
    expect(scrubString("key sk-proj-ab12")).not.toContain("sk-proj");
  });
});
