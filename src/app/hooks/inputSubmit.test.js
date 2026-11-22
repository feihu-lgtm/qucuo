import { describe, expect, it, vi } from "vitest";
import { createInputKeyHandler } from "./useGameUi.js";

function make(over = {}) {
  const deps = {
    composingRef: { current: false }, interactMode: "action", sendPigeonLetter: vi.fn(), pigeonTarget: "才旦",
    input: "去喇嘛庙", act: vi.fn(), cmdHistory: [], histIdx: -1, setHistIdx: vi.fn(), setInput: vi.fn(), ...over,
  };
  return { deps, handler: createInputKeyHandler(deps) };
}

describe("send button and Enter share one submit path", () => {
  it("submit() acts on the current input, same as Enter", () => {
    const a = make();
    a.handler.submit();
    const b = make();
    b.handler({ key: "Enter", nativeEvent: {}, keyCode: 13 });
    expect(a.deps.act).toHaveBeenCalledWith("去喇嘛庙");
    expect(b.deps.act).toHaveBeenCalledWith("去喇嘛庙");
  });

  it("sends the letter in pigeon mode", () => {
    const { deps, handler } = make({ interactMode: "pigeon" });
    handler.submit();
    expect(deps.sendPigeonLetter).toHaveBeenCalledWith("才旦", "去喇嘛庙", { channel: "pigeon" });
    expect(deps.act).not.toHaveBeenCalled();
  });

  it("does nothing while an IME composition is open", () => {
    const { deps, handler } = make({ composingRef: { current: true } });
    handler.submit();
    expect(deps.act).not.toHaveBeenCalled();
  });
});
