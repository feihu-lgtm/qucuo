import { describe, expect, it } from "vitest";
import { parseDuelOpponent, splitNarrativeParagraphs } from "./dialogueModel.js";

const NAMES = ["元朵朵", "雪豹", "格桑顿珠", "才旦"];

describe("dialogueModel", () => {
  it("按换行拆段并识别有明确说话人的「」对白段", () => {
    const text = [
      "你直起靠在夯土墙上的身子，伸手探进行囊。",
      "元朵朵踮脚从门槛探出身来，笑着摇了摇指尖铜铃，「金鸟辰时初就落过檐头啦。」",
      "雪豹卧在青石上懒得掀眼，「青稞见底了。」",
    ].join("\n");

    const blocks = splitNarrativeParagraphs(text, NAMES);
    expect(blocks).toEqual([
      { kind: "prose", text: "你直起靠在夯土墙上的身子，伸手探进行囊。" },
      { kind: "dialogue", speaker: "元朵朵", text: "元朵朵踮脚从门槛探出身来，笑着摇了摇指尖铜铃，「金鸟辰时初就落过檐头啦。」" },
      { kind: "dialogue", speaker: "雪豹", text: "雪豹卧在青石上懒得掀眼，「青稞见底了。」" },
    ]);
  });

  it("玩家自己对某人说话时保持纯文，不误挂对方头像", () => {
    const blocks = splitNarrativeParagraphs("你对元朵朵轻声说道，「今日彩头先留着。」", NAMES);
    expect(blocks).toEqual([
      { kind: "prose", text: "你对元朵朵轻声说道，「今日彩头先留着。」" },
    ]);
  });

  it("先出现人物句号后由另一人接话时归属到后者", () => {
    const blocks = splitNarrativeParagraphs("你推门走进屋里。才旦合上账册，「周大掌柜前夜盘的底册不对。」", NAMES);
    expect(blocks).toEqual([
      { kind: "dialogue", speaker: "才旦", text: "你推门走进屋里。才旦合上账册，「周大掌柜前夜盘的底册不对。」" },
    ]);
  });

  it("引语前置时按紧跟引号后的主语识别", () => {
    const blocks = splitNarrativeParagraphs("「且慢动身。」格桑顿珠抬手横戟拦住去路。", NAMES);
    expect(blocks).toEqual([
      { kind: "dialogue", speaker: "格桑顿珠", text: "「且慢动身。」格桑顿珠抬手横戟拦住去路。" },
    ]);
  });

  it("提取切磋横幅中的对手名", () => {
    expect(parseDuelOpponent("与 格桑顿珠 切磋")).toBe("格桑顿珠");
    expect(parseDuelOpponent("与元朵朵切磋")).toBe("元朵朵");
    expect(parseDuelOpponent("普通分隔线")).toBeNull();
  });
});
