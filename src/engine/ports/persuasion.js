// 说服对话调用口：回复解析与戒心规则留在 domain（quests/persuasion.js），
// AI 调用上移到 engine/ports。
import { withAI } from "./withAI.js";
import { parsePersuadeReply, hintsUnlockedByGuard } from "../../domain/rules/quests/persuasion.js";

/**
 * 跑一轮说服对话。
 * @param {object} p            persuade 结构
 * @param {string} playerSay    玩家这一轮说的话
 * @param {string[]} hitKeyIds  已经戳中的 key id 列表
 * @param {string[]} ownedFlags 玩家已拥有的 flags（判断 need 线索的"提前解锁"，不再否决命中）
 * @param {Array} history       之前的对话 [{role, content}]
 * @param {object} apiCfg
 * @param {number} guard        当前戒心值（0~100）
 * @returns {{line, hit, guardDrop, newGuard, yield, newHitKeys, unlockedHintCount}}
 */
export async function runPersuadeTurn(p, playerSay, hitKeyIds, ownedFlags, history, apiCfg, guard = 100, wit = 5, ai) {
  let parsed;
  try {
    const res = await withAI(
      "persuasion.turn",
      { persuade: p, playerSay, hitKeyIds, ownedFlags, history, guard },
      { ai, apiCfg },
    );
    parsed = parsePersuadeReply(res.text);
  } catch (e) {
    console.warn("说服调用失败，兜底", e);
    parsed = { line: "（对方没听清，你再说一遍。）", hit: null, guardDrop: 0, yield: false };
  }
  // 智谋放大降戒心：智谋高，话更能说到点子上，同样一句降更多戒心。
  // 系数 0.8~1.2（智谋0→0.8，5→1.0，10→1.2），乘在 AI 给的 guardDrop 上。
  const witCoef = 0.8 + Math.max(0, Math.min(10, wit)) * 0.04;
  const effDrop = Math.round(parsed.guardDrop * witCoef);
  // 戒心结算
  const newGuard = Math.max(0, guard - effDrop);
  const unlockedHintCount = hintsUnlockedByGuard(newGuard, p.keys.length);

  // 命中合法性（判定放宽）：只要是存在且未戳中过的 key 就算——去掉了 need-flag 硬锁，
  // 玩家没线索也能歪打正着命中（用户拍板"都算"）。need 只用于线索是否提前解锁。
  let newHitKeys = hitKeyIds;
  if (parsed.hit) {
    const k = p.keys.find(x => x.id === parsed.hit);
    if (k && !hitKeyIds.includes(parsed.hit)) {
      newHitKeys = [...hitKeyIds, parsed.hit];
    } else {
      parsed.hit = null; // 不存在或重复，作废
    }
  }
  // yield 的最终裁决权在系统：必须真的够 resistance，AI 说 yield 也得数值达标
  const reallyYield = newHitKeys.length >= p.resistance && parsed.yield;
  return { line: parsed.line, hit: parsed.hit, guardDrop: effDrop, newGuard, yield: reallyYield, newHitKeys, unlockedHintCount };
}
