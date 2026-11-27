import { describe, expect, it } from "vitest";
import { dropRolledBackEntries } from "./rollbackLog.js";

describe("回滚时撤掉本回合写进主栏的世界变化", () => {
  const old = { t: "desc", text: "  上一回合的正文", tid: "turn-1" };
  const cmd = { t: "cmd", text: "> 回到歇马居的榻边坐下", tid: "turn-2" };

  it("撤掉进房、新人物、半截正文，留下行动行、报错与来信", () => {
    const before = new Set([old, cmd]);
    const log = [
      old, cmd,
      { t: "room", text: "鱼定村·歇马居", tid: "turn-2" },
      { t: "desc", text: "  你自「马车行」向西，来到此处。", tid: "turn-2" },
      { t: "sys", text: "  ※ 新人物出现 次仁洛桑（点击可细看其人）", tid: "turn-2" },
      { t: "narrator", text: "  「元朵朵来信」见信如面。", letterFrom: "元朵朵", tid: "turn-2" },
      { t: "err", kind: "empty", text: "  天机不清（接口没有返回内容），本轮未计入。", tid: "turn-2" },
    ];
    const out = dropRolledBackEntries(log, { before, tid: "turn-2" });
    expect(out.map((e) => e.t)).toEqual(["desc", "cmd", "narrator", "err"]);
  });

  it("别的回合、回合开始前已有的条目都不动；没有可撤的就原样返回", () => {
    const stray = { t: "sys", text: "  后台写的", tid: "turn-9" };
    const log = [old, cmd, stray];
    expect(dropRolledBackEntries(log, { before: new Set([old, cmd]), tid: "turn-2" })).toBe(log);
  });
});
