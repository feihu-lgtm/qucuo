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
//   reputation: 10,                                     // 江湖威望增减（世界.威望，-100~100，按原值落盘，不吃 AI ±15 限幅）
//   factionRep: { "鱼定村": 5 },                         // 势力声誉增减（世界.势力声誉.<势力>，-100~100，按原值落盘）
//   flags: ["promise_..."],                             // 额外记录的flag（承诺/势力声望等）
// }
// 分支点（completionFlag 是数组）额外支持 onReach.byFlag：{ 具体flag: {同上结构} }，
// 按这次真正命中的 flag 取对应的分支专属奖励，跟 base（byFlag 以外的字段）合并。

import { add, set } from "../state/applyWrite.js";
import { merge } from "../state/applyPatches.js";
import { makeNamedItem } from "../../data/items/catalog.js";
import { applyFactionRep } from "../economy/factionRep.js";
import { SECT_MEMBER_FLAGS, defectedFlag, sectTokenOf } from "../character/factionEntry.js";

function mergeRewardParts(...parts) {
  const out = { items: [], favorability: {}, favorabilitySet: {}, money: 0, exp: 0, pot: 0, reputation: 0, factionRep: {}, quietFactionRep: {}, factionRepSet: {}, expelFrom: [], consumeItems: [], flags: [] };
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
    for (const [faction, delta] of Object.entries(p.quietFactionRep || {})) {
      out.quietFactionRep[faction] = (out.quietFactionRep[faction] || 0) + delta;
    }
    if (p.factionRepSet) Object.assign(out.factionRepSet, p.factionRepSet);
    if (p.expelFrom) out.expelFrom.push(p.expelFrom);
    if (p.consumeItems) out.consumeItems.push(...p.consumeItems);
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
  if (rewards.consumeItems?.length) {
    patches.push(merge("inv", (prev) => rewards.consumeItems.reduce((inv, name) => {
      const index = inv.findIndex((item) => item?.name === name);
      return index < 0 ? inv : [...inv.slice(0, index), ...inv.slice(index + 1)];
    }, prev)));
  }
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
    // 与 factionRep 同理：任务奖励按合稿原值一次落盘，不吃 AI 写入的单次 ±15 限幅。
    patches.push(merge("varTree", (tree) => {
      const prestige = Math.max(-100, Math.min(100, (Number(tree?.世界?.威望) || 0) + rewards.reputation));
      return { ...tree, 世界: { ...tree?.世界, 威望: prestige } };
    }));
  }
  if (Object.values(rewards.factionRep || {}).some(Boolean)) {
    patches.push(merge("varTree", (tree) => applyFactionRep(tree, rewards.factionRep, { step: Infinity })));
  }
  // 暗中出手（合稿 stealth）：只动本家，不牵连对头。
  if (Object.values(rewards.quietFactionRep || {}).some(Boolean)) {
    patches.push(merge("varTree", (tree) => applyFactionRep(tree, rewards.quietFactionRep, { step: Infinity, ripple: false })));
  }  // 声誉直接重置（合稿「背叛重置为 -70」「跌至不共戴天」这类），在增减之后写，最终值以它为准。
  if (Object.keys(rewards.factionRepSet || {}).length) {
    patches.push(merge("varTree", (tree) => ({
      ...tree,
      世界: {
        ...tree?.世界,
        势力声誉: {
          ...tree?.世界?.势力声誉,
          ...Object.fromEntries(Object.entries(rewards.factionRepSet).map(([faction, value]) => [faction, Math.max(-100, Math.min(100, value))])),
        },
      },
    })));
  }
  // 任务里背叛本门：是本门弟子才逐出（摘弟子身份、记叛出、收信物），不是弟子不动。
  for (const sect of rewards.expelFrom || []) {
    const member = SECT_MEMBER_FLAGS[sect];
    patches.push(merge("flags", (flags) => (flags.includes(member)
      ? [...flags.filter((flag) => flag !== member && flag !== defectedFlag(sect)), defectedFlag(sect)]
      : flags)));
    patches.push(merge("inv", (inv) => inv.filter((item) => (typeof item === "string" ? item : item?.name) !== sectTokenOf(sect))));
  }

  if (rewards.flags?.length) {
    patches.push(merge("flags", (f) => [...new Set([...f, ...rewards.flags])]));
  }
  return patches;
}
