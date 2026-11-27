import { describe, expect, it } from "vitest";
import { appendTurnError, turnErrorEntry } from "./turnErrors.js";
import { scrubLogEntries } from "./logTypes.js";

const quota = () => turnErrorEntry({ kind: "quota", line: "天机不畅（接口额度已尽）", retryable: false });

describe("回合报错同因合并", () => {
  it("连续同因失败只留最后一条并计数，玩家的行动行都保留", () => {
    let log = [{ t: "cmd", text: "> 向东走" }];
    log = appendTurnError(log, quota());
    log = [...log, { t: "cmd", text: "> 再试一次" }];
    log = appendTurnError(log, quota());
    log = [...log, { t: "cmd", text: "> 还是不行" }];
    log = appendTurnError(log, quota());
    expect(log.map((e) => e.t)).toEqual(["cmd", "cmd", "cmd", "err"]);
    expect(log.at(-1).count).toBe(3);
    expect(log.at(-1).text).toBe("  天机不畅（接口额度已尽），本轮未计入。");
  });

  it("中间有回合成功（出现正文）就不再合并", () => {
    let log = appendTurnError([{ t: "cmd", text: "> a" }], quota());
    log = [...log, { t: "cmd", text: "> b" }, { t: "desc", text: "  正文" }, { t: "cmd", text: "> c" }];
    log = appendTurnError(log, quota());
    expect(log.filter((e) => e.t === "err").map((e) => e.count)).toEqual([1, 1]);
  });

  it("原因不同各记各的", () => {
    let log = appendTurnError([], quota());
    log = appendTurnError(log, turnErrorEntry({ kind: "timeout", line: "天机暂阻（接口超时）" }));
    expect(log.map((e) => e.kind)).toEqual(["quota", "timeout"]);
  });
});

describe("读档清洗", () => {
  it("把旧日志里的密钥残片洗掉，干净的日志原样返回", () => {
    const dirty = [{ t: "err", text: "     Budget has been exceeded! Key=qucuo-admin (sk-...)" }, { t: "desc", text: "  正文" }];
    const out = scrubLogEntries(dirty);
    expect(out[0].text).not.toMatch(/qucuo-admin|sk-/);
    expect(out[1]).toBe(dirty[1]);
    const clean = [{ t: "desc", text: "  正文" }];
    expect(scrubLogEntries(clean)).toBe(clean);
  });
});
