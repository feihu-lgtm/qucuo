// ============================================================================
// 说服系统 —— 短对话 + 隐藏判定
// ----------------------------------------------------------------------------
// 设计参照（综合五款 AI 游戏）：
//   · 燕云十六声：每个 NPC 有具体"心结"，说中锚点才通；可用身份/钱走捷径
//   · 崇祯模拟器：某些突破口需先在剧情里拿到线索（need flag）才有效——铺垫递进
//   · 1001 Nights：NPC 有性格，动态反馈满意/不满，当玩家的导航
//   · Whispers：开放对话，底层藏成功判定，UI 给可见进度
// 关键约束（用户拍板）：说服态下 AI **只输出 NPC 的短对话（≤30字），不叙事、
//   不扮演旁白、不描写动作神态**——纯粹"这个人在跟你说话"。判定另走结构化字段。
//
// persuade 结构（挂在任务 stage 上）：
//   persuade: {
//     who: "药铺掌柜",
//     knot: "怕管家追责，不敢卖管控药给和山贼沾边的人",       // 心结（玩家可见的提示）
//     opening: "你要买管控的药？这药我可不敢乱卖……",         // NPC 开场白（≤30字）
//     keys: [                                                  // 突破口
//       { id: "k1", hint: "点破管家走私账本上也有这家铺子", need: null },
//       { id: "k2", hint: "亮出管家私心的传闻", need: "rumor_guanjia_sixin" },
//       { id: "k3", hint: "抬出柳青鸢都事在查此事", need: "met_liuqingyuan" },
//     ],
//     resistance: 2,                                            // 命中几个 key 才松口
//     bribe: 200,                                               // 可选：花钱封口的价码
//     identity: "文士",                                         // 可选：有此身份可直接压服
//   }
// ============================================================================

import { callModel } from "../apiConfig.js";

// 构建说服态的 system prompt：约束 AI 只当这个 NPC 说短话，并做隐藏判定。
function buildPersuadeSystem(persuade, hitKeyIds, ownedFlags, guard) {
  const keysDesc = persuade.keys
    .map(k => {
      const hit = hitKeyIds.includes(k.id);
      // 判定放宽（本轮改）：need-flag 不再否决命中，只影响"线索是否提前解锁"。
      // 玩家没线索也能歪打正着命中——所以这里不再标"不算数"。
      return `  - [${k.id}] ${k.hint}${hit ? "（已戳中，不重复计）" : ""}`;
    })
    .join("\n");

  return `你现在扮演【${persuade.who}】，和玩家进行一场"说服"交锋。玩家想让你让步，你有顾虑不肯松口。

你的心结（不肯让步的原因）：${persuade.knot}

【你只输出台词，绝不泄底】
你只输出【${persuade.who}】这一句话的台词，口语，不超过30个字。
- 不要写任何叙事、旁白、动作描写、神态描写、括号说明。
- 不要写"他说""掌柜道"这类引导语。直接就是这个人说出口的话。
- 就像真人对话里对方回你的一句话那么短。
- 【关键】绝不能在台词里暴露游戏机制：不许说"你说中了""还差一点""再说一条""你戳中了我的心结"这类话；不许把下面列出的突破口内容当台词念出来提示玩家。你的心结要让玩家自己从对话里揣摩，你只管以这个人的身份自然反应。

【你的立场演绎】（当前戒心 ${guard}/100，越低越松动）
- 戒心高（>60）：搪塞、推脱、打太极，话冷。
- 戒心中（30~60）：口风开始软，偶尔漏出点真心话，但嘴上还端着。
- 戒心低（<30）：几乎守不住，玩家再推一把就松口。
- 玩家没戳中要害、只是空谈或硬来时：继续挡，别松口。
- 玩家戳中顾虑/软肋、或话说得让你放下戒备时：语气动摇，但别一次答应，还要再端一端。

【玩家可能戳中的突破口】（仅供你判断，不要在台词里念出来）：
${keysDesc}

【隐藏判定】
在你这句台词的最后，另起一行，输出一个 JSON（玩家看不到，系统用）：
{"hit":"戳中的key的id或null","guardDrop":0到50的整数,"yield":true/false}
- hit：这一轮玩家的话【只要方向对、沾到某个未戳中突破口的边】就填那个 id，不要求字字精准；纯空谈、硬来、重复已戳中的，才填 null。判定宁松勿严——别让玩家说了好几轮还一个都不中。
- guardDrop：这话让你放下多少戒备。一般讲理/寒暄给 5~15；说得真诚、投机、示弱、给足好处、或说到你情绪痛点上，给 30~50；胡搅蛮缠、冒犯你，给 0。
- yield：只有当【累计戳中数 ≥ ${persuade.resistance}】且你这句是松口答应时，才 true；否则 false。
当前累计已戳中：${hitKeyIds.length} / 需要 ${persuade.resistance}。

再强调：台词一行（≤30字，纯口语），JSON 一行，不要有别的。`;
}

// 解析 AI 返回：拆出"短对话台词" + 判定 JSON。
function parsePersuadeReply(raw) {
  const text = (raw || "").trim();
  // 找最后一个 {...} 作为判定 JSON
  const m = text.match(/\{[^{}]*"hit"[^{}]*\}/);
  let verdict = { hit: null, guardDrop: 10, yield: false };
  let line = text;
  if (m) {
    try { verdict = JSON.parse(m[0]); } catch { /* 容错：解析失败按未命中处理 */ }
    line = text.slice(0, m.index).trim();
  }
  // 台词兜底：去掉可能残留的引导词/引号，并硬截到 40 字防跑飞
  line = line.replace(/^[「『"']|[」』"']$/g, "").replace(/^.{0,4}(说道?|道|回道)[:：]\s*/, "").trim();
  if (line.length > 40) line = line.slice(0, 40);
  // guardDrop 兜底与钳制
  let drop = Number(verdict.guardDrop);
  if (!Number.isFinite(drop)) drop = 10;
  drop = Math.max(0, Math.min(50, Math.round(drop)));
  return { line: line || "……", hit: verdict.hit || null, guardDrop: drop, yield: !!verdict.yield };
}

// 根据戒心值算出应解锁到第几条线索。每跨过一个 30 的坎（100→70→40→10）多解锁一条，
// 按 keys 顺序逐条给。返回应解锁的线索条数（0..keys.length）。
export function hintsUnlockedByGuard(guard, keyCount) {
  // 100 起：降到 <=70 解锁1条，<=40 解锁2条，<=10 解锁3条……
  const thresholds = [70, 40, 10]; // 三条坎；超过3个突破口则每再降30继续
  let n = 0;
  for (const th of thresholds) { if (guard <= th) n++; }
  // 若突破口多于3个，继续按每-30一条（从 -20 开始的负值区间）
  if (keyCount > 3 && guard < 10) {
    n += Math.floor((10 - guard) / 30);
  }
  return Math.min(n, keyCount);
}

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
export async function runPersuadeTurn(p, playerSay, hitKeyIds, ownedFlags, history, apiCfg, guard = 100, wit = 5) {
  const system = buildPersuadeSystem(p, hitKeyIds, ownedFlags, guard);
  const msgs = [...history, { role: "user", content: playerSay }];
  let parsed;
  try {
    const res = await callModel(apiCfg, system, msgs, { maxTokens: apiCfg.callTokenLimits?.persuasion ?? 2000, callLabel: `说服（${p.who}）` });
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
