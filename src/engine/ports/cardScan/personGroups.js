// 阶段 2 的人物分组（从 cardScan.js 拆出，纯搬运）
// 合并 AI 同人分组与代码 keys 分组两个来源。

import { groupEntriesByKeys, groupToNpcLore } from "../../../domain/rules/cards/cardParse.js";

/**
 * 合并两个分组来源：
 *   · 代码分组（groupEntriesByKeys）：按 keys 完全相同归组，可靠但只认 keys
 *   · AI 分组（阶段 1 的"同人分组"）：能认出 keys 不同、但正文写的是同一人的情况
 * AI 分组优先，代码分组补漏。
 */
export function buildPersonGroups(parsed, stage1, kindOverride, selected) {
  const entries = parsed.card.entries;
  // 【player 条目硬排除】玩家自己绝不能变成一个 NPC。这里用代码初判的 kind，
  // 不看 AI 的覆盖——实测 AI 把整卡条目全判成 person 时，玩家的 <user> 设定条目
  // 会被展开成玩家名字，然后作为一个叫"陈狐飞"的 NPC 混进人物列表。
  const usable = entries.filter(e =>
    !e.dead && !e.flags.includes("TOO_LONG") && e.content && e.kind !== "player");

  // 用 AI 的最终 kind 覆盖代码初判
  const kindOf = (e) => kindOverride?.get(e.index) ?? e.kind;

  const claimed = new Set();
  const groups = [];

  // 先按 AI 的同人分组建组
  for (const g of (stage1?.同人分组 || [])) {
    const idxs = (g.条目 || []).filter(i => Number.isInteger(i) && entries[i]);
    const parts = idxs.map(i => entries[i]).filter(e => usable.includes(e));
    if (!parts.length) continue;
    const keys = Array.from(new Set(parts.flatMap(p => p.keys)));
    // AI 给的人名优先当本名，它比 keys[0] 更可能是真名
    const name = String(g.人名 || "").trim() || keys[0];
    if (!name) continue;
    for (const p of parts) claimed.add(p.index);
    groups.push({
      name,
      keys: [name, ...keys.filter(k => k !== name)],
      parts: parts.slice().sort((a, b) => a.order - b.order),
      merged: parts.length > 1,
      from: "ai",
    });
  }

  // 代码分组补漏：AI 没认领的 person 条目
  const rest = usable.filter(e => !claimed.has(e.index) && e.keys.length && kindOf(e) === "person");
  for (const g of groupEntriesByKeys(rest)) {
    const lore = groupToNpcLore(g, { includeNsfw: false });
    if (!lore) continue;
    groups.push({
      name: lore.name,
      keys: g.keys,
      parts: g.parts,
      merged: g.merged,
      from: "code",
    });
  }

  const picked = selected && selected.length
    ? groups.filter(g => selected.includes(g.name))
    : groups;

  return picked.map(g => ({
    name: g.name,
    aliases: g.keys.filter(k => k !== g.name),
    entry: g.parts.length > 1
      ? g.parts.map(p => `【${p.label}】\n${p.content}`).join("\n")
      : g.parts[0].content,
    _parts: g.parts.map(p => p.label),
    _from: g.from,
  }));
}

