import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GroundItemStrip from "./GroundItemStrip.jsx";

const render = (items) => renderToStaticMarkup(createElement(GroundItemStrip, {
  items, theme: {}, onPickUp: () => {},
}));

describe("GroundItemStrip", () => {
  it("hides empty and missing ground items", () => {
    expect(render([])).toBe("");
    expect(render(undefined)).toBe("");
  });

  it("renders string and object items as pickup buttons", () => {
    const html = render(["草药", { id: "sword", name: "铁剑" }]);
    expect(html).toContain(">地上<");
    expect(html).toContain("草药</button>");
    expect(html).toContain("铁剑</button>");
    expect(html).not.toContain("展开地上物品");
  });

  it("limits the initial strip and offers the remaining count", () => {
    const html = render(["一", "二", "三", "四", "五"]);
    expect(html).toContain("+2</button>");
    expect(html).not.toContain("四</button>");
  });
});
