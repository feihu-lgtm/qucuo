import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("美术接入查漏：冒险者/切磋对手立绘落像", () => {
  it("地宫冒险者节点标题带 NpcAvatar 落像", () => {
    const src = readFileSync("src/ui/screens/dungeon/DungeonNodeView.jsx", "utf8");
    expect(src).toContain('import NpcAvatar from "../../components/NpcAvatar.jsx"');
    expect(src).toMatch(/<NpcAvatar name=\{adv\.name\} size="sm" \/>/);
  });
  it("切磋对峙条对手名旁带 NpcAvatar 落像", () => {
    const src = readFileSync("src/ui/screens/duel/DuelTopBar.jsx", "utf8");
    expect(src).toContain('import NpcAvatar from "../../components/NpcAvatar.jsx"');
    expect(src).toMatch(/<NpcAvatar name=\{npc\.name\} size="sm" \/>/);
  });
});
