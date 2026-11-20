import { describe, expect, it } from "vitest";
import { getMapDragUpdate } from "./mapDrag.js";

describe("getMapDragUpdate", () => {
  it("calculates the next translation without reading mutable drag state later", () => {
    expect(getMapDragUpdate({
      startX: 10,
      startY: 20,
      baseTx: 30,
      baseTy: -15,
      moved: false,
    }, 22, 28)).toEqual({
      tx: 42,
      ty: -7,
      moved: true,
    });
  });

  it("keeps a drag marked moved after returning to the start point", () => {
    expect(getMapDragUpdate({
      startX: 10,
      startY: 20,
      baseTx: 30,
      baseTy: -15,
      moved: true,
    }, 10, 20).moved).toBe(true);
  });
});
