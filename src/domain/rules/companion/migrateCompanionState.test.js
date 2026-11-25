import { describe, expect, it } from "vitest";
import {
  createImportedCompanion, migrateCompanionState, stationCompanion, setActiveCompanion,
  unlockImportedCompanion, unlockFollowerCompanion, unlockSnowLeopard,
} from "./companion.js";
import { ocSignatureMoves } from "./ocKungfu.js";
import { migrateLegacySnapshot } from "../npc/legacyContent.js";
import { generateNpcMoveset } from "../npc/npcMovesets.js";
import { ensureNpcCombatData } from "../npc/npcGeneration.js";
import { MOVE_TYPE } from "../combat/moveTypes.js";
import { ADVENTURER_POOL_IP } from "../../data/dungeon/adventurersIP.js";

const DUODUO = ADVENTURER_POOL_IP.find((a) => a.name === "元朵朵");

// 改版前入队的元朵朵：旧分槽把「抱头蹲防」塞进状态槽、没有版本戳、没有铁伯槽
const oldSave = () => {
  const data = createImportedCompanion({
    name: "元朵朵", levelCap: 1,
    signatureMoves: { 攻击: { name: "漫天花雨撒金钱" }, 状态: { name: "抱头蹲防" } },
  });
  delete data.ocMovesRev;
  return { imported_元朵朵: { unlocked: true, active: true, data, imported: true, label: "元朵朵", beast: false } };
};
const names = (data) => data.moveset.map((m) => m.name);

describe("migrateCompanionState：旧档里已入队的元朵朵", () => {
  it("招式按 kungfu 重建，铁伯槽补上", () => {
    const old = oldSave();
    expect(old.imported_元朵朵.data.moveset.find((m) => m.name === "抱头蹲防").type).toBe(MOVE_TYPE.STATUS);
    const cs = migrateCompanionState(old);
    const duo = cs.imported_元朵朵.data;
    expect(names(duo)).toEqual(expect.arrayContaining(["漫天花雨撒金钱", "抱头蹲防"]));
    expect(duo.moveset.find((m) => m.name === "抱头蹲防").type).toBe(MOVE_TYPE.DEFENSE);
    // 数值/血量/七维不动
    expect(duo.special).toEqual(old.imported_元朵朵.data.special);
    expect(duo.combatStats).toEqual(old.imported_元朵朵.data.combatStats);
    expect(cs.imported_铁伯).toMatchObject({ unlocked: true, active: false, servantOf: "imported_元朵朵", mute: true, label: "铁伯" });
    expect(cs.imported_元朵朵.active).toBe(true);
  });

  it("幂等：再跑一遍同一引用；新入队的存档不被改动", () => {
    const once = migrateCompanionState(oldSave());
    expect(migrateCompanionState(once)).toBe(once);
    const fresh = unlockFollowerCompanion(
      unlockImportedCompanion({}, { name: "元朵朵", levelCap: 1, signatureMoves: ocSignatureMoves(DUODUO) }), DUODUO,
    );
    expect(migrateCompanionState(fresh)).toBe(fresh);
  });

  it("朵朵已留守：补建的铁伯跟她同一留守点", () => {
    const old = oldSave();
    const benched = setActiveCompanion({ ...old, snowLeopard: unlockSnowLeopard({}).snowLeopard }, "snowLeopard");
    const stationed = stationCompanion(benched, "imported_元朵朵", { district: "鱼定村", roomId: "客栈", roomName: "客栈", since: 9 });
    const cs = migrateCompanionState(stationed);
    expect(cs.imported_铁伯.stationed).toEqual(cs.imported_元朵朵.stationed);
    expect(cs.imported_铁伯.stationed.since).toBe(9);
  });

  it("非 OC 伙伴/雪豹/空状态原样放行", () => {
    const cs = unlockSnowLeopard({});
    expect(migrateCompanionState(cs)).toBe(cs);
    expect(migrateCompanionState(null)).toBeNull();
    const card = { imported_路人: { unlocked: true, active: true, imported: true, label: "路人", data: createImportedCompanion({ name: "路人" }) } };
    expect(migrateCompanionState(card)).toBe(card);
  });
});

describe("migrateLegacySnapshot：旧档里房间里的 OC", () => {
  const genericDuoduo = () => ({ id: "npc_duoduo", name: "元朵朵", levelCap: 1, moveset: generateNpcMoveset({ name: "元朵朵" }, { levelCap: 1 }) });
  const snap = (npc) => ({
    preset: { id: "village" }, char: { name: "我", hp: [1, 1] },
    room: { name: "鱼定村", npcs: [npc] },
    roomMap: { 鱼定村: { npcs: [npc] } },
    companionState: oldSave(),
  });

  it("冻结的是通用随机招（无 signature 标记）→ 重派生为她自己的招；companionState 一并迁", () => {
    const s = migrateLegacySnapshot(snap(genericDuoduo()));
    for (const npc of [s.room.npcs[0], s.roomMap.鱼定村.npcs[0]]) {
      expect(npc.moveset.map((m) => m.name)).toEqual(expect.arrayContaining(["漫天花雨撒金钱", "抱头蹲防"]));
      expect(npc.moveset.every((m) => m.signature)).toBe(true);
    }
    expect(s.companionState.imported_铁伯).toBeTruthy();
  });

  it("已是专属招的不动；不是 OC 的不动；重复迁移结果一致", () => {
    const sigNpc = ensureNpcCombatData({ id: "npc_duoduo", name: "元朵朵", levelCap: 1 }, { levelCap: 1 });
    const s1 = migrateLegacySnapshot(snap(sigNpc));
    expect(s1.room.npcs[0].moveset).toEqual(sigNpc.moveset);
    const bandit = { id: "b", name: "拦路山贼", levelCap: 1, moveset: generateNpcMoveset({ name: "拦路山贼" }, { levelCap: 1 }) };
    expect(migrateLegacySnapshot(snap(bandit)).room.npcs[0].moveset).toEqual(bandit.moveset);
    const twice = migrateLegacySnapshot(migrateLegacySnapshot(snap(genericDuoduo())));
    const once = migrateLegacySnapshot(snap(genericDuoduo()));
    expect(twice.room.npcs[0].moveset.map((m) => m.name)).toEqual(once.room.npcs[0].moveset.map((m) => m.name));
    expect(Object.keys(twice.companionState).sort()).toEqual(Object.keys(once.companionState).sort());
  });
});
