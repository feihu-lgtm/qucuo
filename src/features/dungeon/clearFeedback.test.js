// #667/#668 地宫通关反馈：通关 run 写明所得、名器去向进结算日志（措辞分档测试在 ui/screens/duel）。
import { describe, expect, it } from "vitest";
import {
  applyMapBattleResult,
  deserializeMapRun,
  ensureDungeonWorld,
  moveRoom,
  serializeMapRun,
  startMapRun,
} from "../../domain/rules/dungeon/mapRun.js";
import { routeRoomAction } from "../../domain/rules/dungeon/actionRouter.js";
import { DUNGEON_DISTRICTS_ALL } from "../../domain/data/dungeon/districts.js";
import { settleMapRun } from "./logic.js";

const DK = "断鞍古驿";
const CFG = DUNGEON_DISTRICTS_ALL[DK];

function pathTo(map, from, to) {
  const prev = { [from]: null };
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === to) break;
    for (const [dir, nextRoom] of Object.entries(map.rooms[cur]?.exits || {})) {
      if (!(nextRoom in prev)) { prev[nextRoom] = [cur, dir]; queue.push(nextRoom); }
    }
  }
  const dirs = [];
  for (let cur = to; prev[cur]; cur = prev[cur][0]) dirs.unshift(prev[cur][1]);
  return dirs;
}

function killBoss(opts = {}) {
  const world = ensureDungeonWorld(DK, null, { time: 0 });
  let rs = startMapRun(DK, "s", { char: { hp: [9999, 9999] }, world, ...opts });
  for (const dir of pathTo(rs.map, rs.current, world.map.bossRoom)) rs = moveRoom(rs, dir).runState;
  const label = rs.map.rooms[rs.current].roomEvent.options[0].label;
  const fight = routeRoomAction(rs, label, { attrs: {} }).runState;
  return applyMapBattleResult(fight, { outcome: "win", playerHp: 9999 });
}

describe("通关所得与名器去向（#667/#668）", () => {
  it("击杀首领后 run 带 victoryNotes：首行写明伏诛与打通，且随存档往返保留", () => {
    const won = killBoss();
    expect(won.status).toBe("victory");
    expect(won.victoryNotes[0]).toContain(CFG.boss.name);
    expect(won.victoryNotes[0]).toContain("地宫已打通");
    expect(deserializeMapRun(serializeMapRun(won)).victoryNotes).toEqual(won.victoryNotes);
  });

  it("首通只出线索：提示文案点名名器与「再打通一回」，结算日志给出下一步", () => {
    const won = killBoss();
    const names = won.loot.items.map((i) => i?.name || i);
    expect(names).toContain(CFG.divineArm.clueItem);
    expect(names).not.toContain(CFG.divineArm.itemName);
    const clueNote = won.victoryNotes.find((line) => line.includes(CFG.divineArm.clueItem));
    expect(clueNote).toContain(CFG.divineArm.itemName);
    expect(clueNote).toContain("再打通一回");

    const state = { char: { name: "主角", money: 0, hp: [100, 100] }, inv: [], exp: 0, pot: 0, time: 0, flags: [] };
    const settled = settleMapRun(state, won, { now: 1 });
    const texts = settled.logs.map((l) => l.text);
    expect(texts.some((t) => t.includes("名器线索") && t.includes(CFG.divineArm.itemName))).toBe(true);
    expect(settled.changes.flags).toContain(CFG.clearFlag);
  });

  it("有过通关记录再打通：名器认主入囊，结算日志明说", () => {
    const won = killBoss({ flags: [CFG.clearFlag] });
    expect(won.loot.items.map((i) => i?.name || i)).toContain(CFG.divineArm.itemName);
    const state = { char: { name: "主角", money: 0, hp: [100, 100] }, inv: [], exp: 0, pot: 0, time: 0, flags: [CFG.clearFlag] };
    const settled = settleMapRun(state, won, { now: 1 });
    expect(settled.logs.some((l) => l.text.includes(`镇宫名器「${CFG.divineArm.itemName}」认主入囊`))).toBe(true);
    expect(settled.changes.inv.map((i) => i.name)).toContain(CFG.divineArm.itemName);
  });
});
