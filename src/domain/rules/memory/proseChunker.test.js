import { describe, expect, it } from "vitest";
import { splitProseIntoChunks, stripOtherInnerThoughts } from "./proseChunker.js";

describe("stripOtherInnerThoughts 四类归属", () => {
  it("视角人心理（你/少侠邻近）：保留", () => {
    const text = "你握紧剑柄，*绝不能在这里倒下*，迎面而上。";
    expect(stripOtherInnerThoughts(text, "少侠")).toBe(text);
  });

  it("明确他人心理（第三人称邻近）：剥除", () => {
    const text = "呼延雪将剑拍在桌上，他*这蠢材若死在山下倒省心*，冷冷瞪过来。";
    const out = stripOtherInnerThoughts(text, "少侠");
    expect(out).not.toContain("这蠢材");
    expect(out).toContain("呼延雪将剑拍在桌上");
    expect(out).toContain("冷冷瞪过来");
  });

  it("紧邻心理动词（心想/暗道）：剥除", () => {
    const text = "卓玛心想*这人倒有几分意思*，转身斟茶。";
    const out = stripOtherInnerThoughts(text, "少侠");
    expect(out).not.toContain("几分意思");
  });

  it("无归属证据：拿不准保留", () => {
    const text = "雪落无声。*天地茫茫，何处是归途。*远处传来钟声。";
    expect(stripOtherInnerThoughts(text, "少侠")).toBe(text);
  });

  it("viewerName 邻近时压过更远的他人代词", () => {
    const text = "他瞪着你，你*不能退*，拔剑。";
    expect(stripOtherInnerThoughts(text, "少侠")).toBe(text);
  });
});

describe("splitProseIntoChunks", () => {
  it("按自然段切分、id 契约、锚点剥离进 anchorFactIds", () => {
    const chunks = splitProseIntoChunks(
      "第一段叙事⟦F7_1⟧。\n\n第二段叙事。\n\n第三段带锚⟦F7_2⟧尾。",
      { turn: 7, location: "雪山派·演武场", witnesses: ["主角", "呼延雪"], anchoredFacts: ["F7_1", "F7_2"] },
    );
    expect(chunks).toHaveLength(3);
    expect(chunks[0].id).toBe("P7_1");
    expect(chunks[0].kind).toBe("raw_memory");
    expect(chunks[0].rawText).not.toContain("⟦");
    expect(chunks[0].anchorFactIds).toEqual(["F7_1"]);
    expect(chunks[0].importance).toBe(2); // 带锚=要紧
    expect(chunks[1].importance).toBe(1);
    expect(chunks[0].witnesses).toEqual(["主角", "呼延雪"]);
    expect(chunks[0].entities).toEqual(["呼延雪"]); // 主角不进 entities
    expect(chunks[0].location).toBe("雪山派·演武场");
  });

  it("publicText 剥他人心理、rawText 保留原文", () => {
    const chunks = splitProseIntoChunks(
      "他*心中暗喜*，抱拳行礼。",
      { turn: 1, location: "鱼定村", witnesses: ["*"] },
    );
    expect(chunks[0].publicText).not.toContain("心中暗喜");
    expect(chunks[0].rawText).toContain("*心中暗喜*");
  });

  it("空正文/纯锚段不出 chunk", () => {
    expect(splitProseIntoChunks("", { turn: 1, location: "x" })).toEqual([]);
    expect(splitProseIntoChunks("⟦F1_1⟧", { turn: 1, location: "x" })).toEqual([]);
  });

  it("witnesses 缺省公共可见", () => {
    const chunks = splitProseIntoChunks("一段。", { turn: 1, location: "x" });
    expect(chunks[0].witnesses).toEqual(["*"]);
  });
});
