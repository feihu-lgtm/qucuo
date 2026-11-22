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

  it("has an iOS-only block that fits the start screen on one screen in portrait and landscape", () => {
    const ios = MOBILE_CSS.indexOf("@supports (-webkit-touch-callout: none) {");
    expect(ios).toBeGreaterThan(-1);
    const block = MOBILE_CSS.slice(ios);
    const portrait = block.indexOf("@media (max-width: 768px) and (orientation: portrait) {");
    const landscape = block.indexOf("@media (orientation: landscape) and (max-height: 500px) {");
    expect(portrait).toBeGreaterThan(-1);
    expect(landscape).toBeGreaterThan(portrait);
    const portraitRules = block.slice(portrait, landscape);
    expect(portraitRules).toMatch(/max-height:\s*18dvh/);
    expect(portraitRules).toMatch(/padding:\s*clamp\(6px,\s*1\.5dvh,\s*14px\)/);
    const landscapeRules = block.slice(landscape);
    expect(landscapeRules).toMatch(/display:\s*grid\s*!important/);
    expect(landscapeRules).toMatch(/grid-row:\s*1 \/ span 2/);
  });

  it("has an iOS-only block for character creation that fits landscape on one screen", () => {
    const at = MOBILE_CSS.indexOf("/* iOS 专门适配：创角三步");
    expect(at).toBeGreaterThan(-1);
    const block = MOBILE_CSS.slice(at, MOBILE_CSS.indexOf("\n}\n", at));
    expect(block).toContain("@supports (-webkit-touch-callout: none) {");
    expect(block).toMatch(/\.character-create-root \{\s*min-height:\s*100dvh/);
    const landscape = block.slice(block.indexOf("@media (orientation: landscape) and (max-height: 500px) {"));
    expect(landscape).toMatch(/grid-template-columns:\s*repeat\(4,/);
    expect(landscape).toMatch(/\.character-create-sub \{\s*display:\s*none/);
    const create = readFileSync(join(HERE, "CharacterCreate.jsx"), "utf-8");
    expect(create).toContain('className="character-create-title"');
    expect(create).toContain('className="character-create-sub"');
  });

  it("has an iOS-only block for duel that goes two-column full-screen in landscape", () => {
    const at = MOBILE_CSS.indexOf("/* iOS 专门适配：切磋");
    expect(at).toBeGreaterThan(-1);
    const block = MOBILE_CSS.slice(at, MOBILE_CSS.indexOf("\n}\n", at));
    expect(block).toContain("@supports (-webkit-touch-callout: none) {");
    expect(block).toMatch(/\.duel-move-grid \{\s*max-height:\s*30dvh/);
    const landscape = block.slice(block.indexOf("@media (orientation: landscape) and (max-height: 500px) {"));
    expect(landscape).toMatch(/\.mobile-duel-panel \{\s*display:\s*grid/);
    expect(landscape).toMatch(/\.duel-topbar \{\s*grid-column:\s*1 \/ -1/);
    const duelDir = join(HERE, "duel");
    expect(readFileSync(join(duelDir, "DuelTopBar.jsx"), "utf-8")).toContain('className="duel-topbar"');
    const op = readFileSync(join(duelDir, "DuelOpPanel.jsx"), "utf-8");
    expect(op).toContain('className="duel-op"');
    expect(op).toContain('className="duel-move-grid"');
    expect(readFileSync(join(duelDir, "DuelLog.jsx"), "utf-8")).toContain('className="duel-log"');
  });
});
