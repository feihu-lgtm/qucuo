import { describe, expect, it } from "vitest";
import { makeNodeHitArea } from "./mapHitArea.js";

describe("makeNodeHitArea", () => {
  it("centers a minimum-size hit area on the node", () => {
    expect(makeNodeHitArea(100, 80, 40, 30)).toEqual({
      x: 50,
      y: 30,
      width: 100,
      height: 100,
    });
  });

  it("keeps a larger visual node area intact", () => {
    expect(makeNodeHitArea(100, 80, 110, 120)).toEqual({
      x: 45,
      y: 20,
      width: 110,
      height: 120,
    });
  });
});
