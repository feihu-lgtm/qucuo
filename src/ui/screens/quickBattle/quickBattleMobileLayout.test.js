import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// 锚点跟代码走：拆屏后 CSS 在 qbShared.js（QB_CSS），类名在 PickScreen/BattleScreen。
const DIR = dirname(fileURLToPath(import.meta.url));
const SCREEN = ["QuickBattleScreen.jsx", "qbShared.js", "PickScreen.jsx", "BattleScreen.jsx"]
  .map(f => readFileSync(join(DIR, f), "utf-8")).join("\n");

describe("Quick Battle mobile candidate grid", () => {
  it("sizes rows to card content at every width and keeps mobile cards tappable", () => {
    const gridRule = SCREEN.match(/@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\.qb-candgrid\s*\{([^}]+)\}/)?.[1] || "";
    const cardRule = SCREEN.match(/\.qb-candgrid\s+\.qb-candidate-card\s*\{([^}]+)\}/)?.[1] || "";
    const battleRule = SCREEN.match(/\.qb-battle-screen\s*\{([^}]+)\}/)?.[1] || "";
    const landscapeRule = SCREEN.match(/@media\s*\(max-width:\s*767px\)\s*and\s*\(max-height:\s*450px\)\s*\{[\s\S]*?\.qb-candgrid\s+\.qb-candidate-card\s*\{([^}]+)\}/)?.[1] || "";
    const globalRowRule = SCREEN.match(/^\s{2}\.qb-candgrid\s*\{\s*grid-auto-rows:\s*max-content\s*!important;\s*\}/m)?.[0] || "";

    expect(gridRule).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important/);
    expect(gridRule).not.toMatch(/width:\s*\d+px/);
    expect(globalRowRule).not.toBe("");
    expect(cardRule).toMatch(/min-height:\s*44px\s*!important/);
    expect(cardRule).not.toMatch(/width:\s*\d+px/);
    expect(battleRule).toMatch(/overflow-y:\s*auto\s*!important/);
    expect(battleRule).toMatch(/overflow-x:\s*hidden\s*!important/);
    expect(landscapeRule).toMatch(/aspect-ratio:\s*auto\s*!important/);
    expect(landscapeRule).toMatch(/height:\s*clamp\(96px,32dvh,132px\)\s*!important/);
    expect(SCREEN).toContain('className="qb-candidate-card"');
    expect(SCREEN).toContain('className="qb-battle-screen"');
  });
});
