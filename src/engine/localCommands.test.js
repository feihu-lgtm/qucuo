import { afterEach, describe, expect, it } from "vitest";
import { loadSquares } from "../domain/map/mapSquares.js";
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
    expect(parseLocalCommand(command, state(), { surface: "cli" })).toMatchObject({
      kind: "lines",
      lines: expect.arrayContaining([{ t: "sys", text: "── 命令列表 ──" }]),
    });
  });

  it("formats status from the effective state", () => {
    const result = parseLocalCommand("状态", state(), { surface: "cli" });
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
    expect(parseLocalCommand("背包", current, { surface: "cli" }).lines[1].text).toBe("  · [已装备] 长剑（蓝）");
    expect(parseLocalCommand("武学", current, { surface: "cli" }).lines[1].text).toBe("  ▶ 铁指功·小成（绿品）");
    expect(parseLocalCommand("装备", current, { surface: "cli" }).lines[1].text).toBe("  武器：长剑(蓝)");
  });

  it("returns cached room look as a state result and consumes one turn", () => {
    loadSquares({ 鱼定村: { day: 0, lookText: "村口的石阶旁长着青苔。" } });
    const result = parseLocalCommand("看", state(), { surface: "cli" });

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
    const script = parseLocalCommand("#testscript village2_jieshixiajiu quest_village2_s2", state(), { surface: "cli" });
    expect(script.kind).toBe("lines");
    expect(script.recordHistory).toBe(false);
    expect(script.lines[0].text).toContain("台本夺舍测试");
    expect(parseLocalCommand("走 东", state())).toBeNull();
    expect(parseLocalCommand("看", state())).toBeNull();
  });

  it("matches main's web-local command behavior", () => {
    const current = state();
    expect(parseLocalCommand("帮助", current, { surface: "web" }).lines).toEqual([
      { t: "sys", text: "  ▸ 方向 n/s/e/w 移动 · look 查看 · 输入框上方可切换「◈行动 / ◎对话 / ◆私聊旁白」三种模式" },
      { t: "sys", text: "  ▸ 对话模式：只跟房间里的人说话，不移动、不消耗回合；私聊旁白：直接找旁白聊天，同样不消耗回合" },
      { t: "sys", text: "  ▸ 完整玩法说明见右上角 ⚙ 设置 →「玩法说明」" },
    ]);
    for (const command of ["状态", "背包", "武学", "装备"]) {
      expect(parseLocalCommand(command, current, { surface: "web" })).toBeNull();
    }
    expect(parseLocalCommand("看", current, { surface: "web" })).toBeNull();
    expect(parseLocalCommand("look", current, { surface: "web" })).toBeNull();
    expect(parseLocalCommand("走 东", current, { surface: "web" })).toBeNull();

    loadSquares({ 鱼定村: { day: 0, lookText: "村口的石阶旁长着青苔。" } });
    expect(parseLocalCommand("look", current, { surface: "web" }).result.logs).toEqual([
      { t: "cmd", text: "> look" },
      { t: "desc", text: "  村口的石阶旁长着青苔。" },
    ]);
  });
});
