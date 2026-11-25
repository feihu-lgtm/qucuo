// 涌现过渡复接管线集成测试：SEAL 校验产物接回 p 后，recordRumors/materializeEmergence/
// writeRoom 原管线接管。writeRoom 测试用真实固定地图分支与移动分支，room 入参
// 不含登场者（真实原地互动场景），不得用 p.room.npcs 冒充 state。
import { describe, expect, it } from "vitest";
import { validateEmergenceSeal, recordRumoredNpcs } from "../../../domain/rules/npc/npcEmergence.js";
import { recordRumors } from "./rumors.js";
import { materializeEmergence } from "./emergence.js";
import { writeRoom } from "./roomWrite.js";

const VT = recordRumoredNpcs({ 世界: {}, 角色: {} }, ["磨坊阿福"], "才旦提过");
const SCREEN = "磨坊阿福推门进来，憨笑着搓手。";

function makeP() {
  const check = validateEmergenceSeal({
    mentionedNewNpcs: [],
    emergedNpc: { name: "磨坊阿福", description: "磨坊学徒，憨厚老实" },
  }, { screenText: SCREEN, varTree: VT, roomNpcs: [], playerName: "少侠" });
  const roomNpcs = [];
  if (check.emergedNpc) roomNpcs.push({ name: check.emergedNpc.name, brief: check.emergedNpc.description.slice(0, 15) });
  return {
    emergedNpcName: check.emergedNpc?.name,
    emergedNpcDescription: check.emergedNpc?.description,
    room: { npcs: roomNpcs },
  };
}

const TRACE = { traceStep: () => {} };
// 真实原地互动场景：鱼定村是固定地图，当前 room.npcs 里没有磨坊阿福
const BASE_ROOM = { name: "鱼定村", desc: "村口", exits: ["w", "n"], npcs: [{ name: "才旦" }], items: [] };

describe("涌现复接管线·真实 writeRoom 分支", () => {
  it("固定地图原地互动分支：登场者 upsert 进 r.npcs，writeRoom 后仍在屋里", () => {
    const p = makeP();
    const em = materializeEmergence({ p, luck: 5, innerRoomName: null, npcState: {} });
    // 传闻清除
    const vt2 = em.changes.varTree(VT);
    expect(vt2.世界.传闻人物?.磨坊阿福).toBeUndefined();
    // materializeEmergence upsert：当前 room.npcs 没有此人也能进屋
    const roomAfterEm = em.changes.room(BASE_ROOM);
    const emerged = roomAfterEm.npcs.find((n) => n.name === "磨坊阿福");
    expect(emerged).toBeTruthy();
    // brief 来自 p.room.npcs 最小形状（description 前 15 字），不得为空
    expect(emerged.brief).toBe("磨坊学徒，憨厚老实");
    expect(roomAfterEm.npcs.some((n) => n.name === "才旦")).toBe(true);
    // writeRoom 固定地图分支：名单锁定 r.npcs，只回填战斗数据——登场者必须活下来
    const wr = writeRoom({
      isTalk: false, lockedDestName: null, p, room: BASE_ROOM, innerRoomName: null,
      roomMap: {}, outerDepart: null, mapData: {}, pendDir: null, freshNpcData: new Map(),
    }, TRACE);
    const final = wr.changes.room(roomAfterEm);
    expect(final.npcs.some((n) => n.name === "磨坊阿福")).toBe(true);
    expect(final.name).toBe("鱼定村");
  });

  it("移动分支（lockedDestName 首访）：登场者经 arrivalNpcs 随行抵达目的地", () => {
    const p = makeP();
    const wr = writeRoom({
      isTalk: false, lockedDestName: "喇嘛庙", p, room: BASE_ROOM, innerRoomName: null,
      roomMap: {}, outerDepart: null, mapData: {}, pendDir: null, freshNpcData: new Map(),
    }, TRACE);
    // 首访无缓存：arrivalNpcs 采用 p.room.npcs 剔除出发房间原有成员后的名单
    expect(wr.changes.room.npcs.some((n) => n.name === "磨坊阿福")).toBe(true);
    // 出发房间原有者才旦不带走
    expect(wr.changes.room.npcs.some((n) => n.name === "才旦")).toBe(false);
  });

  it("upsert 登场者带确定性 id，且不继承 p.room.npcs 里被场景正文推导的战斗数据", () => {
    const p = makeP();
    // 模拟 fixateNpcs 跑过后：p.room.npcs 条目被固化上「brief+整段正文」推导的战斗数据。
    // 正文形容别人是掌门，若这份数据并入 fixed（ensureNpcCombatData 见已有数据直接跳过），
    // 磨坊学徒就会被错定成掌门战力——必须只并 name/brief。
    p.room.npcs = p.room.npcs.map((n) => ({
      ...n, combatStats: { atk: 999 }, moveset: ["掌门绝技"], carriedItems: [{ name: "掌门信物" }], special: { 臂力: 99 },
    }));
    const em = materializeEmergence({ p, luck: 5, innerRoomName: null, npcState: {} });
    const roomAfter = em.changes.room(BASE_ROOM);
    const emerged = roomAfter.npcs.find((n) => n.name === "磨坊阿福");
    expect(emerged.id).toBe("emerged_磨坊阿福");
    expect(emerged.brief).toBe("磨坊学徒，憨厚老实");
    // 战斗数据由 description 映射重新定量，不是正文推导的 999/掌门绝技
    expect(emerged.combatStats?.atk).not.toBe(999);
    expect(emerged.moveset).not.toContain("掌门绝技");
    expect((emerged.carriedItems || []).some((i) => i.name === "掌门信物")).toBe(false);
  });

  it("非法 emergedNpc（无传闻/命中排除名单）不进 p.room.npcs", () => {
    const noRumor = validateEmergenceSeal({ emergedNpc: { name: "陌生人", description: "货郎" } },
      { screenText: SCREEN, varTree: VT, roomNpcs: [], playerName: "少侠" });
    expect(noRumor.emergedNpc).toBeNull();
    // 脏传闻防护：即便传闻册里有玩家同名脏数据，登场也被排除名单拦下
    const dirtyVt = recordRumoredNpcs({ 世界: {} }, ["少侠"], "脏数据");
    const dirty = validateEmergenceSeal({ emergedNpc: { name: "少侠", description: "游侠" } },
      { screenText: "少侠走进来", varTree: dirtyVt, roomNpcs: [], playerName: "少侠" });
    expect(dirty.emergedNpc).toBeNull();
    expect(dirty.notes.join()).toContain("排除名单");
  });

  it("recordRumors 复用现有账本：p.mentionedNewNpcs 入传闻册", () => {
    const check = validateEmergenceSeal({ mentionedNewNpcs: ["李二狗"] },
      { screenText: SCREEN + "李二狗蹲在墙角。", varTree: VT, roomNpcs: [], playerName: "少侠" });
    expect(check.mentionedNewNpcs).toContain("李二狗");
    const out = recordRumors({ p: { mentionedNewNpcs: check.mentionedNewNpcs }, narrativeText: SCREEN });
    const vt2 = out.changes.varTree(VT);
    expect(vt2.世界.传闻人物.李二狗).toBeTruthy();
    expect(vt2.世界.传闻人物.李二狗.context).toBe(SCREEN);
  });
});
