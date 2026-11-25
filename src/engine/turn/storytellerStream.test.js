import { describe, expect, it } from "vitest";
import { createStorytellerStream, splitStorytellerText } from "./storytellerStream.js";

describe("storytellerStream 锚点剥离", () => {
  it("实时剥除 ⟦F42_1⟧ 锚点不上屏，记录锚点段落", () => {
    const stream = createStorytellerStream();
    stream.push("才旦接过短刀⟦F42_1⟧，掂了掂。\n第二段⟦F42_2⟧收束。");
    const out = stream.finish();
    expect(out.screenText).toBe("才旦接过短刀，掂了掂。\n第二段收束。");
    expect(out.anchors).toEqual([
      { id: "F42_1", paragraph: 0 },
      { id: "F42_2", paragraph: 1 },
    ]);
  });

  it("锚点跨 chunk 到达也不泄漏半截", () => {
    const stream = createStorytellerStream();
    stream.push("他点头⟦F4");
    stream.push("2_1");
    stream.push("⟧。");
    const out = stream.finish();
    expect(out.screenText).toBe("他点头。");
    expect(out.anchors[0].id).toBe("F42_1");
  });

  it("检测到 \\n---SEAL--- 立即冻结屏幕，后续只进尾章缓冲", () => {
    const stream = createStorytellerStream();
    stream.push("正文一段。\n---SEAL---\n");
    const before = stream.screenText;
    stream.push('{"fills":{}}');
    const out = stream.finish();
    expect(out.sealed).toBe(true);
    expect(out.screenText).toBe("正文一段。");
    expect(out.screenText).toBe(before);
    expect(out.sealText).toBe('\n{"fills":{}}');
  });

  it("SEAL 标记跨 chunk 拆分也不上屏", () => {
    const stream = createStorytellerStream();
    stream.push("正文。\n---SE");
    stream.push("AL---\n{}");
    const out = stream.finish();
    expect(out.screenText).toBe("正文。");
    expect(out.sealText).toBe("\n{}");
  });

  it("无 SEAL 的正文全量上屏，sealed=false", () => {
    const out = splitStorytellerText("就是一段正文。");
    expect(out.screenText).toBe("就是一段正文。");
    expect(out.sealed).toBe(false);
    expect(out.sealText).toBe("");
  });

  it("onScreen 回调收到滚动全量文本", () => {
    const seen = [];
    const stream = createStorytellerStream({ onScreen: (t) => seen.push(t) });
    stream.push("第一段。");
    stream.finish();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.at(-1)).toBe("第一段。");
  });

  it("同一锚点重复出现只记一次", () => {
    const out = splitStorytellerText("⟦F1_1⟧甲⟦F1_1⟧乙");
    expect(out.anchors).toHaveLength(1);
  });
});
