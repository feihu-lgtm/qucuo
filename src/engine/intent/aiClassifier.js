// 把现有 AI 端口包装成行动识别的 classifier 端口（形状仿 Jev：一问一答、选项+概率），
// 以后换成 Jev 或专用分类模型，只需另写一个同形状的实现。
import { SYSTEM_PROMPT, renderPrompt, parseChoice, probsFromLogprobs, argmax, extractJson } from "../../domain/intent/prompts.js";

const LABELS = { compound: "行动识别·复合", split: "行动识别·拆分", kind: "行动识别·类别", target: "行动识别·对象", item: "行动识别·物品", direction: "行动识别·方向" };

export function createAiClassifier(ai, { model, cfg, temperature = 0, maxTokens = 200 } = {}) {
  async function ask(question, vars, options) {
    const prompt = renderPrompt(question, { ...vars, options });
    const response = await ai.chat([{ role: "user", content: prompt }], {
      systemPrompt: SYSTEM_PROMPT, callLabel: LABELS[question] || "行动识别", stream: false,
      temperature, maxTokens, modelOptions: { temperature, maxTokens, logprobs: true, topLogprobs: 5 },
      ...(model ? { model } : {}), ...(cfg ? { cfg } : {}),
    });
    return typeof response === "string" ? { text: response } : response || {};
  }
  return {
    async decide(question, vars, options) {
      const response = await ask(question, vars, options);
      const fromLogprobs = probsFromLogprobs(response.logprobs || response.raw?.choices?.[0]?.logprobs, options);
      if (fromLogprobs) return { choice: argmax(fromLogprobs), probs: fromLogprobs, source: "logprobs" };
      return { ...parseChoice(response.text, options), source: "stated" };
    },
    async split(vars) {
      const response = await ask("split", vars, []);
      return extractJson(response.text)?.parts || [];
    },
  };
}
