import { describe, expect, it } from "vitest";
import { findNpcObject } from "./npcLookup.js";

describe("夜班急修③：findNpcObject 全链路解析非裸壳", () => {
  it("常驻人物表命中——完整人设非裸壳", () => {
    const npc = findNpcObject({ room: { npcs: [] } }, "老孙");
    expect(npc.name).toBe("老孙");
    expect(npc.personality || npc.archetype || npc.bio || Object.keys(npc).length > 1).toBeTruthy();
    expect(Object.keys(npc).length).toBeGreaterThan(1);
  });
  it("在场名单优先；查无此人给裸壳兜底", () => {
    const present = { name: "自定义", personality: "在场性情" };
    expect(findNpcObject({ room: { npcs: [present] } }, "自定义").personality).toBe("在场性情");
    expect(findNpcObject({ room: { npcs: [] } }, "不存在的人")).toEqual({ name: "不存在的人" });
  });
  it("游走池/冒险者池命中不带裸壳", () => {
    const { NPC_POOL } = require_npcpool();
    if (NPC_POOL.length) {
      const npc = findNpcObject({ room: { npcs: [] } }, NPC_POOL[0].name);
      expect(Object.keys(npc).length).toBeGreaterThan(1);
    }
  });
});
// 静态 import 防循环——直接读模块
import { NPC_POOL as _POOL } from "../../data/npc/npcPool.js";
function require_npcpool() { return { NPC_POOL: _POOL }; }
