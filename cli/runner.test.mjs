import { describe, expect, it } from "vitest";
import { buildCliApiConfig } from "./runner.mjs";

describe("CLI API configuration", () => {
  it("selects Vertex as the provider for the --ai vertex configuration", () => {
    expect(buildCliApiConfig({ apiType: "vertex", vertexModel: "google/gemini-3.7-flash" })).toMatchObject({
      apiType: "vertex",
      provider: "vertex",
      vertexModel: "google/gemini-3.7-flash",
      streamEnabled: false,
    });
  });

  it("derives the protocol from an explicitly configured provider", () => {
    expect(buildCliApiConfig({ provider: "qwen" })).toMatchObject({ provider: "qwen", apiType: "qwen" });
  });

  it("keeps bookkeep off for deterministic CLI runs unless explicitly enabled", () => {
    expect(buildCliApiConfig()).toMatchObject({ bookkeepEnabled: false });
    expect(buildCliApiConfig({ bookkeepEnabled: true })).toMatchObject({ bookkeepEnabled: true });
  });

  it("WO-15 后软结算通道已删，CLI 配置不再携带 softSettleEnabled", () => {
    expect(buildCliApiConfig()).not.toHaveProperty("softSettleEnabled");
  });
});
