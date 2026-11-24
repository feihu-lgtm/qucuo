import { describe, expect, it } from "vitest";
import { formatRecallEntries } from "./recallBlock.js";

describe("formatRecallEntries", () => {
  it("deduplicates memories already present in recent conversation window and truncates weak entries", () => {
    const recallInfo = {
      visible: [
        { text: "少侠在鱼定村茶馆外救下一只三花猫", tier: "strong", meta: { turn: 5 } },
        {
          text: "这是一段早已滑出对话窗口的弱相关极长旧事内容用于测试截断长度超过四十个字的边界行为是否精确执行",
          tier: "weak",
          meta: { turn: 9 },
        },
      ],
      filtered: 0,
    };

    const { recallInfo: deduped, recallBlock } = formatRecallEntries(recallInfo, {
      recentTexts: ["少侠在鱼定村茶馆外救下一只三花猫，之后回到村口。"],
    });

    expect(deduped.visible).toHaveLength(1);
    expect(deduped.deduped).toBe(1);
    expect(recallBlock).toContain("· （第9回合）");
    expect(recallBlock).toContain("…");
    expect(recallBlock).not.toContain("三花猫");
  });

  it("returns empty recallBlock when all visible entries are covered by recent window", () => {
    const recallInfo = {
      visible: [{ text: "昨夜在白塔见过才旦", tier: "strong", meta: { turn: 12 } }],
      filtered: 0,
    };
    const res = formatRecallEntries(recallInfo, {
      recentTexts: ["你回想起昨夜在白塔见过才旦。"],
    });
    expect(res.recallBlock).toBe("");
    expect(res.recallInfo.deduped).toBe(1);
  });
});
