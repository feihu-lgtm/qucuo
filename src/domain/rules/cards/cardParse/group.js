// keys 分组与 npcLore 候选（从 cardParse.js 拆出，纯搬运）

/**
 * F16：把 keys 完全相同的多条合并成一条候选 npcLore。
 * 逐玉那种「一个角色四条（性格/衣柜/二次解释/nsfw）keys 全一样」的写法，
 * 直接导进去会变成四个同名 npcLore 条目，matchNpcLore 一命中全亮。
 * 合并时保留各段的小标题，NSFW 段单独拆出来交给 nsfwOn 开关（R5）。
 */
export function groupEntriesByKeys(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!e.keys.length) continue;
    const sig = e.keys.slice().sort().join("\u0000");
    if (!map.has(sig)) map.set(sig, []);
    map.get(sig).push(e);
  }
  const groups = [];
  for (const [, list] of map) {
    if (list.length === 1) {
      groups.push({ keys: list[0].keys, parts: list, merged: false });
      continue;
    }
    groups.push({
      keys: list[0].keys,
      parts: list.slice().sort((a, b) => a.order - b.order),
      merged: true,
    });
  }
  return groups;
}

/**
 * 把一个 keys 分组转成 npcLore 形状 {name, aliases, entry}。
 * 约定：keys[0] 当本名，其余当别名——实测这是中文卡的普遍写法
 * （封神异闻录 ['三霄娘娘','云霄','碧霄','琼霄']、断法大陆 ['雷纳德','格雷公爵',…]）。
 * 注意这只是「候选」，本名到底是哪个仍应让玩家在导入界面确认：有些条目一条塞
 * 好几个人（封神异闻录的「次要角色」2129 字里有五六个人名），机器分不开。
 */
export function groupToNpcLore(group, { includeNsfw = false } = {}) {
  const parts = group.parts.filter(p => includeNsfw || !p.flags.includes("NSFW"));
  if (!parts.length) return null;
  const body = parts
    .map(p => (parts.length > 1 ? `【${p.label}】\n${p.content}` : p.content))
    .join("\n");
  return {
    name: group.keys[0],
    aliases: group.keys.slice(1),
    entry: body,
    // 供 UI 展示：这条是几段合出来的、总共多长、含哪些风险
    _meta: {
      mergedFrom: parts.map(p => p.label),
      length: body.length,
      flags: Array.from(new Set(parts.flatMap(p => p.flags))),
      multiPerson: group.keys.length > 3, // 启发式：keys 太多可能一条塞了多人
    },
  };
}
