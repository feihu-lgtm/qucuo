import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sx } from "./screens/quickBattle/qbShared.js";

// 「var(--clay)55」这种拼法是无效 CSS，整条声明会被丢掉；调用方传 var() 时要用 color-mix 调透明度。
const INVALID_ALPHA = /var\(--[\w-]+\)[0-9a-f]{2}\b/i;

describe("var() 颜色加透明度", () => {
  it("斗蛐蛐伤害标签用 var() 色时背景仍有效", () => {
    for (const color of ["var(--qb-foe)", "var(--blue)"]) {
      const { background } = sx.dmgTag(color);
      expect(background).not.toMatch(INVALID_ALPHA);
      expect(background).toContain(color);
    }
  });

  it("结算列下划线和见闻录途径标签不再给 var() 直接拼后缀", () => {
    for (const file of ["src/ui/screens/quickBattle/ResultScreen.jsx", "src/ui/screens/LoreScreen.jsx"]) {
      const source = readFileSync(file, "utf-8");
      expect(source).toContain("color-mix(in srgb,");
      expect(source).not.toMatch(/\$\{(?:color|途径色\[途\] \|\| border)\}[0-9a-f]{2}`/);
    }
  });
});
