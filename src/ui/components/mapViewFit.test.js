import { describe, expect, it } from "vitest";
import { getMapFitView, MAX_MAP_SCALE, MIN_MAP_SCALE } from "./mapViewFit.js";

describe("getMapFitView", () => {
  it("centers the current and explored nodes while ignoring unexplored nodes", () => {
    const nodes = [
      { name: "鱼定村", x: 0, y: 0, current: true, explored: true },
      { name: "雅江", x: 2, y: 0, explored: true },
      { name: "锦官城", x: 3, y: 0, explored: true },
      { name: "迷雾", x: 20, y: 10, explored: false },
    ];
    const view = getMapFitView(nodes);
    const width = (21 * 132) + 80;
    const height = (11 * 132) + 80;
    const targetCenters = [0, 2, 3].map(x => (x * 132) + 40 + 66);
    const fittedCenter = ((Math.min(...targetCenters) - 66) + (Math.max(...targetCenters) + 66)) / 2;
    expect(fittedCenter * view.scale + view.tx).toBeCloseTo(width / 2);
    expect(view.scale).toBeGreaterThanOrEqual(MIN_MAP_SCALE);
    expect(view.scale).toBeLessThanOrEqual(MAX_MAP_SCALE);
    expect((66 * view.scale + view.ty)).toBeGreaterThanOrEqual(0);
    expect((66 * view.scale + view.ty)).toBeLessThan(height);
  });
});
