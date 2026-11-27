import { beforeEach, describe, expect, it } from "vitest";
import { gameActions, gameStore } from "../../store/gameStore.js";
import { addLog, addTurnError, clearActiveTraceId, setActiveTraceId } from "./gameRuntime.js";
import { turnErrorEntry } from "../../domain/rules/log/turnErrors.js";

describe("主栏日志盖回合编号", () => {
  beforeEach(() => { gameActions.setLog([]); gameActions.setTime(57); clearActiveTraceId(); });

  it("回合进行中写入的条目带上 tid，回合结束后不再带", () => {
    setActiveTraceId("turn-9");
    addLog([{ t: "desc", text: "  正文" }]);
    clearActiveTraceId("turn-9");
    addLog([{ t: "sys", text: "  之后的系统行" }]);
    const [first, second] = gameStore.getState().log;
    expect(first.tid).toBe("turn-9");
    expect(second.tid).toBeUndefined();
  });

  it("误传单个对象也能写进去，不再抛错", () => {
    addLog({ t: "sys", text: "  单条" });
    expect(gameStore.getState().log.at(-1).text).toBe("  单条");
  });

  it("回合报错走同因合并", () => {
    const entry = turnErrorEntry({ kind: "quota", line: "天机不畅（接口额度已尽）", retryable: false });
    addTurnError(entry);
    addLog([{ t: "cmd", text: "> 再试" }]);
    addTurnError(entry);
    const errs = gameStore.getState().log.filter((e) => e.t === "err");
    expect(errs).toHaveLength(1);
    expect(errs[0].count).toBe(2);
  });
});
