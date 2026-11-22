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

import "../prompt/calls/domainCalls.js";

// 解析 AI 返回：拆出"短对话台词" + 判定 JSON。
export function parsePersuadeReply(raw) {
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

// runPersuadeTurn 已上移到 engine/ports/persuasion.js。
