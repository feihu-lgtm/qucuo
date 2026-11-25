import { describe, expect, it } from "vitest";
import { stampLogEntries, LOG_T } from "./logTypes.js";
import { tagBackfill, insertBackfill } from "./backfill.js";
import { getGameDay, formatRealDateTime } from "../../../utils/mudHelpers.js";

describe("日志游戏回合/游戏日打标与时间工具", () => {
  it("getGameDay 按 24 回合换日", () => {
    expect(getGameDay(0)).toBe(1);
    expect(getGameDay(23)).toBe(1);
    expect(getGameDay(24)).toBe(2);
    expect(getGameDay(49)).toBe(3);
  });

  it("formatRealDateTime 格式化本地现实年月日时分秒", () => {
    const sample = new Date(2026, 10, 25, 1, 5, 9).getTime();
    expect(formatRealDateTime(sample, { withDate: true })).toBe("2026-11-25 01:05:09");
    expect(formatRealDateTime(sample, { withDate: false })).toBe("01:05:09");
  });

  it("stampLogEntries 为新增日志补上 turn/day/realTs 且保留已有标记", () => {
    const lines = stampLogEntries(
      [{ t: LOG_T.CMD, text: "> 端详才旦" }, { t: LOG_T.DESC, text: "已定回合", turn: 3, day: 1, realTs: 111 }],
      26,
      999,
    );
    expect(lines[0]).toMatchObject({ t: LOG_T.CMD, turn: 26, day: 2, realTs: 999 });
    expect(lines[1]).toMatchObject({ turn: 3, day: 1, realTs: 111 });
  });

  it("insertBackfill 继承事实行的 turn/day/realTs；老条目无 turn 时不强塞字段", () => {
    const key = "k_turn";
    const stampedFact = stampLogEntries(tagBackfill([{ t: LOG_T.SYS, text: "fact" }], key), 30, 2000);
    const filled = insertBackfill(stampedFact, key, ["补写一句。"]);
    expect(filled[1]).toMatchObject({ t: LOG_T.DESC, fillProse: true, turn: 30, day: 2, realTs: 2000 });

    const legacyFact = tagBackfill([{ t: LOG_T.SYS, text: "legacy" }], "k_legacy");
    const legacyFilled = insertBackfill(legacyFact, "k_legacy", ["旧档补写。"]);
    expect(legacyFilled[1]).toEqual({ t: LOG_T.DESC, text: "  旧档补写。", fillKey: "k_legacy", fillProse: true });
  });
});
