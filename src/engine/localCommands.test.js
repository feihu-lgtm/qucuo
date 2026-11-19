import { afterEach, describe, expect, it } from "vitest";
import { loadSquares } from "../mapSquares.js";
import { parseLocalCommand } from "./localCommands.js";

const state = (overrides = {}) => ({
  room: { name: "鱼定村" },
  char: { hp: [80, 100], special: { 根骨: 5 }, neigong: 12, waigong: 8 },
  inv: [],
  skills: [],
  exp: 3,
  pot: 4,
  flags: [],
  time: 6,
  convo: [],
  ...overrides,
});

afterEach(() => loadSquares({}));

describe("parseLocalCommand", () => {
  it.each(["帮助", "help"])("returns help lines for %s", (command) => {
    expect(parseLocalCommand(command, state())).toMatchObject({
      kind: "lines",
      lines: expect.arrayContaining([{ t: "sys", text: "── 命令列表 ──" }]),
    });
  });

  it("formats status from the effective state", () => {
    const result = parseLocalCommand("状态", state());
    expect(result.kind).toBe("lines");
    expect(result.lines[1].text).toBe("  气血 ████████░░ 80/100");
    expect(result.lines[2].text).toBe("  内功 █░░░░░░░░░ 12/100");
    expect(result.lines[3].text).toBe("  外功 █░░░░░░░░░ 8/100");
    expect(result.lines.at(-1).text).toBe("  经验 3  潜能 4");
  });

  it("lists inventory, skills, and equipped items", () => {
    const current = state({
      inv: [{ name: "长剑", category: "weapon", quality: "蓝", equipped: true }],
      skills: [{ name: "铁指功", active: true, stage: "小成", quality: "绿" }],
    });
    expect(parseLocalCommand("背包", current).lines[1].text).toBe("  · [已装备] 长剑（蓝）");
    expect(parseLocalCommand("武学", current).lines[1].text).toBe("  ▶ 铁指功·小成（绿品）");
    expect(parseLocalCommand("装备", current).lines[1].text).toBe("  武器：长剑(蓝)");
  });

  it("returns cached room look as a state result and consumes one turn", () => {
    loadSquares({ 鱼定村: { day: 0, lookText: "村口的石阶旁长着青苔。" } });
    const result = parseLocalCommand("看", state());

    expect(result.kind).toBe("result");
    expect(result.localKind).toBe("cachedLook");
    expect(result.result.changes.time).toBe(7);
    expect(result.result.changes.convo).toEqual([
      { role: "user", content: "看" },
      { role: "assistant", content: "村口的石阶旁长着青苔。" },
    ]);
    expect(result.result.logs).toEqual([
      { t: "cmd", text: "> 看" },
      { t: "desc", text: "  村口的石阶旁长着青苔。" },
    ]);
  });

  it("returns fixed quest-script output and declines non-local commands", () => {
    const script = parseLocalCommand("#testscript village2_jieshixiajiu quest_village2_s2", state());
    expect(script.kind).toBe("lines");
    expect(script.recordHistory).toBe(false);
    expect(script.lines[0].text).toContain("台本夺舍测试");
    expect(parseLocalCommand("走 东", state())).toBeNull();
    expect(parseLocalCommand("看", state())).toBeNull();
  });
});
