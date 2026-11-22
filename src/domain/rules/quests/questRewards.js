// 任务奖励的系统裁决层——参照 Bethesda Creation Kit「quest stage 挂 result script」
// 的设计：每个 stage 到达时，由系统而非AI直接执行奖励效果（加物品/改好感度/
// 加银两/记flag），而不是只在 log 里写一句好看的话却什么都没真的发生。
//
// stage.onReach 结构（全部可选）：
// {
//   items: [{ name, category, quality, desc }],       // 直接加进玩家背包
//   favorability: { "才旦": 60, "老孙": 30 },           // 相对增减（clamp 到 0-100）
//   favorabilitySet: { "才旦": 0 },                     // 绝对赋值（比如"好感归零"这种硬重置）
//   money: 40,                                          // 银两增减
//   exp: 3,                                             // 阅历（设计文档里的"阅历+N"）
//   pot: 0,                                             // 潜能
//   reputation: 10,                                     // 江湖威望增减（世界.威望，-100~100，单次自动限幅±15）
//   factionRep: { "鱼定村": 5 },                         // 势力声誉增减（世界.势力声誉.<势力>，-100~100，单次限幅±10）
//   flags: ["promise_..."],                             // 额外记录的flag（承诺/势力声望等）
// }
// 分支点（completionFlag 是数组）额外支持 onReach.byFlag：{ 具体flag: {同上结构} }，
// 按这次真正命中的 flag 取对应的分支专属奖励，跟 base（byFlag 以外的字段）合并。

import { add, set } from "../state/applyWrite.js";
import { merge } from "../state/applyPatches.js";
import { makeNamedItem } from "../../data/items/catalog.js";
import { applyFactionRep } from "../economy/factionRep.js";

function mergeRewardParts(...parts) {
  const out = { items: [], favorability: {}, favorabilitySet: {}, money: 0, exp: 0, pot: 0, reputation: 0, factionRep: {}, flags: [] };
  for (const p of parts) {
    if (!p) continue;
    if (p.items) out.items.push(...p.items);
    if (p.favorability) Object.assign(out.favorability, p.favorability);
    if (p.favorabilitySet) Object.assign(out.favorabilitySet, p.favorabilitySet);
    if (p.money) out.money += p.money;
    if (p.exp) out.exp += p.exp;
    if (p.pot) out.pot += p.pot;
    if (p.reputation) out.reputation += p.reputation;
    for (const [faction, delta] of Object.entries(p.factionRep || {})) {
      out.factionRep[faction] = (out.factionRep[faction] || 0) + delta;
    }
    if (p.flags) out.flags.push(...p.flags);
  }
  return out;
}

// 从一个刚推进过去的 stage + 这次真正命中的 flags，解析出最终应该生效的奖励。
export function resolveStageRewards(stage, hitFlags = []) {
  if (!stage?.onReach) return null;
  const { byFlag, ...base } = stage.onReach;
  if (!byFlag) return mergeRewardParts(base);
  const branchParts = hitFlags.map(f => byFlag[f]).filter(Boolean);
  if (!branchParts.length) return mergeRewardParts(base);
  return mergeRewardParts(base, ...branchParts);
}

// 把 resolveStageRewards 的结果收成 Patch[]，调用方统一经
// commitPatches(setters, patches) 分片提交（写入口只剩 applyPatches）。
// 每条 patch 与拆前 applyStageRewards 的写入逐条对应。
export function stageRewardPatches(rewards, now = Date.now()) {
  if (!rewards) return [];
  const patches = [];
  if (rewards.items?.length) {
    patches.push(merge("inv", (prev) => [
      ...prev,
      ...rewards.items.map((it, i) => ({
        ...(it.fromCatalog ? makeNamedItem(it.name) : it),
        id: it.id || `quest_reward_${now}_${i}`, equipped: false,
      })),
    ]));
  }
  if (rewards.money) {
    patches.push(add("char.money", rewards.money));
  }
  for (const [name, delta] of Object.entries(rewards.favorability)) {
    patches.push({ ...add(["角色", name, "好感度"], delta), options: { defaultValue: 10 } });
  }
  for (const [name, value] of Object.entries(rewards.favorabilitySet)) {
    patches.push(set(["角色", name, "好感度"], value));
  }
  if (rewards.reputation) {
    patches.push(add("世界.威望", rewards.reputation));
  }
  if (Object.values(rewards.factionRep || {}).some(Boolean)) {
    patches.push(merge("varTree", (tree) => applyFactionRep(tree, rewards.factionRep)));
  }
  if (rewards.flags?.length) {
    patches.push(merge("flags", (f) => [...new Set([...f, ...rewards.flags])]));
  }
  return patches;
}
