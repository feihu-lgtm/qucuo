import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = readFileSync(join(HERE, "StartScreen.jsx"), "utf-8");
const MOBILE_CSS = readFileSync(join(HERE, "..", "mobile.css"), "utf-8");

describe("StartScreen mobile layout", () => {
  it("moves the footer into normal flow below the menu on narrow or short screens", () => {
    const footerIndex = MOBILE_CSS.indexOf(".start-screen-footer {");
    const mediaIndex = MOBILE_CSS.lastIndexOf("@media (max-width: 768px), (max-height: 700px) {", footerIndex);
    const footerRuleEnd = MOBILE_CSS.indexOf("}", footerIndex);
    const footerRule = MOBILE_CSS.slice(footerIndex, footerRuleEnd);

    expect(footerIndex).toBeGreaterThan(-1);
    expect(mediaIndex).toBeGreaterThan(-1);
    expect(mediaIndex).toBeLessThan(footerIndex);
    expect(footerRule).toMatch(/position:\s*static\s*!important/);
    expect(footerRule).toMatch(/margin-top:\s*auto/);
    expect(SCREEN).toContain('className="start-screen-footer"');
    expect(SCREEN).toContain('minHeight: "100dvh"');
    expect(SCREEN).toContain('maxHeight: "min(70dvh, calc(100dvh - 32px))"');
  });
});
