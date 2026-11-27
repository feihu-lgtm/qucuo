import { describe, expect, it } from "vitest";
import { compareSemver, nextSemver, parseSemver, shanghaiTime } from "./bumpVersion.mjs";

describe("scripts/bumpVersion.mjs", () => {
  it("parses and compares semver with or without leading v", () => {
    expect(parseSemver("v0.3.0")).toEqual({ major: 0, minor: 3, patch: 0, raw: "v0.3.0" });
    expect(parseSemver("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, raw: "v1.2.3" });
    expect(compareSemver("v0.3.0", "v0.2.0")).toBe(1);
    expect(compareSemver("0.3.0", "v0.3.0")).toBe(0);
    expect(compareSemver("v0.3.0", "v0.3.1")).toBe(-1);
    expect(compareSemver("v1.0.0", "v0.99.99")).toBe(1);
  });

  it("increments patch, minor, major and validates explicit versions", () => {
    expect(nextSemver("v0.3.0", "patch")).toBe("v0.3.1");
    expect(nextSemver("v0.3.4", "minor")).toBe("v0.4.0");
    expect(nextSemver("v0.3.4", "major")).toBe("v1.0.0");
    expect(nextSemver("v0.2.0", "v0.3.0")).toBe("v0.3.0");
    expect(nextSemver("v0.2.0", "0.3.0")).toBe("v0.3.0");
  });

  it("rejects invalid or non-increasing versions", () => {
    expect(() => parseSemver("0.3")).toThrow();
    expect(() => parseSemver("v0.3.0-beta")).toThrow();
    expect(() => nextSemver("v0.3.0", "v0.3.0")).toThrow();
    expect(() => nextSemver("v0.3.0", "v0.2.9")).toThrow();
  });

  it("formats Shanghai time as YYYY-MM-DD HH:MM", () => {
    const out = shanghaiTime(new Date("2026-11-27T08:10:00Z"));
    expect(out).toBe("2026-11-27 16:10");
  });
});
