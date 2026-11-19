// 已认识 NPC 追踪
// 核心问题：以前"人物关系"面板显示谁，完全取决于 AI 有没有在 <mvu> 里顺手
// 写过这个人的好感度字段——这导致经常出现"玩家刚看到一个人，好感度就已经
// 显示出来了"的信息泄漏，逻辑完全反了。
//
// 正确顺序：NPC 出现在场景里 ≠ 玩家认识他。只有玩家主动"细看"或"对话"过，
// 才算真正认识，这个状态由系统本地显式追踪，不依赖 AI 是否声明过任何字段。

// knownNpcs 是一个 Set 结构（存在 varTree.世界.已认识人物 里，用数组形式持久化，
// 因为 varTree 最终要被 JSON 序列化进存档，Set 不能直接存）。

export function isNpcKnown(varTree, npcName) {
  const known = varTree.世界?.已认识人物 || [];
  return known.includes(npcName);
}

// 好感度这个数字之前完全依赖 AI 主动在 <mvu> 里声明——玩家刚认识一个人，
// 只要 AI 这轮没顺手写好感度字段，右侧面板就不会显示任何数值（不是"0"，
// 是整行不渲染），看起来像是"认识了但没反应"的bug。这里在标记为"已认识"
// 的同一时刻，顺手给一个系统裁决的初始好感度，不再等AI恩赐。
const INITIAL_FAVORABILITY = 10;

export function markNpcAsKnown(varTree, npcName) {
  const known = varTree.世界?.已认识人物 || [];
  const already = known.includes(npcName);
  const existingAttrs = varTree.角色?.[npcName];
  const needsSeed = typeof existingAttrs?.好感度 !== "number";
  if (already && !needsSeed) return varTree; // 已经认识且好感度已存在，不重复处理
  return {
    ...varTree,
    世界: {
      ...varTree.世界,
      已认识人物: already ? known : [...known, npcName],
    },
    角色: {
      ...varTree.角色,
      [npcName]: {
        ...existingAttrs,
        好感度: needsSeed ? INITIAL_FAVORABILITY : existingAttrs.好感度,
      },
    },
  };
}

// 检测一批NPC里，哪些是"系统之前从没见过、这是第一次出现在任何房间里"的新面孔。
// 用一个独立的"曾经出现过"清单（跟"已认识"是两回事：出现过≠认识）来判断，
// 避免同一个人反复进出同一个房间时，每次都被误判成"新人物出现"。
export function detectNewFaces(varTree, npcsInRoom) {
  const everSeen = varTree.世界?.曾经出现人物 || [];
  const newFaces = npcsInRoom.filter(n => !everSeen.includes(n.name));
  return newFaces;
}

export function markAsSeen(varTree, npcNames) {
  const everSeen = varTree.世界?.曾经出现人物 || [];
  const merged = Array.from(new Set([...everSeen, ...npcNames]));
  return {
    ...varTree,
    世界: {
      ...varTree.世界,
      曾经出现人物: merged,
    },
  };
}

// ── 久别重逢·记忆断层（本轮新增）──
// 问题：一个人物很久没出现，下次再同框时，AI 常常当"时间静止"处理——这人还杵在原地、
// 心境处境毫无推移，很出戏。解法：系统记下每个人"上次与主角同框是第几回合"，隔太久再见时，
// 提示 AI 先在心里补写这段时间里此人身上合理发生的变化，再自然写进叙事。
// 纯本地时间戳逻辑，不依赖 AI 声明任何字段；回合数用主时间计数 time（每次行动 +1）。

// 隔多少回合算"久别"。100 回合约合一天，这里取半天上下，避免频繁误触发。
export const REUNION_GAP_THRESHOLD = 50;

// 记录当前在场人物"这一回合见过"。对所有在场者都记（便于日后其成为已认识时也有底），
// 存在 varTree.世界.上次同框回合 这个 { 人名: 回合数 } 映射里。
export function updateLastSeen(varTree, npcNames, currentTurn) {
  if (!npcNames || !npcNames.length) return varTree;
  const prev = varTree.世界?.上次同框回合 || {};
  const next = { ...prev };
  for (const name of npcNames) next[name] = currentTurn;
  return {
    ...varTree,
    世界: {
      ...varTree.世界,
      上次同框回合: next,
    },
  };
}

// 检测本轮在场者里，哪些是"玩家已认识、且距上次同框已超过阈值"的久别重逢对象。
// 只对已认识的人触发——没见过的人属于"新面孔"，走 detectNewFaces，不在此列。
// 返回 [{ name, lastTurn, gap }]，按间隔从大到小排列。
export function detectReunions(varTree, npcsInRoom, currentTurn, gapThreshold = REUNION_GAP_THRESHOLD) {
  const lastSeen = varTree.世界?.上次同框回合 || {};
  const known = varTree.世界?.已认识人物 || [];
  const out = [];
  for (const n of (npcsInRoom || [])) {
    const name = n.name;
    if (!known.includes(name)) continue;          // 只补写认识的人
    const last = lastSeen[name];
    if (last == null) continue;                    // 从没记录过同框回合，跳过
    const gap = currentTurn - last;
    if (gap >= gapThreshold) out.push({ name, lastTurn: last, gap });
  }
  return out.sort((a, b) => b.gap - a.gap);
}

// 把久别重逢对象拼成提示 AI 补写中间变化的 prompt 块。没有则返回空串。
export function buildReunionBlock(reunions, turnsPerDay = 100) {
  if (!reunions || !reunions.length) return "";
  const lines = reunions.map(r => {
    const days = Math.floor(r.gap / turnsPerDay);
    const 时长 = days >= 1 ? `约${days}天` : "有好一阵子";
    return `- ${r.name}：距上次与主角同框已${时长}（${r.gap}回合）`;
  }).join("\n");
  return `\n\n【久别重逢·补写记忆断层】以下人物已较久未与主角照面，本轮重新出现。不要当作时间静止：先在心里为其补写这段时间里合理、克制、与其处境相称的变化（境遇的推移、心境的转变、外部关系或身体状态的细微变化等），再让这些变化自然体现在其言行与叙事中。变化应符合人物一贯设定与世界逻辑，不必刻意戏剧化，也不要凭空拔高其与主角的关系。\n${lines}`;
}
