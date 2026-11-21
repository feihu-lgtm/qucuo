// AI 说书器的公共件：hasApiKey 判断 + 短润色调用包装。
// 斗蛐蛐战报（quickBattle/battleNarration）与酒馆夜报（tavernSim/simNarrator）共用本份；
// 两边的铁律一致：AI 只润色不改判，没 key/请求失败一律返回 null，由调用方静默落回模板文本。

import { loadConfig, callModel, hasApiCredentials } from "../../infra/apiConfig.js";

// 当前配置里有没有可用的 key。判断从宽：有凭证即认为可用，
// 真正能不能通只有发出去才知道，失败自然走降级。
export function hasApiKey() {
  try {
    return hasApiCredentials(loadConfig());
  } catch {
    return false;
  }
}

// 短润色调用：强制关思考（thinkingMode:off）覆盖玩家全局配置——
// 思考与输出共享 token 预算，会把两三句正文截断在半句（项目已知坑）。
// 成功返回清理后的正文，任何失败返回 null，绝不抛出。
export async function askStoryteller(sys, user, { callLabel, maxTokens = 800 } = {}) {
  let cfg;
  try {
    cfg = loadConfig();
  } catch {
    return null;
  }
  try {
    const noThinkCfg = { ...cfg, thinkingMode: "off" };
    const { text } = await callModel(noThinkCfg, sys, [{ role: "user", content: user }], {
      maxTokens,
      callLabel,
    });
    const clean = (text || "").replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
    return clean || null;
  } catch {
    return null; // 静默降级，调用方用模板兜底
  }
}
