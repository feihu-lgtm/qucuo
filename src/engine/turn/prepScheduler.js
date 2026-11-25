// WO-24A 后台备料调度决策（纯函数，不接 UI 不调 AI）
// 只在玩家「空档」触发类型之一且当前地点无有效备料时返回 shouldPrep。
// 本模块只决定「该不该备、备什么类型」，生成由后续工单的 AI 链路负责。

import { validPrepSeeds } from "../../domain/rules/prep/prepSeeds.js";

// 触发枚举（契约冻结）：lodging 住店过夜 / meditate 打坐调息 /
// travel 跨据点赶路 / reading 阅读空档。空档语义——玩家本来就闲，备料不抢回合。
export const PREP_TRIGGERS = ["lodging", "meditate", "travel", "reading"];

// 每种触发偏好的备料类型（最小口径，后续可调）：
// 住店/阅读偏传闻坯，打坐偏 NPC 幕后计划，赶路偏道具铺垫。
const TRIGGER_KIND_HINT = {
  lodging: "tavern_rumor",
  meditate: "npc_plan",
  travel: "prep_item",
  reading: "tavern_rumor",
};

// decidePrep({trigger, state, seeds}) → {shouldPrep, kind, reason}
// 硬闸：trigger 不在枚举 → false；当前地点已有任一有效备料 → false（缓存未耗不重复备）。
export function decidePrep({ trigger, state = {}, seeds = [] } = {}) {
  if (!PREP_TRIGGERS.includes(trigger)) {
    return { shouldPrep: false, kind: null, reason: "trigger_not_allowed" };
  }
  if (!state?.room?.name) {
    return { shouldPrep: false, kind: null, reason: "no_place" };
  }
  const valid = validPrepSeeds(seeds, state);
  if (valid.length > 0) {
    return { shouldPrep: false, kind: null, reason: "cache_valid" };
  }
  return { shouldPrep: true, kind: TRIGGER_KIND_HINT[trigger] || "npc_plan", reason: "idle_window" };
}
