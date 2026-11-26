import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = readFileSync(join(HERE, "StartScreen.jsx"), "utf-8");
const STYLES = readFileSync(join(HERE, "startScreenStyles.js"), "utf-8");
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
    expect(STYLES).toContain('minHeight: "100dvh"');
    expect(STYLES).toContain('maxHeight: "min(70dvh, calc(100dvh - 32px))"');
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
    expect(landscape).toMatch(/\.duel-solo-panel \{\s*display:\s*grid/);
    expect(landscape, "团战面板结构不同，不能被套进两栏网格").not.toMatch(/\.mobile-duel-panel \{/);
    expect(readFileSync(join(HERE, "DuelScreen.jsx"), "utf-8")).toContain("mobile-duel-panel duel-solo-panel");
    expect(landscape).toMatch(/\.duel-topbar \{\s*grid-column:\s*1 \/ -1/);
    const duelDir = join(HERE, "duel");
    expect(readFileSync(join(duelDir, "DuelTopBar.jsx"), "utf-8")).toContain('className="duel-topbar"');
    const op = readFileSync(join(duelDir, "DuelOpPanel.jsx"), "utf-8");
    expect(op).toContain('className="duel-op"');
    expect(op).toContain('className="duel-move-grid"');
    expect(readFileSync(join(duelDir, "DuelLog.jsx"), "utf-8")).toContain('className="duel-log"');
  });

  it("has an iOS-only block for settings that goes full-screen with a four-column home in landscape", () => {
    const at = MOBILE_CSS.indexOf("/* iOS 专门适配：设置");
    expect(at).toBeGreaterThan(-1);
    const block = MOBILE_CSS.slice(at, MOBILE_CSS.indexOf("\n}\n", at));
    expect(block).toContain("@supports (-webkit-touch-callout: none) {");
    expect(block).toMatch(/\.settings-home-card \{\s*padding:\s*clamp\(/);
    const landscape = block.slice(block.indexOf("@media (orientation: landscape) and (max-height: 500px) {"));
    expect(landscape).toMatch(/\.settings-panel \{\s*width:\s*100%/);
    expect(landscape).toMatch(/\.settings-home-grid \{\s*grid-template-columns:\s*repeat\(4,/);
    const settings = readFileSync(join(HERE, "SettingsPanel.jsx"), "utf-8");
    // 设置面板套 ModalShell：根节点的 mobile-overlay-root 由外壳在默认（全屏）手机形态下加上，
    // 这里确认它用外壳、没有关掉全屏，且根节点与面板带着 iOS 适配规则要的类。
    expect(settings).toContain("<ModalShell");
    expect(settings).not.toMatch(/mobile="(?:none|sheet)"/);
    expect(settings).toContain('className="settings-root"');
    expect(settings).toContain("mobile-settings-panel settings-panel");
    expect(settings).toContain('className="settings-home-grid"');
    expect(settings).toContain('className="settings-home-card"');
  });

  it("has iOS rules for the 8-portrait appearance step and body profile panel with 16px no-zoom inputs", () => {
    const createAt = MOBILE_CSS.indexOf("/* iOS 专门适配：创角三步");
    const createBlock = MOBILE_CSS.slice(createAt, MOBILE_CSS.indexOf("\n}\n", createAt));
    expect(createBlock).toContain(".character-create-appearance-layout");
    expect(createBlock).toContain(".character-create-body-input");
    expect(createBlock).toMatch(/\.character-create-body-input \{\s*font-size:\s*16px/);

    const bodyAt = MOBILE_CSS.indexOf("/* iOS 专门适配：体貌档案面板");
    expect(bodyAt).toBeGreaterThan(-1);
    const bodyBlock = MOBILE_CSS.slice(bodyAt);
    expect(bodyBlock).toContain("@supports (-webkit-touch-callout: none) {");
    expect(bodyBlock).toContain(".body-profile-panel");
    expect(bodyBlock).toMatch(/\.body-profile-textarea \{\s*font-size:\s*16px/);
    expect(readFileSync(join(HERE, "BodyProfilePanel.jsx"), "utf-8")).toContain("body-profile-panel");
    expect(readFileSync(join(HERE, "PortraitBodyStep.jsx"), "utf-8")).toContain("character-create-appearance-layout");
  });

  it("renders bottom-right corner status with live real clock and single version entry inside flex bottom bar", () => {
    const startSrc = readFileSync(join(HERE, "StartScreen.jsx"), "utf-8");
    const stylesSrc = readFileSync(join(HERE, "startScreenStyles.js"), "utf-8");
    expect(startSrc).toContain('className="start-screen-bottom-bar"');
    expect(startSrc).toContain('className="start-screen-corner-status"');
    expect(startSrc).toContain("<LiveClockText withDate />");
    expect(startSrc).toContain("CURRENT_VERSION.version");
    expect(startSrc.match(/setShowVersionHistory\(true\)/g)?.length).toBe(1);
    expect(stylesSrc).toContain("bottomBar:");
    expect(stylesSrc).not.toMatch(/opacity:\s*disabled\s*\?\s*0\.35/);
    expect(MOBILE_CSS).toContain(".start-screen-bottom-bar");
    expect(MOBILE_CSS).toContain(".start-screen-corner-status");
  });
});
