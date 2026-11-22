import { describe, expect, it } from "vitest";
import { buildLookNarrationPrompt, roomLookFact } from "./lookBrief.js";

describe("roomLookFact", () => {
  it("列出地名、出口与在场人物", () => {
    expect(roomLookFact({ place: "鱼定村", exits: { n: "喇嘛庙", e: "雅江" }, npcs: [{ name: "扎西" }] }))
      .toBe("此处是鱼定村；出口：北·喇嘛庙、东·雅江；在场：扎西");
  });
  it("导入剧本房间的出口数组按方向显示", () => {
    expect(roomLookFact({ place: "客栈", exits: ["n", "s"] })).toBe("此处是客栈；出口：北、南");
    expect(buildLookNarrationPrompt({ place: "客栈", exits: ["n"] }).user).toContain("出口：北");
  });
  it("无出口无人时照实写", () => {
    expect(roomLookFact({ place: "密室" })).toBe("此处是密室；出口：无");
  });
});

describe("buildLookNarrationPrompt", () => {
  it("只给系统已知的场景，不让 AI 添人添物", () => {
    const { sys, user } = buildLookNarrationPrompt({ place: "鱼定村", base: "三溪交汇", exits: { n: "喇嘛庙" }, npcs: [] });
    expect(sys).toContain("不添新人物");
    expect(user).toContain("地点：鱼定村");
    expect(user).toContain("底本：三溪交汇");
    expect(user).toContain("在场：无人");
  });
});
