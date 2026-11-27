import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NineGridMap from "./NineGridMap.jsx";

describe("九宫格地图（代码画格子）", () => {
  it("四种状态各自成格，不再引用石纹贴图", () => {
    const html = renderToStaticMarkup(createElement(NineGridMap, {
      centerLabel: "鱼定村·歇马居",
      cells: { w: { explored: true, name: "村口", dir: "w" }, e: { explored: false, dir: "e" }, n: { blocked: true, dir: "n" } },
      onGo: () => {}, loading: false,
    }));
    expect(html).toContain('data-state="current"');
    expect(html).toContain("歇马居");
    expect(html).toContain('data-state="explored"');
    expect(html).toContain('aria-label="往西去村口"');
    expect(html).toContain('data-state="fog"');
    expect(html).toContain('data-state="blocked"');
    expect(html).not.toMatch(/stones\/mapui|background-image/);
  });

  it("推演中格子不可点", () => {
    const html = renderToStaticMarkup(createElement(NineGridMap, { centerLabel: "村口", cells: {}, onGo: () => {}, loading: true }));
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('tabindex="-1"');
  });
});
