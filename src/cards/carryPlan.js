// 装备规划 · AI 一键配随身物
// ============================================================================
// 【为什么独立于 placementPlan.js】落脚规划管「人待在哪」，装备规划管「人身上有
// 什么」。两者都发生在审改期、由玩家点按钮触发、按批调用，结构同构但产出不同：
// 落脚出 placement，装备出 carry 数组。拆开各管一件事，跟 placementPlan 一样不
// 混进 scanPrompts 的四阶段流水线。
//
// 【AI 在这里被允许做什么】按人设/身份/品阶给每人配 2-4 件随身物。物件一律当「自造
// 物品」产出（带 name/category/quality/desc 四项）——运行时 normalizeCarry 会照单
// 收下，makeItemSmart 若在百物录里查到同名会自动补上数值词条，查不到就按这四项建。
// AI 不必背下 406 件百物录（塞不进 prompt），给合理的名字即可。

const CATEGORIES = ["weapon", "armor", "accessory", "misc"];
const QUALITIES = ["白", "绿", "蓝", "紫", "橙", "红"];
const TIER_ORDER = { 白: 0, 绿: 1, 蓝: 2, 紫: 3, 橙: 4, 红: 5 };

// 输出 token 上限，量级对齐 placementPlan 的 batch（带思考的模型思考与正文共用
// 这份额度，给小了会在思考阶段就被吃穿、正文吐一半就撞 length 上限）。
export const CARRY_PLAN_MAX_TOKENS = { batch: 6000 };

/** 人物清单文本：身份 + 品阶 + 人设摘要，够 AI 判断该配什么就行 */
function peopleBrief(npcs, entryMax = 160) {
  return npcs.map((n, i) => {
    const tier = QUALITIES[n.levelCap] || "白";
    const bits = [
      `${i + 1}. ${n.name}`,
      n.brief ? `身份：${n.brief}` : "",
      `品阶：${tier}档`,
      n.entry ? `人设：${String(n.entry).replace(/\s+/g, "").slice(0, entryMax)}` : "",
    ].filter(Boolean);
    return bits.join("\n   ");
  }).join("\n\n");
}

/**
 * 构造装备规划请求。
 * @param {Array} npcs 待配装的人（一批）
 * @returns {{system:string, user:string}}
 */
export function buildCarryPlan(npcs) {
  const system = `你在给中文武侠文字游戏「曲措乡」的人物配随身物件。按每个人的身份、营生、品阶，给他配 2 到 4 件贴合的随身物。

【怎么配】
先看此人是干什么的，再配相称的东西：武人门派中人配兵器（刀剑枪棍暗器之类），医者配药囊金针草药，行商贩夫配算盘钱袋货样，僧道配念珠禅杖经卷，猎户配弓弩绳索，匠人配锤凿……别千篇一律、别人人都是一把刀。按品阶给相称的东西——品阶高的人可以有件像样的兵器或宝物，白绿档别配红档神兵。

【每件物件给四项】
- name：物件名，不超过 8 字，别用「这件装备」这类游戏术语
- category：weapon（兵器）／armor（护具）／accessory（饰物）／misc（杂物）四选一
- quality：白／绿／蓝／紫／橙／红 之一，不要超过此人的品阶
- desc：一句话，二十字以内，白话古文，说它什么样、什么手感或什么来历

【输出格式】只输出一个 JSON 数组，不要任何说明文字、不要 markdown 围栏：
[{"name":"人名","items":[{"name":"物件名","category":"weapon","quality":"蓝","desc":"描述"},{"name":"物件名","category":"misc","quality":"绿","desc":"描述"}]}]`;

  const user = `请为以下 ${npcs.length} 人各配随身物：\n\n${peopleBrief(npcs)}`;
  return { system, user };
}

/**
 * 净化模型返回的装备规划。品阶超过此人的自动压回，类别非法退回 misc，认不出的
 * 人名与空物件丢弃。返回 { index, items } 数组，index 对回这一批的下标。
 * @param {any} raw parseJsonLoose 的产出
 * @param {Array} npcs 这一批送去规划的人
 * @returns {Array<{index:number, items:Array}>}
 */
export function sanitizeCarryPlan(raw, npcs) {
  if (!Array.isArray(raw)) return [];
  const indexOf = new Map();
  npcs.forEach((n, i) => {
    if (n?.name) indexOf.set(String(n.name).trim(), i);
    for (const a of (n?.aliases || [])) if (a) indexOf.set(String(a).trim(), i);
  });

  const out = [];
  const seen = new Set();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const idx = indexOf.get(String(row.name || "").trim());
    if (idx === undefined || seen.has(idx)) continue;
    seen.add(idx);

    const cap = TIER_ORDER[QUALITIES[npcs[idx].levelCap]] ?? 0;
    const items = [];
    for (const it of (Array.isArray(row.items) ? row.items : [])) {
      const name = String(it?.name || "").trim().slice(0, 20);
      if (!name) continue;
      const category = CATEGORIES.includes(it?.category) ? it.category : "misc";
      let quality = QUALITIES.includes(it?.quality) ? it.quality : "白";
      if ((TIER_ORDER[quality] ?? 0) > cap) quality = QUALITIES[cap];   // 不超过此人品阶
      const desc = String(it?.desc || "").replace(/\s+/g, " ").trim().slice(0, 40);
      items.push({ name, category, quality, ...(desc ? { desc } : {}) });
      if (items.length >= 5) break;   // 一个人最多五件，别塞爆
    }
    if (items.length) out.push({ index: idx, items });
  }
  return out;
}
