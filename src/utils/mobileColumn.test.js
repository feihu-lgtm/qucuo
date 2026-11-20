import { describe, expect, it, vi } from "vitest";
import { MOBILE_COLUMN_KEY, readMobileColumn, writeMobileColumn } from "./mobileColumn.js";

describe("mobile column preferences", () => {
  it.each(["left", "center", "right"])("reads and writes %s outside game saves", column => {
    const storage = { getItem: vi.fn(() => column), setItem: vi.fn() };
    expect(readMobileColumn(storage)).toBe(column);
    expect(storage.getItem).toHaveBeenCalledWith("qucuo_mobile_column");
    expect(writeMobileColumn(storage, column)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(MOBILE_COLUMN_KEY, column);
  });

  it.each([null, "", "invalid", "LEFT"])("defaults missing or invalid %s to center", value => {
    const storage = { getItem: () => value, setItem: vi.fn() };
    expect(readMobileColumn(storage)).toBe("center");
    expect(writeMobileColumn(storage, value)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(MOBILE_COLUMN_KEY, "center");
  });

  it("tolerates blocked storage", () => {
    const storage = { getItem: () => { throw Error("blocked"); }, setItem: () => { throw Error("quota"); } };
    expect(readMobileColumn(storage)).toBe("center");
    expect(writeMobileColumn(storage, "right")).toBe(false);
  });
});
