// WO-24C world.prep 输出的 deterministic 白名单校验与拆种（纯函数）
// ============================================================================
// AI 只交素材，系统决定入不入库：npcName 必须在当时在场名单、containerId 必须在
// 当时未翻容器名单、数组长度按 schema 上限、quality/category 在枚举内——
// 非法条整条丢弃，绝不写入事实账（prepSeeds 是缓存不是事实）。
import { ITEM_CATEGORY } from "../economy/equipment.js";
import { createPrepSeed } from "./prepSeeds.js";

const QUALITY_ENUM = ["白", "绿", "蓝", "紫"];
const CATEGORY_ENUM = Object.values(ITEM_CATEGORY);

const asArr = (v) => (Array.isArray(v) ? v : []);
const asStr = (v) => (typeof v === "string" ? v.trim() : "");

// buildPrepSeedsFromOutput(data, ctx) → seeds[]
// ctx: { presentNpcNames, unlootedContainers, location, stateVersion, turn }
// ——全部来自发起时的快照（发起/返回两跳 stateVersion 一致时即最新口径）。
export function buildPrepSeedsFromOutput(data, ctx = {}) {
  if (!data || typeof data !== "object") return [];
  const npcNames = new Set(asArr(ctx.presentNpcNames));
  const containers = new Set(asArr(ctx.unlootedContainers));
  const base = {
    location: String(ctx.location || ""),
    stateVersion: String(ctx.stateVersion || ""),
    turn: Number.isInteger(ctx.turn) ? ctx.turn : 0,
  };
  const seeds = [];
  let seq = 0;

  // npcPlans 0-1：npcName 必须在场
  const plan = asArr(data.npcPlans)[0];
  if (plan && typeof plan === "object") {
    const npcName = asStr(plan.npcName);
    const planText = asStr(plan.plan);
    if (npcName && npcNames.has(npcName) && planText) {
      seeds.push(createPrepSeed({
        ...base, seq: seq++, kind: "npc_plan", subject: npcName,
        publicText: planText,
        payload: { npcName, plan: planText, nextAction: asStr(plan.nextAction) },
      }));
    }
  }

  // tavernRumors 0-1：文本非空即可（势力/宿敌牵连由 prompt 约束，系统不编）
  const rumor = asArr(data.tavernRumors)[0];
  if (rumor && typeof rumor === "object") {
    const text = asStr(rumor.text);
    if (text) {
      seeds.push(createPrepSeed({
        ...base, seq: seq++, kind: "tavern_rumor", subject: text,
        publicText: text,
        payload: { text, faction: asStr(rumor.faction), nemesisId: asStr(rumor.nemesisId) },
      }));
    }
  }

  // prepItems 0-2：containerId 必须在未翻容器名单，quality/category 在枚举
  for (const item of asArr(data.prepItems).slice(0, 2)) {
    if (!item || typeof item !== "object") continue;
    const containerId = asStr(item.containerId);
    const name = asStr(item.name);
    const quality = asStr(item.quality);
    const category = asStr(item.category);
    if (!containerId || !containers.has(containerId) || !name) continue;
    if (!QUALITY_ENUM.includes(quality) || !CATEGORY_ENUM.includes(category)) continue;
    seeds.push(createPrepSeed({
      ...base, seq: seq++, kind: "prep_item", subject: containerId,
      publicText: asStr(item.clue) || name,
      payload: { containerId, name, category, quality, clue: asStr(item.clue) },
    }));
  }

  return seeds.filter(Boolean);
}
