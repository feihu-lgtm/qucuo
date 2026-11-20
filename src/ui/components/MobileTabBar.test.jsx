import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MobileTabBar from "./MobileTabBar.jsx";
import { ZONE_THEMES } from "../theme.js";

describe("mobile column tabs", () => {
  it("labels both face controllers with one-based indices and accessible names", () => {
    const html = renderToStaticMarkup(createElement(MobileTabBar, {
      theme: ZONE_THEMES.village, column: "right", onSelect: () => {},
      leftFaces: { index: 1, count: 2, face: { name: "周遭" } },
      rightFaces: { index: 2, count: 5, face: { name: "行囊" } },
    }));
    expect(html).toContain("左 2/2");
    expect(html).toContain('aria-label="右 3/5 · 行囊"');
    expect(html).toContain('aria-label="中 · 江湖"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain("height:44px");
    expect(html).toContain("min-width:44px");
  });
});
