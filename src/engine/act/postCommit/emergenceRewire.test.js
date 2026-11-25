// 涌现过渡复接管线集成测试：SEAL 校验产物接回 p 后，recordRumors/fixateNpcs/
// materializeEmergence/writeRoom 原管线接管——合法登场者真正进 room.npcs 且传闻清除，
// 非法项不进；最小形状不编数值，战斗数据由系统侧固化补齐。
import { describe, expect, it } from "vitest";
import { validateEmergenceSeal, recordRumoredNpcs } from "../../../domain/rules/npc/npcEmergence.js";
import { recordRumors } from "./rumors.js";
import { materializeEmergence } from "./emergence.js";
import { fixateNpcs } from "./npcFixation.js";

const VT = recordRumoredNpcs({ 世界: {}, 角色: {} }, ["磨坊阿福"], "才旦提过");
const SCREEN = "磨坊阿福推门进来，憨笑着搓手。";

function makeP() {
  // 复刻 runTurn 的接回逻辑（最小形状并入 room.npcs）
  const check = validateEmergenceSeal({
    mentionedNewNpcs: [],
    emergedNpc: { name: "磨坊阿福", description: "磨坊学徒，憨厚老实" },
  }, { screenText: SCREEN, varTree: VT, roomNpcs: [], playerName: "少侠" });
  const roomNpcs = [];
  if (check.emergedNpc) roomNpcs.push({ name: check.emergedNpc.name, brief: check.emergedNpc.description.slice(0, 15) });
  return {
    p: {
      emergedNpcName: check.emergedNpc?.name,
      emergedNpcDescription: check.emergedNpc?.description,
      room: { npcs: roomNpcs },
    },
    check,
  };
}

describe("涌现复接管线", () => {
  it("合法 emergedNpc 经 fixateNpcs 固化进 room.npcs、materializeEmergence 替换且清传闻", () => {
    const { p } = makeP();
    expect(p.emergedNpcName).toBe("磨坊阿福");
    // fixateNpcs：最小形状不编数值，系统侧 ensureNpcCombatData 补战斗数据
    const fixed = fixateNpcs({
      p, room: { name: "鱼定村", npcs: [] }, innerRoomName: null, narrativeText: SCREEN,
      varTree: VT, time: 10, systemAcceptedNames: new Set(["磨坊阿福"]), luck: 5, npcState: {},
    });
    expect(fixed).toBeTruthy();
    // materializeEmergence：替换最小形状为完整实体 + 清传闻
    const em = materializeEmergence({ p, luck: 5, innerRoomName: null, npcState: {} });
    expect(em).toBeTruthy();
    const vt2 = em.changes.varTree(VT);
    expect(vt2.世界.传闻人物?.磨坊阿福).toBeUndefined();
    const room2 = em.changes.room({ name: "鱼定村", npcs: p.room.npcs });
    const npc = room2.npcs.find((n) => n.name === "磨坊阿福");
    expect(npc).toBeTruthy();
    // 定性描述进人格画像，数值由系统映射——不带 SEAL 传的任何数值字段
    expect(npc.personalityProfile).toBeTruthy();
  });

  it("非法 emergedNpc（无传闻）不进 p.room.npcs", () => {
    const check = validateEmergenceSeal({ emergedNpc: { name: "陌生人", description: "货郎" } },
      { screenText: SCREEN, varTree: VT, roomNpcs: [], playerName: "少侠" });
    expect(check.emergedNpc).toBeNull();
  });

  it("recordRumors 复用现有账本：p.mentionedNewNpcs 入传闻册", () => {
    const check = validateEmergenceSeal({ mentionedNewNpcs: ["生面孔李二狗".slice(-3)] },
      { screenText: SCREEN + "李二狗蹲在墙角。", varTree: VT, roomNpcs: [], playerName: "少侠" });
    expect(check.mentionedNewNpcs).toContain("李二狗");
    const out = recordRumors({ p: { mentionedNewNpcs: check.mentionedNewNpcs }, narrativeText: SCREEN });
    const vt2 = out.changes.varTree(VT);
    expect(vt2.世界.传闻人物.李二狗).toBeTruthy();
    expect(vt2.世界.传闻人物.李二狗.context).toBe(SCREEN);
  });
});
