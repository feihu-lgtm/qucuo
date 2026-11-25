import { describe, expect, it } from "vitest";
import { timeoutFallbackLine } from "./timeoutFallback.js";

describe("timeoutFallbackLine", () => {
  it("同输入恒同输出（纯函数，不掷骰不读时间）", () => {
    const args = { kind: "交谈", npc: { name: "才旦", personality: "爽朗直率" }, place: "鱼定村" };
    expect(timeoutFallbackLine(args)).toBe(timeoutFallbackLine(args));
  });

  it("动作类别优先：切磋/决斗类给绷紧句", () => {
    expect(timeoutFallbackLine({ kind: "切磋", npc: { name: "才旦" } })).toBe("才旦退了半步，手缓缓按上腰间兵刃。");
    expect(timeoutFallbackLine({ kind: "切磋" })).toBe("空气霎时绷紧，连风声都停了。");
  });

  it("交易类给算盘句，移动类带地名", () => {
    expect(timeoutFallbackLine({ kind: "交易", npc: { name: "老孙" } })).toContain("算盘");
    expect(timeoutFallbackLine({ kind: "移动", place: "鱼定村" })).toContain("鱼定村");
    expect(timeoutFallbackLine({ kind: "偷窃", npc: { name: "才旦" } })).toContain("并未留意");
  });

  it("类别认不出时按 NPC 性情标签给句", () => {
    expect(timeoutFallbackLine({ npc: { name: "老孙", personality: "精明算计" } })).toContain("算盘");
    expect(timeoutFallbackLine({ npc: { name: "才旦", personality: "爽朗直率" } })).toContain("咧嘴");
    expect(timeoutFallbackLine({ npc: { name: "呼延雪", personality: "冷傲" } })).toContain("懒得抬");
    expect(timeoutFallbackLine({ npc: { name: "大娘", personality: "温善" } })).toContain("温声");
  });

  it("性情认不出给通用 NPC 句，无 NPC 兜底环境句", () => {
    expect(timeoutFallbackLine({ npc: { name: "才旦", personality: "普通" } })).toBe("才旦抬眼看你，似在等你把话说完。");
    expect(timeoutFallbackLine({})).toBe("风雪掠过檐角，四下里静了一瞬。");
    expect(timeoutFallbackLine()).toBe("风雪掠过檐角，四下里静了一瞬。");
  });

  it("过渡句不涉状态变更：无 NPC 时类别句降级为环境描写", () => {
    const line = timeoutFallbackLine({ kind: "赠送" });
    expect(line).toBe("四下里静了一瞬。");
  });
});
