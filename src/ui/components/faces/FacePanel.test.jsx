import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FacePanel from "../FacePanel.jsx";
import useFaces from "./useFaces.js";
import { ZONE_THEMES } from "../../theme.js";
import { addFace, removeFace, validateFacePreferences } from "./facePreferences.js";

const defaults = { faces: [
  { id: "one", name: "One", modules: ["alpha"] },
  { id: "two", name: "Two", modules: [] },
], currentIndex: 0 };
const availableModules = [{ id: "alpha", label: "Alpha" }, { id: "beta", label: "Beta" }];

function Demo({ editable = true, empty = false, hidden = false, swipe = true }) {
  const faces = useFaces("generic_test", { ...defaults, currentIndex: empty ? 1 : 0 }, { availableModules, editable });
  return createElement("div", null, createElement("output", null, `Example ${faces.index + 1}/${faces.count}`),
    createElement(FacePanel, { faces, theme: ZONE_THEMES.village, label: "Example", swipe,
      renderModule: id => createElement("p", null, `Rendered ${id}`), isModuleVisible: () => !hidden }));
}

describe("generic FacePanel", () => {
  it("renders caller-supplied modules and a labeled tab bar without panel-specific data", () => {
    const html = renderToStaticMarkup(createElement(Demo));
    expect(html).toContain("Rendered alpha");
    expect(html).toContain("Example 1/2");
    expect(html).toContain('aria-label="Example面切换"');
    expect(html).toContain("编排");
    expect(html).not.toContain("侠客");
  });

  it("supports non-editable, empty and conditionally hidden modules", () => {
    const html = renderToStaticMarkup(createElement(Demo, { editable: false, empty: true, swipe: false }));
    expect(html).not.toContain("编排");
    expect(html).toContain("本面暂无可显示的模块");
    expect(html).toContain("Example 2/2");
    expect(html).toContain("touch-action:auto");
    expect(renderToStaticMarkup(createElement(Demo, { hidden: true }))).not.toContain("Rendered alpha");
  });

  it("keeps tab and panel IDs unique across instances", () => {
    const html = renderToStaticMarkup(createElement("div", null, createElement(Demo), createElement(Demo)));
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("honors configurable minimum and maximum face counts", () => {
    expect(addFace(defaults, 2)).toBe(defaults);
    expect(removeFace(defaults, 2)).toBe(defaults);
    expect(validateFacePreferences({ faces: [] }, defaults, { availableModules, minFaces: 2, maxFaces: 3 })).toEqual(defaults);
  });
});
