import { describe, expect, it } from "vitest";
import { RESIDENT_NPCS } from "./residentNpcs.js";
import { getContent } from "../../rules/content/registry.js";

const ADDED = {
  黑风寨: { 贡布: "寨内公共区", 旺堆: "寨后岩洞", 彭老四: "寨内公共区" },
  锦官城: { 孙文墨: "都事府", 裴九江: "锦官武馆", 宋小乙: "清风茶馆", 沈归尘: "都事府" },
};

describe("合稿有名有身份的角色补进驻场", () => {
  for (const [district, people] of Object.entries(ADDED)) {
    const rooms = getContent("district", district).rooms;
    for (const [name, room] of Object.entries(people)) {
      it(`${district}·${name} 驻在 ${room}，带档位和身份`, () => {
        const npc = RESIDENT_NPCS[district].find((n) => n.name === name);
        expect(npc).toBeTruthy();
        expect(npc.innerRoom).toBe(room);
        expect(rooms[room]).toBeTruthy();
        expect(Number.isInteger(npc.levelCap) && npc.levelCap >= 0 && npc.levelCap <= 5).toBe(true);
        expect(npc.brief.length).toBeGreaterThan(4);
      });
    }
  }

  it("全表驻场人物 id 不重复，同据点不重名", () => {
    const all = Object.values(RESIDENT_NPCS).flat();
    expect(new Set(all.map((n) => n.id)).size).toBe(all.length);
    for (const list of Object.values(RESIDENT_NPCS)) {
      expect(new Set(list.map((n) => n.name)).size).toBe(list.length);
    }
  });
});
