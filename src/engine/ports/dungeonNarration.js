// 地宫探索 · 可选 AI 氛围润色（只做短文字润色，不改判任何数值/状态）。
// 没配 API Key 或调用失败一律静默返回 null，由界面保留纯前端文案。

import { askStoryteller, hasApiKey } from "./storyteller.js";

const SYSTEM_PROMPT = [
  "你是武侠MUD《天都·曲措》的江湖说书人。",
  "请根据当前地宫探索节点的既定事实，用简练克制的水墨武侠笔触补写1到2句环境氛围与动作细节（不超过70字）。",
  "不得改动胜负、伤害或掉落结果，不输出标题、序号或括号注释。",
].join("\n");

export async function narrateDungeonEvent({ dungeonName, floorName, nodeTitle, summary }) {
  if (!hasApiKey() || !summary) return null;
  const userPrompt = [
    `地宫：${dungeonName}`,
    floorName ? `层位：${floorName}` : "",
    nodeTitle ? `节点：${nodeTitle}` : "",
    `既定结果：${summary}`,
  ].filter(Boolean).join("\n");

  return askStoryteller(SYSTEM_PROMPT, userPrompt, {
    callLabel: "地宫氛围润色",
    maxTokens: 1000,
  });
}
