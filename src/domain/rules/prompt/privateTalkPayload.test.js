import { describe, expect, it } from "vitest";
import { buildPrivateTalkPayload } from "./privateTalkPayload.js";

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
});
