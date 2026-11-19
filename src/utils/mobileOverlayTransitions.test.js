import { describe, expect, it } from "vitest";
import { didOpenConfirmation, didOpenOverlay } from "./mobileOverlayTransitions.js";

describe("mobile drawer overlay transitions", () => {
  it("detects newly opened overlays, not overlays that remain registered", () => {
    expect(didOpenOverlay(["debug"], ["debug"])).toBe(false);
    expect(didOpenOverlay(["basement"], ["basement"])).toBe(false);
    expect(didOpenOverlay(["debug"], ["debug", "basement"])).toBe(true);
    expect(didOpenOverlay(["debug"], [])).toBe(false);
  });

  it("detects a newly opened duel confirmation without blocking reopening", () => {
    const confirmation = { name: "NPC" };
    expect(didOpenConfirmation(null, confirmation)).toBe(true);
    expect(didOpenConfirmation(confirmation, confirmation)).toBe(false);
    expect(didOpenConfirmation(confirmation, null)).toBe(false);
  });
});
