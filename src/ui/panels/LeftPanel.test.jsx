import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NpcAngerLine } from "./LeftPanel.jsx";

describe("LeftPanel NPC anger status", () => {
  it("renders the shared anger line with its existing color and attempt count", () => {
    const html = renderToStaticMarkup(createElement(NpcAngerLine, {
      angerState: {
        active: true,
        reason: "偷窃未遂",
        turnsLeft: 2,
        attempts: [{}, {}, {}],
      },
    }));

    expect(html).toContain("⚡ 气头上（偷窃未遂），还剩 2 回合 · 已求和 3 次");
    expect(html).toContain("color:#e0526a");
  });

  it("does not render an inactive anger line", () => {
    expect(renderToStaticMarkup(createElement(NpcAngerLine, {
      angerState: { active: false, attempts: [] },
    }))).toBe("");
  });
});
