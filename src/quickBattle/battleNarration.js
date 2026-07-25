// 斗蛐蛐战报 · AI 说书增强（可选，装 key 才有）
// 契合 duel-system-design.md 第四节的设计：回合胜负是纯 resolveTurn 数值裁决，
// AI 完全不参与判定，只在结算之后把"谁用了什么招、克制关系、伤害数字"这些
// 已经算死的结构化结果，包装成一段符合双方性格的说书人文字。
//
// 关键降级原则：这一整块都是锦上添花。没配 key、请求失败、超时，全部静默
// 退回系统自带的 notes 短句，绝不因为战报生成失败而中断战斗——战斗本身
// 一秒都不依赖网络。

import { loadConfig, callModel } from "../apiConfig.js";

// 当前配置里有没有可用的 key（判断"能不能调 AI 战报"）。UI 拿它决定
// 是否显示"已启用 AI 战报"的提示。判断从宽：有 apiKey 字段且非空即认为可用，
// 真正能不能通只有发出去才知道，失败自然会走降级。
export function hasApiKey() {
  try {
    const cfg = loadConfig();
    return !!(cfg && cfg.apiKey && String(cfg.apiKey).trim());
  } catch {
    return false;
  }
}

// 把一回合的结构化结果拼成给 AI 的输入摘要（纯数据，AI 不改判、只润色）。
function buildTurnDigest(myFighter, foeFighter, myMove, foeMove, result) {
  const lines = [];
  lines.push(`我方【${myFighter.name}】使出「${myMove.name}」（${myMove.type}类，${myMove.quality}品）`);
  lines.push(`敌方【${foeFighter.name}】使出「${foeMove.name}」（${foeMove.type}类，${foeMove.quality}品）`);
  if (result.matchup === "tie") lines.push("同类相搏，比拼身法先手");
  else lines.push(`相克判定：${result.matchup === "A" ? "我方招式克制得手" : "敌方招式克制得手"}`);
  if (result.damageToB > 0) lines.push(`敌方受创 ${result.damageToB} 点气血`);
  if (result.damageToA > 0) lines.push(`我方受创 ${result.damageToA} 点气血`);
  if (result.statusAppliedToB) lines.push(`敌方中「${result.statusAppliedToB}」`);
  if (result.statusAppliedToA) lines.push(`我方中「${result.statusAppliedToA}」`);
  if (result.counterTriggered) lines.push("有一记防守反击奏效");
  return lines.join("；");
}

// 生成一段说书战报。成功返回文字，任何失败返回 null（调用方据此决定用 notes 兜底）。
// 用短超时（默认走 cfg.timeoutMs，通常几秒），战斗节奏由玩家点"下一回合"控制，
// 允许战报慢半拍异步补上，不阻塞。
export async function narrateTurn(myFighter, foeFighter, myMove, foeMove, result) {
  if (!hasApiKey()) return null;
  let cfg;
  try {
    cfg = loadConfig();
  } catch {
    return null;
  }

  const digest = buildTurnDigest(myFighter, foeFighter, myMove, foeMove, result);
  const sys = `你是曲措乡的说书人。下面给你一个切磋回合已经算好的结果（谁用什么招、克制、伤害、状态），
你的唯一任务是把它讲成一段生动的说书文字，不要改动任何胜负和数字，不要额外添加战斗结果。
要求：白话古文的说书人口吻，句子完整，用"虽然/至于/倒也"这类转折连词，不用冒号破折号；
控制在两到三句、八十字以内；只讲这一回合，不预告后续。只输出这段话，不要任何前后缀。`;
  const user = `本回合结果：${digest}`;

  try {
    // 说书是短润色请求：强制关思考（thinkingMode:off）覆盖玩家全局配置，
    // 否则思考会吃掉 token 额度，把两三句说书截断在半句（项目已知坑：
    // thinking 与 maxOutputTokens 共享预算）。同时给足 maxTokens 兜底。
    const noThinkCfg = { ...cfg, thinkingMode: "off" };
    const { text } = await callModel(noThinkCfg, sys, [{ role: "user", content: user }], {
      maxTokens: 800, // 两三句正文足够，关思考后不会被占，给足余量防截断
      callLabel: "斗蛐蛐说书",
    });
    const clean = (text || "").replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
    return clean || null;
  } catch {
    return null; // 失败静默降级，交给调用方用 result.notes 兜底
  }
}
