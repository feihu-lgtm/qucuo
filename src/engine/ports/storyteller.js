// AI 说书器的公共件：hasApiKey 判断 + 短润色调用包装（经 withAI 统一门禁）。
// 斗蛐蛐战报（quickBattle/battleNarration）与酒馆夜报（tavernSim/simNarrator）共用本份；
// 两边的铁律一致：AI 只润色不改判，没 key/请求失败一律返回 null，由调用方静默落回模板文本。

import { definePrompt, getPromptDef } from "../../domain/rules/prompt/registry.js";
import { loadConfig, createWebAi, hasApiCredentials } from "./ai.js";
import { withAI } from "./withAI.js";

const webAi = createWebAi();

function ensureStorytellerPrompt() {
  if (getPromptDef("call", "storyteller.flavor")) return;
  definePrompt("block", "storyteller.sys", {
    label: "说书润色系统指令",
    slot: "sys",
    text: (ctx) => ctx.sys || "你是曲措乡的说书人。",
  });
  definePrompt("block", "storyteller.user", {
    label: "说书润色上下文",
    slot: "user",
    text: (ctx) => ctx.user || "",
  });
  definePrompt("call", "storyteller.flavor", {
    label: (ctx) => ctx.callLabel || "说书润色",
    tier: "flavor",
    defaultMaxTokens: (ctx) => ctx.maxTokens ?? 800,
    join: "",
    blocks: ["storyteller.sys", "storyteller.user"],
  });
}

// 当前配置里有没有可用的 key。判断从宽：有凭证即认为可用，
// 真正能不能通只有发出去才知道，失败自然走降级。
export function hasApiKey() {
  try {
    return hasApiCredentials(loadConfig());
  } catch {
    return false;
  }
}

// 短润色调用：经 withAI 的 flavor 档强制关思考（thinkingMode:off）并剥除思考标签——
// 思考与输出共享 token 预算，会把两三句正文截断在半句（项目已知坑）。
// 成功返回清理后的正文，任何失败返回 null，绝不抛出。
export async function askStoryteller(sys, user, { callLabel, maxTokens = 800 } = {}) {
  let cfg;
  try {
    cfg = loadConfig();
  } catch {
    return null;
  }
  ensureStorytellerPrompt();
  try {
    const res = await withAI(
      "storyteller.flavor",
      { sys, user, callLabel, maxTokens },
      { ai: webAi, apiCfg: cfg, throwOnError: false },
    );
    return res.ok && res.text ? res.text : null;
  } catch {
    return null; // 静默降级，调用方用模板兜底
  }
}
