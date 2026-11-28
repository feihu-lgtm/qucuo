// 地宫 13×13 Universal Schema、默认文案兜底与完整校验器。
// 让所有 8 座地宫共用一套零硬编码的数据契约与渲染/路由逻辑。

export const UNIVERSAL_TEXT_DEFAULTS = Object.freeze({
  supplyCheckpointDesc: "一处避风干燥的隐蔽石室，可供歇脚存下进度。",
  supplyHealLabel: "歇脚包扎（回血35%并稳环境）",
  supplyHealAction: "在此歇息裹伤",
  supplyNormalDesc: "一处僻静安全的落脚点，备有清水干粮，适合暂歇回气。",
  supplyNormalLabel: "饮水歇息回气",
  chestDesc: "死路角落静静卧着一只封蜡宝匣。",
  trapFailText: "机括骤发伤身",
  exitsAllRevealedText: "此地所有战术出口已尽数在握。",
  centerHintText: "中心重地就在坐标 ({cx},{cy}) 一带。",
  blindBoxFallback: null,
});

const REQUIRED_EVENT_KINDS = [
  "fight", "event", "nsfw", "supply", "loot", "watch", "meet", "appraise", "puzzle", "checkpoint",
];

const CHEST_TIERS = ["wood", "iron", "stone", "boss"];

/**
 * 补全 Universal 地宫配置的展示名与默认文本槽位并冻结返回。
 */
export function withDungeonDefaults(cfg) {
  return Object.freeze({
    ...cfg,
    displayName: cfg.displayName || cfg.name || cfg.id,
    texts: Object.freeze({
      ...UNIVERSAL_TEXT_DEFAULTS,
      ...(cfg.texts || {}),
    }),
  });
}

/**
 * 校验 13×13 大平面地宫配置是否满足全部 Universal 字段契约。
 * @returns {string[]} 错误消息列表；空数组代表完全合规。
 */
export function validateGridDungeonConfig(cfg) {
  const errors = [];
  const label = cfg?.displayName || cfg?.id || "未命名地宫";
  const reqStr = [
    "id", "displayName", "outerDistrict", "anchor", "bossRoom", "clearFlag", "envTag", "recruitToken",
  ];
  for (const key of reqStr) {
    if (!cfg?.[key] || typeof cfg[key] !== "string") {
      errors.push(`${label} 缺少字符串字段 ${key}`);
    }
  }
  if (cfg?.gridSize !== 13) errors.push(`${label} gridSize 必须为 13`);
  if (!Number.isFinite(cfg?.baseTier)) errors.push(`${label} 缺少 baseTier`);
  if ((cfg?.targetAdventurers ?? 0) < 7) errors.push(`${label} targetAdventurers 不足 7`);
  if (!cfg?.envMeter?.tagKey || !cfg?.envMeter?.field || !cfg?.envMeter?.label) {
    errors.push(`${label} envMeter 缺字段`);
  }
  if ((cfg?.prefixPool?.length ?? 0) < 6) errors.push(`${label} prefixPool 至少 6 项`);
  if ((cfg?.suffixPool?.length ?? 0) < 6) errors.push(`${label} suffixPool 至少 6 项`);
  if ((cfg?.descPool?.length ?? 0) < 3) errors.push(`${label} descPool 至少 3 项`);
  if ((cfg?.exitsPool?.length ?? 0) !== 6) errors.push(`${label} exitsPool 必须恰好 6 项`);
  if ((cfg?.puzzles?.length ?? 0) !== 3) errors.push(`${label} puzzles 必须恰好 3 道`);
  if ((cfg?.enemies?.length ?? 0) < 12) errors.push(`${label} enemies 至少 12 名`);
  if (!cfg?.boss?.name || !cfg?.boss?.desc) errors.push(`${label} boss 缺基础字段`);
  if (!cfg?.merchant?.npcName || (cfg?.merchant?.goods?.length ?? 0) < 6) {
    errors.push(`${label} merchant 货品不足 6 件`);
  }
  if ((cfg?.trades?.length ?? 0) < 3) errors.push(`${label} trades 至少 3 项`);
  if ((cfg?.trapChests?.length ?? 0) < 2) errors.push(`${label} trapChests 至少 2 项`);
  if ((cfg?.cards?.length ?? 0) !== 3) errors.push(`${label} cards 必须恰好 3 张`);
  if (!cfg?.divineArm?.itemName || !cfg?.divineArm?.flag || !cfg?.divineArm?.clueFlag || !cfg?.divineArm?.clueItem || !cfg?.divineArm?.fallbackItem?.name) {
    errors.push(`${label} divineArm 缺字段`);
  }
  for (const tier of CHEST_TIERS) {
    const pool = cfg?.chestPools?.[tier];
    if (!pool || !pool.moneyRange || !pool.expRange || !pool.potRange || !(pool.items?.length > 0)) {
      errors.push(`${label} chestPools.${tier} 不完整`);
    }
  }
  const kinds = new Set((cfg?.eventSeeds || []).map((e) => e.kind));
  for (const k of REQUIRED_EVENT_KINDS) {
    if (!kinds.has(k)) errors.push(`${label} eventSeeds 缺 ${k}`);
  }
  return errors;
}
