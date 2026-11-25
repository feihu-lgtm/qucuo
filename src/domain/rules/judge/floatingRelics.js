// WO-22B-P2 悬空秘宝登记表（纯数据+纯函数，无 AI）。
// 「悬空」语义：秘宝传说在江湖上飘着、尚未落到具体容器/人手里——判官 inspect_container
// 第三关掷中时优先落真品，落定即写 placed/唯一锁，之后绝不再注入（防复制神兵）。
//
// 登记纪律（工单硬约束）：只登记 roadmap/现有内容确有所指的最小集合，不许大规模编
// 世界设定。缺关键字段（id/name/regions/earliestDay）的登记项视为非法，注入侧跳过——
// 不得静默创造神兵。
//
// 状态落账：varTree.世界.悬空秘宝 = { [relicId]: { placed, droppedAt, turn } }——
// 由 materializeFacts 在 GRANT_ITEM 命中登记 id 时最小扩展写入（见该文件注释）。

export const FLOATING_RELICS = [
  {
    id: "relic_hantian_jianpu",
    name: "寒潭剑谱",
    // 地域锚定现有内容：贡措海水底石室（剑意寒潭廊/前辈剑修遗物，catalogExtra L920-927）
    // 与寒潭冰魄同源 lore——呼延大侠坠崖寒潭一脉。
    regions: ["贡措海"],
    earliestDay: 10, // 开场十日内的初探索期不出世，防开局即神兵
    quality: "紫",
    category: "misc",
    desc: "前辈剑修沉于寒潭的剑谱残帙，墨迹被寒泉浸得发蓝，字里行间都是剑意。",
    hint: "贡措海方向的寒潭水底",
  },
];

const VALID = (r) => r && typeof r.id === "string" && r.id
  && typeof r.name === "string" && r.name
  && Array.isArray(r.regions) && r.regions.length > 0
  && Number.isFinite(r.earliestDay);

export function relicById(id) {
  return FLOATING_RELICS.find((r) => r.id === id) || null;
}

// 注入过滤（envelope 组装侧调用）：合规地域 + 已到 earliestDay + 未被唯一锁标记。
// relicState = varTree.世界.悬空秘宝（无则全未落定）。
export function resolveFloatingItems({ place, day, relicState } = {}) {
  const state = relicState || {};
  return FLOATING_RELICS
    .filter((r) => VALID(r))
    .filter((r) => r.regions.includes(place))
    .filter((r) => (day ?? 0) >= r.earliestDay)
    .filter((r) => !state[r.id]?.placed)
    .map((r) => ({
      id: r.id, name: r.name, quality: r.quality, category: r.category, desc: r.desc,
      hint: r.hint, placed: false,
    }));
}
