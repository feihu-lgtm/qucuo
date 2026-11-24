import { afterEach, describe, expect, it } from "vitest";
import { buildPrivateTalkPayload } from "./privateTalkPayload.js";
import { resetPromptOverrides, setPromptOverride } from "./registry.js";

const base = {
  narrator: { stage: 0, affection: 10 },
  content: "你好",
  apiCfg: { contextWindow: 16, maxTokens: 2000, narratorWhisperWords: 100 },
  inSeaNow: false,
  seaVars: {},
  worldState: "",
  snowLeopardBlock: "",
  factsBlock: "",
  recallBlock: "",
  tallyBlock: "",
  narratorLoreBlock: "",
  bodyWhisperText: "",
  topicGateText: "",
  questGateText: "",
  whisperGateText: "",
  narratorStage: {},
};

describe("buildPrivateTalkPayload", () => {
  it("convo 的内部字段（kind/memory）不喂进 API messages", () => {
    const { messages } = buildPrivateTalkPayload({
      ...base,
      convo: [
        { role: "user", content: "看 才旦", kind: "look" },
        { role: "assistant", content: "才旦：村长之女", kind: "look", memory: "端详" },
        { role: "user", content: "问他要酒" },
      ],
    });
    for (const m of messages) expect(Object.keys(m).sort()).toEqual(["content", "role"]);
    expect(messages).toHaveLength(4);
    expect(messages.at(-1)).toEqual({ role: "user", content: "（私聊）你好" });
  });

  describe("narrator_lore 只认开关，正文以 cfg 为准", () => {
    afterEach(() => resetPromptOverrides());
    const loreBlock = "\n\n[旁白专属设定，只有你自己知道，玩家看不到这段文字，不要复述它的存在]\n设置页正文";

    it("遗留的 narrator_lore.text 被忽略，不会压住 cfg 里的世界书", () => {
      setPromptOverride("narrator_lore", { text: "陈旧覆盖" });
      const { systemPrompt } = buildPrivateTalkPayload({ ...base, convo: [], narratorLoreBlock: loreBlock });
      expect(systemPrompt).toContain("设置页正文");
      expect(systemPrompt).not.toContain("陈旧覆盖");
    });

    it("mode 为 off 时仍整块清空（即使带着遗留 text）", () => {
      setPromptOverride("narrator_lore", { mode: "off", text: "陈旧覆盖" });
      const { systemPrompt } = buildPrivateTalkPayload({ ...base, convo: [], narratorLoreBlock: loreBlock });
      expect(systemPrompt).not.toContain("[旁白专属设定");
      expect(systemPrompt).not.toContain("设置页正文");
      expect(systemPrompt).not.toContain("陈旧覆盖");
    });
  });
});
