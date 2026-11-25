// WO-24D 备料消费适配（纯函数·只读）
// ============================================================================
// 把 prepSeeds 缓存素材适配成各消费链可用形状——素材绝不变成事实：
//   adaptPrepItemsForJudge  prep_item → judgeTurn envelope.prepItems 形状
//                           （真实判官与 shadow 影子必须用这同一个入口，对账同源）
//   prepMaterialLines       npc_plan/tavern_rumor/prep_item clue → deterministic 短文本行
//   buildPrepMaterialBlock  主叙事/前哨注入块（带非事实警示，空则零注入）
// 硬约束：不直接发背包、不写容器内容、不改世界事实、不新增 AI 调用。

import { validPrepSeeds } from "./prepSeeds.js";

// judgeTurn envelope.prepItems 形状（与 judgeTurn.js 第二关消费口径一致）：
// {id, containerId, name, category, quality, clue, taken:false}——id 用 seed id
// 便于溯源；坏 payload 缺 name 的条目丢弃不炸。
export function adaptPrepItemsForJudge(state, seeds) {
  return validPrepSeeds(seeds, state, "prep_item")
    .map((seed) => {
      const p = seed.payload || {};
      if (!String(p.name || "").trim()) return null;
      return {
        id: seed.id,
        containerId: String(p.containerId || ""),
        name: String(p.name),
        ...(p.category ? { category: String(p.category) } : {}),
        ...(p.quality ? { quality: String(p.quality) } : {}),
        ...(p.clue ? { clue: String(p.clue) } : {}),
        taken: false,
      };
    })
    .filter(Boolean)
    .slice(0, 4); // cap 防淤积——有效池理论很小，双保险
}

// 文本素材行（deterministic 模板，绝不润色扩写）：
//   npc_plan     【备料·人物盘算】<npc>心里盘着<plan>，接下来打算<nextAction>
//   tavern_rumor 【备料·巷口风声】<text>
// cap 3 行防刷屏；payload 关键字段缺失的跳过。
export function prepMaterialLines(state, seeds) {
  const lines = [];
  for (const seed of validPrepSeeds(seeds, state)) {
    const p = seed.payload || {};
    if (seed.kind === "npc_plan" && (p.plan || p.nextAction)) {
      const who = String(p.npcName || seed.subject || "有人");
      const plan = String(p.plan || "").trim();
      const next = String(p.nextAction || "").trim();
      lines.push(`【备料·人物盘算】${who}${plan ? `心里盘着${plan}` : ""}${next ? `${plan ? "，" : ""}接下来打算${next}` : ""}`);
    } else if (seed.kind === "tavern_rumor" && p.text) {
      lines.push(`【备料·巷口风声】${String(p.text).trim()}`);
    } else if (seed.kind === "prep_item" && String(p.clue || "").trim()) {
      // WO-24G：clue 翻找前可见性最小闭环——微痕行进主叙事素材块，
      // 玩家有机会在翻找前察觉。仍是非事实素材（块头警示钉死），
      // clue 绝不写成物品已存在、不落账。
      const where = String(p.containerId || "").trim();
      lines.push(`【备料·微痕】${where ? `${where}：` : ""}${String(p.clue).trim()}`);
    }
    if (lines.length >= 3) break;
  }
  return lines;
}

// 主叙事/前哨注入块：非事实警示钉死在块头——AI 可用可不用，绝不当既定事实写。
// 无有效素材返回空串，零注入不污染 prompt 形状。
export function buildPrepMaterialBlock(state, seeds) {
  const lines = prepMaterialLines(state, seeds);
  if (!lines.length) return "";
  return `[备料素材·以下不是既定事实，可用可不用，用了也不能写成已发生]\n${lines.join("\n")}`;
}

// 判官喂料一站入口（真实判官/shadow 同源闸门）：输入松散 state 切片+seeds，
// 输出 envelope.prepItems。两处调用方只许调这一个函数，不许各自再过滤。
export function resolvePrepItemsForJudge({ room, innerRoomName, time, varTree }, seeds) {
  return adaptPrepItemsForJudge(
    { room: room || {}, innerRoomName: innerRoomName ?? null, time, varTree: varTree || {} },
    seeds,
  );
}
