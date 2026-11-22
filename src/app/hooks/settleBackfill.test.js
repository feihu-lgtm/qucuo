import { describe, expect, it, vi } from "vitest";
import { settleInBackground } from "./settleBackfill.js";

function harness({ ask = vi.fn(async () => "掌柜拨了拨算盘，把银票递过来。"), canAsk = () => true, npcs = [] } = {}) {
  let log = [{ t: "cmd", text: "> 取钱" }];
  let time = 10;
  let convo = [];
  let varTree = {};
  const deps = {
    addLog: (entries) => { log = [...log, ...entries]; },
    setLog: (update) => { log = update(log); },
    setTime: (update) => { time = update(time); },
    setConvo: (update) => { convo = update(convo); },
    setVarTree: (update) => { varTree = update(varTree); },
    jotNote: vi.fn(),
    noteAction: vi.fn(),
    getState: () => ({ room: { name: "钱庄", npcs }, time }),
    ask,
    canAsk,
  };
  return { deps, ask, get: () => ({ log, time, convo, varTree }) };
}

describe("settleInBackground", () => {
  it("事实行先落、时辰 +1、事实登记，描写回来插到事实行下面", async () => {
    const h = harness({ npcs: [{ name: "钱掌柜" }] });
    const pending = settleInBackground("在钱庄取出银两30两（含利息）", {}, h.deps);

    const before = h.get();
    expect(before.log.at(-1)).toMatchObject({ t: "cmd", text: "> 在钱庄取出银两30两（含利息）", fillSlot: 0 });
    expect(before.time).toBe(11);
    expect(before.convo).toEqual([
      { role: "user", content: "在钱庄取出银两30两（含利息）" },
      { role: "assistant", content: "在钱庄取出银两30两（含利息）", memory: "在钱庄取出银两30两（含利息）", turn: 10 },
    ]);
    expect(JSON.stringify(before.varTree)).toContain("钱掌柜");
    expect(h.deps.jotNote).toHaveBeenCalledWith(expect.objectContaining({ text: "在钱庄取出银两30两（含利息）" }));
    expect(h.deps.noteAction).toHaveBeenCalledWith("settle");

    await expect(pending).resolves.toBe(true);
    expect(h.ask).toHaveBeenCalledWith(expect.any(String), expect.stringContaining("地点：钱庄"), expect.objectContaining({ callLabel: "结算描写" }));
    expect(h.get().log.at(-1)).toMatchObject({ t: "desc", text: "  掌柜拨了拨算盘，把银票递过来。", fillProse: true });
  });

  it("结果另给了事实句就用它", () => {
    const h = harness({ canAsk: () => false });
    settleInBackground("在灶房生火下厨。这一番炮制，做出一道「松茸汤」。请写一两句。", { settleFact: "在灶房用松茸下厨，做出一道「松茸汤」，趁热吃了" }, h.deps);
    expect(h.get().log.at(-1).text).toBe("> 在灶房用松茸下厨，做出一道「松茸汤」，趁热吃了");
    expect(h.get().convo.at(-1).memory).toBe("在灶房用松茸下厨，做出一道「松茸汤」，趁热吃了");
  });

  it("没配 API 时只留事实行", async () => {
    const h = harness({ canAsk: () => false });
    await expect(settleInBackground("住下上房，花费5两", {}, h.deps)).resolves.toBe(false);
    expect(h.ask).not.toHaveBeenCalled();
    expect(h.get().log.at(-1).text).toBe("> 住下上房，花费5两");
    expect(h.get().time).toBe(11);
  });

  it("描写回来前回滚了，就不插回", async () => {
    let release;
    const h = harness({ ask: vi.fn(() => new Promise((resolve) => { release = resolve; })) });
    const pending = settleInBackground("点了一壶酒，花费2两", {}, h.deps);
    h.deps.setLog(() => [{ t: "cmd", text: "> 取钱" }]);
    release("小二端上酒来。");
    await pending;
    expect(h.get().log).toEqual([{ t: "cmd", text: "> 取钱" }]);
  });
});
