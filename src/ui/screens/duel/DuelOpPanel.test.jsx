// #667 胜负措辞按战斗性质分档：切磋维持原文，地宫遭遇战与镇宫首领战不再写「切磋」。
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DuelOpPanel, { DUEL_WORDING } from "./DuelOpPanel.jsx";

const panelHtml = (props) => renderToStaticMarkup(
  <DuelOpPanel selecting={false} moveset={[]} playerEnergy={[0, 0]} battleItems={[]} npcMovesetLocal={[]} revealedNpcMoves={[]} {...props} />,
);

describe("胜负措辞分档（#667）", () => {
  it("默认切磋维持原措辞", () => {
    const html = panelHtml({ outcome: "win", phase: "result" });
    expect(html).toContain("切磋已分胜负");
    expect(html).toContain("结束切磋");
  });

  it("镇宫首领战胜出：明示首领伏诛、地宫已打通，收尾按钮引向清点战利品", () => {
    const result = panelHtml({ kind: "boss", outcome: "win", phase: "result" });
    expect(result).toContain("镇宫首领伏诛");
    expect(result).toContain("地宫已打通");
    expect(result).not.toContain("切磋");
    expect(panelHtml({ kind: "boss", outcome: "win", phase: "over" })).toContain("清点战利品");
  });

  it("地宫遭遇战不写切磋", () => {
    const html = panelHtml({ kind: "fight", outcome: "win", phase: "result" });
    expect(html).toContain(DUEL_WORDING.fight.win.replace("◆ ", ""));
    expect(html).not.toContain("切磋");
  });
});
