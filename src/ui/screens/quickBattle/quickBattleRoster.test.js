import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("斗蛐蛐 UI 翻新结构约束", () => {
  it("选人界面 OC 冒险者单列分组", () => {
    const src = readFileSync("src/ui/screens/quickBattle/PickScreen.jsx", "utf8");
    expect(src).toContain("虹品群侠 · OC 冒险者");
    expect(src).toContain('c.pool === "oc"');
  });
  it("选人与对战立绘走 fighterArtUrl（artManifest 全库），不再用首字占位为唯一途径", () => {
    const pick = readFileSync("src/ui/screens/quickBattle/PickScreen.jsx", "utf8");
    const battle = readFileSync("src/ui/screens/quickBattle/BattleScreen.jsx", "utf8");
    expect(pick).toContain("fighterArtUrl(c.name, c.portrait)");
    expect(battle).toContain("fighterArtUrl(fighter.name, fighter.portrait)");
    const shared = readFileSync("src/ui/screens/quickBattle/qbShared.js", "utf8");
    expect(shared).toContain("npcArtUrl");
  });
  it("对战界面出招显示招式名（lastMoves 落对峙区）", () => {
    const src = readFileSync("src/ui/screens/quickBattle/BattleScreen.jsx", "utf8");
    expect(src).toContain("lastMoves");
    expect(src).toContain("「{lastMove.name}」");
  });
});
