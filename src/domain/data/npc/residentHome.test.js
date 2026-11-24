import { describe, it, expect } from "vitest";
import { getResidentNpcs, getAllResidentNpcNames } from "./residentNpcs.js";

describe("OC homeDistrict 驻场", () => {
  it("元朵朵驻场鱼定村，锦官城无她", () => {
    expect(getResidentNpcs("鱼定村").some((n) => n.name === "元朵朵")).toBe(true);
    expect(getResidentNpcs("锦官城").some((n) => n.name === "元朵朵")).toBe(false);
    expect(getAllResidentNpcNames().has("元朵朵")).toBe(true);
  });
});
