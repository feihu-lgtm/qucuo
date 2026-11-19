// 历史窗口 · 分层压缩（纯函数）
// ============================================================================
// 【问题】此前 10 号位（Chat History）是 convo.slice(-contextWindow) 直接铺开，
// 而 convo 里每条 assistant 存的是 rawFull.slice(0, 500)——**原始 JSON**，
// 连 room/char/dao/delta 那些脚手架字段一起喂回给模型。
// 按 contextWindow=16 实测，这一块约 4176 字 ≈ 6.7k tokens，占单轮上下文近四成，
// 而其中真正对"接着往下写"有用的信息，可能只有几十个字。
//
// 更要命的是：我们**每轮本来就生成了 p.memory**（≤50字纯客观事实，喂给向量小纸条
// 和事实账本用），却完全没拿它替代历史——等于同一件事存了两份，用了贵的那份。
//
// 【怎么改·参考姬侠传 char_card_1 的三层记忆】
// 它的 prompt 里压根没有滚动的原始对话窗口：
//   <PreviousMemories>  周级大总结，当背景
//   <RecalledMemories>  向量召回的相关片段
//   <RecentMemories>    近期逐轮小总结（带时间戳）
//   <LatestReply>       **只有最后一条**完整回复，并明说"读它确定最新剧情+参考文风"
// 更早的一切都由总结替代。它还做了 token 预算：超了先丢最旧的。
//
// 我们照这个思路分三层（远景与召回本来就有，缺的正是中段这一层）：
//   近况  最近 K 轮原始 —— 保文风、保即时连贯（"她刚才说的那句话"要接得上）
//   前情  更早那些轮的 memory 摘要 —— 每条≤50字，带回合数
//   更早  已有的 远景(日总结) + 向量召回 负责，这里不重复
//
// 【为什么近况留 2 轮而不是 1 轮】姬侠传只留最后一条，因为它每轮输出 8-12 段、
// 单条信息量极大。我们单轮 220 字左右，只留一条容易接不上"上一句谁在说话"，
// 尤其对话模式里一来一回是成对的。2 轮 = 4 条消息，够接住语气又不至于铺开。

const DEFAULTS = {
  recentPairs: 2,      // 保留几轮原始（一轮 = 玩家一条 + 引擎一条）
  maxSummaries: 12,    // 前情最多带几条摘要
  budgetChars: 1200,   // 这一块的字数预算；超了先丢最旧的摘要
  rawClip: 500,        // 单条原始的截断长度（与 commitRound 存的一致）
};

// 从一条 convo 记录里取"这一轮发生了什么"的短摘要。
// 优先用 memory（我们每轮真的生成了它）；老存档的条目没有这个字段，
// 退回把原始内容截短——聊胜于无，且不会因为读老档就崩。
function summarize(entry) {
  if (!entry) return "";
  if (entry.role === "user") {
    const c = String(entry.content || "").trim();
    return c.length > 40 ? c.slice(0, 40) + "…" : c;
  }
  if (entry.memory && String(entry.memory).trim()) return String(entry.memory).trim();
  // 兜底：老存档存的是原始 JSON，尽力从里头抠出 memory 字段，抠不到就截断正文
  const raw = String(entry.content || "");
  const m = raw.match(/"memory"\s*:\s*"([^"]{2,80})"/);
  if (m) return m[1];
  const out = raw.match(/"output"\s*:\s*\[\s*"([^"]{2,60})/);
  if (out) return out[1] + "…";
  return raw.length > 50 ? raw.slice(0, 50) + "…" : raw;
}

const label = (role) => (role === "user" ? "[玩家]" : "[引擎]");

// 组装 10 号位的历史块。
// convo：过滤过私聊的 mainConvo（调用方负责过滤，这里不管）
// 返回字符串，直接进 makeBlock("chatHistory", ...)
export function buildHistBlock(convo, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const list = Array.isArray(convo) ? convo : [];
  if (!list.length) return "";

  const recentCount = Math.max(0, o.recentPairs * 2);
  const recent = recentCount ? list.slice(-recentCount) : [];
  const older = recentCount ? list.slice(0, -recentCount) : list;

  // ── 前情：更早那些轮的摘要，从新到旧填进预算，再倒回时间顺序 ──
  const picked = [];
  let used = 0;
  for (let i = older.length - 1; i >= 0; i--) {
    if (picked.length >= o.maxSummaries) break;
    const s = summarize(older[i]);
    if (!s) continue;
    const line = `${label(older[i].role)} ${s}`;
    if (used + line.length > o.budgetChars) break;   // 超预算：更旧的一律不要
    picked.unshift(line);
    used += line.length;
  }

  const parts = [];
  if (picked.length) {
    parts.push("[前情提要]（更早发生的事，只记要点，供你了解来路，不必复述）");
    parts.push(picked.join("\n"));
  }
  if (recent.length) {
    if (parts.length) parts.push("");
    parts.push("[最近对话]（原文，接着往下写要照应它的语气与未完的话头）");
    parts.push(recent.map(m => `${label(m.role)} ${String(m.content || "").slice(0, o.rawClip)}`).join("\n"));
  }
  return parts.join("\n");
}

// 供 trace 展示：这一块省了多少。
// 旧算法 = 全部按原始铺开（这就是改之前的行为）。
export function histBlockSavings(convo, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const list = Array.isArray(convo) ? convo : [];
  const window = o.legacyWindow ?? list.length;
  const legacy = (list.length > window ? list.slice(-window) : list)
    .map(m => `${label(m.role)} ${String(m.content || "").slice(0, o.rawClip)}`).join("\n");
  const now = buildHistBlock(list, opts);
  return { legacyChars: legacy.length, nowChars: now.length, savedChars: Math.max(0, legacy.length - now.length) };
}
