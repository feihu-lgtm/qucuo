import { describe, expect, it } from "vitest";
import { isMobileKeyboardOpen } from "./mobileKeyboard.js";

describe("mobile keyboard detection", () => {
  it("ignores short landscape viewports when no input is focused", () => {
    expect(isMobileKeyboardOpen({
      isMobile: true,
      isInputFocused: false,
      viewportHeight: 375,
      innerHeight: 375,
    })).toBe(false);
  });

  it("requires a focused input and a visual viewport drop greater than 120px", () => {
    expect(isMobileKeyboardOpen({
      isMobile: true,
      isInputFocused: true,
      viewportHeight: 255,
      innerHeight: 375,
    })).toBe(false);
    expect(isMobileKeyboardOpen({
      isMobile: true,
      isInputFocused: true,
      viewportHeight: 254,
      innerHeight: 375,
    })).toBe(true);
  });

  it("only applies to mobile input and textarea focus", () => {
    expect(isMobileKeyboardOpen({
      isMobile: false,
      isInputFocused: true,
      viewportHeight: 200,
      innerHeight: 375,
    })).toBe(false);
    expect(isMobileKeyboardOpen({
      isMobile: true,
      isInputFocused: false,
      viewportHeight: 200,
      innerHeight: 375,
    })).toBe(false);
  });
});
