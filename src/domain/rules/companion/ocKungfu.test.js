import { describe, expect, it } from "vitest";
import { ocSignatureMoves, ocSignatureMovesByName } from "./ocKungfu.js";
import { ensureNpcCombatData } from "../npc/npcGeneration.js";
import { createImportedCompanion } from "./companion.js";
import { buildLeopardUnit } from "../combat/teamUnits.js";
import { MOVE_TYPE } from "../combat/moveTypes.js";
import { ADVENTURER_POOL_IP } from "../../data/dungeon/adventurersIP.js";
import { ADVENTURER_POOL } from "../../data/dungeon/adventurers.js";

const DUODUO = ADVENTURER_POOL_IP.find((a) => a.name === "元朵朵");
const byName = (moveset, name) => moveset.find((m) => m.name === name);

describe("OC kungfu.moves → 招式槽", () => {
  it("元朵朵：漫天花雨撒金钱进攻击槽，抱头蹲防进防御槽（不再被塞进状态槽）", () => {
    const sig = ocSignatureMoves(DUODUO);
    expect(sig.攻击.name).toBe("漫天花雨撒金钱");
    expect(sig.防御.name).toBe("抱头蹲防");
    expect(sig.状态.name).not.toBe("抱头蹲防");
  });

  it("没写 kungfu 的人返回 null；写了招式的 OC 每招都能落进某个槽", () => {
    expect(ocSignatureMoves({ name: "路人" })).toBeNull();
    expect(ocSignatureMovesByName("没这个人")).toBeNull();
    for (const adv of [...ADVENTURER_POOL, ...ADVENTURER_POOL_IP]) {
      const moves = adv.kungfu?.moves;
      if (!moves?.length) continue;
      const sig = ocSignatureMoves(adv);
      const slotted = new Set(Object.values(sig).map((s) => s.name));
      for (const m of moves) expect(slotted.has(m.name), `${adv.name}/${m.name}`).toBe(true);
    }
  });

  it("明写回血的招进疗伤槽", () => {
    const sig = ocSignatureMoves({ kungfu: { moves: [{ name: "玉手回春", desc: "激发神树之气，恢复自身与同伴气血" }] } });
    expect(sig.疗伤.name).toBe("玉手回春");
  });
});

describe("元朵朵本人当对手：切磋招组用她自己的招式", () => {
  it("房间里的元朵朵（ensureNpcCombatData）出的是漫天花雨/抱头蹲防，不是通用随机招", () => {
    const npc = ensureNpcCombatData({ id: "npc_duoduo", name: "元朵朵", levelCap: 1 }, { levelCap: 1 });
    const attack = byName(npc.moveset, "漫天花雨撒金钱");
    const defense = byName(npc.moveset, "抱头蹲防");
    expect(attack?.type).toBe(MOVE_TYPE.ATTACK);
    expect(defense?.type).toBe(MOVE_TYPE.DEFENSE);
    expect(npc.moveset.every((m) => m.signature)).toBe(true);
  });

  it("入队后的团战队友单位同样带她的招式", () => {
    const comp = createImportedCompanion({ name: "元朵朵", levelCap: 1, signatureMoves: ocSignatureMoves(DUODUO) });
    const unit = buildLeopardUnit(comp);
    expect(unit.movesetLocal.map((m) => m.name)).toEqual(expect.arrayContaining(["漫天花雨撒金钱", "抱头蹲防"]));
    expect(byName(unit.movesetLocal, "抱头蹲防").type).toBe(MOVE_TYPE.DEFENSE);
  });
});
