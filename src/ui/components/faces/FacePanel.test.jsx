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
  it("renders caller-supplied modules and a labeled carousel without panel-specific data", () => {
    const html = renderToStaticMarkup(createElement(Demo));
    expect(html).toContain("Rendered alpha");
    expect(html).toContain("Example 1/2");
    expect(html).toContain('aria-label="Example面切换"');
    expect(html).toContain("编排");
    expect(html).not.toContain("侠客");
    const bar = html.match(/<nav[\s\S]*?<\/nav>/)[0];
    expect(bar).not.toContain("face-edge");
    expect(bar).not.toContain('role="tab"');
    expect(bar).toContain('aria-label="编排" title="编排"');
    expect(bar).toContain("⚙");
    expect(html).toContain('class="face-edge face-edge-previous" aria-label="上一面"');
    expect(html).toContain('class="face-edge face-edge-next" aria-label="下一面"');
  });

  it("supports non-editable, empty and conditionally hidden modules", () => {
    const html = renderToStaticMarkup(createElement(Demo, { editable: false, empty: true, swipe: false }));
    expect(html).not.toContain("编排");
    expect(html).toContain("本面暂无可显示的模块");
    expect(html).toContain("Example 2/2");
    expect(html).toContain("touch-action:auto");
    expect(renderToStaticMarkup(createElement(Demo, { hidden: true }))).not.toContain("Rendered alpha");
  });

  it("keeps label and content IDs unique across instances", () => {
    const html = renderToStaticMarkup(createElement("div", null, createElement(Demo), createElement(Demo)));
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("shows only current and adjacent labels, with one side for two faces", () => {
    for (const count of [1, 2, 5]) {
      const preferences = { faces: Array.from({ length: count }, (_, index) => ({
        id: `face-${index}`, name: `Face ${index}`, modules: [],
      })), currentIndex: 0 };
      const faces = { preferences, face: preferences.faces[0], direction: 1, editable: false, rotate: () => {} };
      const html = renderToStaticMarkup(createElement(FacePanel, {
        faces, theme: ZONE_THEMES.village, renderModule: () => null,
      }));
      const bar = html.match(/<nav[\s\S]*?<\/nav>/)[0];
      expect(bar).toContain('<span aria-current="true">Face 0</span>');
      expect((bar.match(/aria-label="下一面"/g) || []).length).toBe(count > 1 ? 1 : 0);
      expect((bar.match(/aria-label="上一面"/g) || []).length).toBe(count > 2 ? 1 : 0);
      expect((bar.match(/aria-hidden="true"/g) || []).length).toBe(Math.max(0, count - 3));
    }
  });

  it("honors configurable minimum and maximum face counts", () => {
    expect(addFace(defaults, 2)).toBe(defaults);
    expect(removeFace(defaults, 2)).toBe(defaults);
    expect(validateFacePreferences({ faces: [] }, defaults, { availableModules, minFaces: 2, maxFaces: 3 })).toEqual(defaults);
  });
});
