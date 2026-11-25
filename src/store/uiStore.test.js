import { afterEach, describe, expect, it } from "vitest";
import {
  closeAll,
  clearNotice,
  closeOverlay,
  openOverlay,
  OVERLAY,
  showNotice,
  toggleOverlay,
  uiStore,
} from "./uiStore.js";

describe("ui overlay store", () => {
  afterEach(() => { closeAll(); clearNotice(); });

  it("keeps the ordered stack and does not duplicate an open overlay", () => {
    openOverlay(OVERLAY.SETTINGS);
    openOverlay(OVERLAY.CARD_IMPORT);
    openOverlay(OVERLAY.SETTINGS);

    expect(uiStore.getState().overlays).toEqual([
      OVERLAY.SETTINGS,
      OVERLAY.CARD_IMPORT,
    ]);
  });

  it("closes an entry without disturbing entries above it", () => {
    openOverlay(OVERLAY.SETTINGS);
    openOverlay(OVERLAY.TRACE);
    openOverlay(OVERLAY.BUG_REPORT);

    closeOverlay(OVERLAY.TRACE);

    expect(uiStore.getState().overlays).toEqual([
      OVERLAY.SETTINGS,
      OVERLAY.BUG_REPORT,
    ]);
  });

  it("toggles overlays and closes the full stack", () => {
    toggleOverlay(OVERLAY.TRACE);
    toggleOverlay(OVERLAY.BUG_REPORT);
    toggleOverlay(OVERLAY.TRACE);

    expect(uiStore.getState().overlays).toEqual([OVERLAY.BUG_REPORT]);

    closeAll();

    expect(uiStore.getState().overlays).toEqual([]);
  });

  it("defines one frozen name for every former overlay flag", () => {
    expect(Object.isFrozen(OVERLAY)).toBe(true);
    expect(Object.values(OVERLAY)).toHaveLength(23);
    expect(OVERLAY).not.toHaveProperty("PIPELINE");
    expect(new Set(Object.values(OVERLAY)).size).toBe(23);
  });

  it("replaces notices and ignores a stale dismissal", () => {
    const first = showNotice("先前提示");
    const second = showNotice("此路不通");
    expect(uiStore.getState().notice).toEqual(second);
    clearNotice(first.id);
    expect(uiStore.getState().notice).toEqual(second);
    clearNotice(second.id);
    expect(uiStore.getState().notice).toBeNull();
  });
});
