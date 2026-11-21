import { describe, expect, it, vi } from "vitest";
import { readMobileColumn, writeMobileColumn, didOpenCenterContent } from "./mobileColumn.js";

describe("mobile column preferences", () => {
  it.each(["left", "center", "right"])("reads and writes %s outside game saves", column => {
    const storage = { getItem: vi.fn(() => column), setItem: vi.fn() };
    expect(readMobileColumn(storage)).toBe(column);
    expect(storage.getItem).toHaveBeenCalledWith("qucuo_mobile_column");
    expect(writeMobileColumn(storage, column)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith("qucuo_mobile_column", column);
  });

  it.each([null, "", "invalid", "LEFT"])("defaults missing or invalid %s to center", value => {
    const storage = { getItem: () => value, setItem: vi.fn() };
    expect(readMobileColumn(storage)).toBe("center");
    expect(writeMobileColumn(storage, value)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith("qucuo_mobile_column", "center");
  });

  it("tolerates blocked storage", () => {
    const storage = { getItem: () => { throw Error("blocked"); }, setItem: () => { throw Error("quota"); } };
    expect(readMobileColumn(storage)).toBe("center");
    expect(writeMobileColumn(storage, "right")).toBe(false);
  });
});

describe("center-hosted content transitions", () => {
  it.each(["building", "trade", "duel", "interaction", "trauma", "debug", "basement"])("detects opening %s independently of other open content", key => {
    expect(didOpenCenterContent({ other: true }, { other: true, [key]: "opened" })).toBe(true);
  });

  it("does not override restored columns, unchanged screens, or closing screens", () => {
    expect(didOpenCenterContent(null, { building: "inn" })).toBe(false);
    expect(didOpenCenterContent({}, {})).toBe(false);
    expect(didOpenCenterContent({ building: "inn" }, { building: "inn" })).toBe(false);
    expect(didOpenCenterContent({ building: "inn" }, { building: null })).toBe(false);
    expect(didOpenCenterContent({ building: "inn" }, { building: "shop" })).toBe(true);
  });
});
