import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile viewport", () => {
  it("opts into safe-area viewport fitting", () => {
    const html = readFileSync("index.html", "utf-8");
    expect(html).toMatch(/<meta[^>]+name=["']viewport["'][^>]+viewport-fit=cover/i);
  });
});
