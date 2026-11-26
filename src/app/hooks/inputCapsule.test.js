import { describe, it, expect, vi } from "vitest";
import { createInputKeyHandler } from "./useGameUi.js";

// W-INPUT 提交分流铁律：胶囊发完即焚，三路直通。
function mk(over = {}) {
  const act = vi.fn();
  const sendPigeonLetter = vi.fn();
  const clearCapsule = vi.fn();
  const clearTargets = vi.fn();
  const handler = createInputKeyHandler({
    composingRef: { current: false },
    interactMode: "action",
    sendPigeonLetter,
    pigeonTarget: null,
    input: "你好",
    act,
    cmdHistory: [],
    histIdx: -1,
    setHistIdx: () => {},
    setInput: () => {},
    inputCapsule: null,
    clearCapsule,
    clearTargets,
    narratorName: "旁白",
    ...over,
  });
  return { act, sendPigeonLetter, clearCapsule, clearTargets, handler };
}

describe("W-INPUT 胶囊分流", () => {
  it("飞鸽胶囊直通 sendPigeonLetter 并清胶囊", () => {
    const { act, sendPigeonLetter, clearCapsule, handler } = mk({
      input: "见字如晤",
      inputCapsule: { kind: "pigeon", name: "才旦" },
    });
    handler.submit();
    expect(sendPigeonLetter).toHaveBeenCalledWith("才旦", "见字如晤", { channel: "pigeon" });
    expect(clearCapsule).toHaveBeenCalled();
    expect(act).not.toHaveBeenCalled();
  });

  it("私语胶囊直通 whisper 不耗回合并清胶囊", () => {
    const { act, clearCapsule, handler } = mk({
      input: "你觉得呢",
      inputCapsule: { kind: "whisper", name: "旁白" },
    });
    handler.submit();
    expect(act).toHaveBeenCalledWith("你觉得呢", [], { whisper: true });
    expect(clearCapsule).toHaveBeenCalled();
  });

  it.each(["//", "((", "（（", "@旁白 "])("前缀 %s 直通 whisper 且剥前缀", (prefix) => {
    const { act, handler } = mk({ input: `${prefix}今儿天真冷` });
    handler.submit();
    expect(act).toHaveBeenCalledWith("今儿天真冷", [], { whisper: true });
  });

  it("@人名胶囊仅限本条 targetHint 并清 targets", () => {
    const { act, clearCapsule, clearTargets, handler } = mk({
      inputCapsule: { kind: "target", name: "才旦" },
    });
    handler.submit();
    expect(act).toHaveBeenCalledWith("你好", [], { targetHint: "才旦" });
    expect(clearCapsule).toHaveBeenCalled();
    expect(clearTargets).toHaveBeenCalled();
  });

  it("裸输入走默认 act 不清胶囊", () => {
    const { act, clearCapsule, handler } = mk({});
    handler.submit();
    expect(act).toHaveBeenCalledWith("你好");
    expect(clearCapsule).not.toHaveBeenCalled();
  });
});
