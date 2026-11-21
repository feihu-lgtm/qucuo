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

  it("keeps soft settle on by default and honors an explicit opt-out", () => {
    expect(buildCliApiConfig()).toMatchObject({ softSettleEnabled: true });
    expect(buildCliApiConfig({ softSettleEnabled: false })).toMatchObject({ softSettleEnabled: false });
  });
});
