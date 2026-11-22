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
//   flags: ["promise_..."],                             // 额外记录的flag（承诺/势力声望等）
// }
// 分支点（completionFlag 是数组）额外支持 onReach.byFlag：{ 具体flag: {同上结构} }，
// 按这次真正命中的 flag 取对应的分支专属奖励，跟 base（byFlag 以外的字段）合并。

import { add, set, updateField } from "../state/applyWrite.js";

function mergeRewardParts(...parts) {
  const out = { items: [], favorability: {}, favorabilitySet: {}, money: 0, exp: 0, pot: 0, reputation: 0, flags: [] };
  for (const p of parts) {
    if (!p) continue;
    if (p.items) out.items.push(...p.items);
    if (p.favorability) Object.assign(out.favorability, p.favorability);
    if (p.favorabilitySet) Object.assign(out.favorabilitySet, p.favorabilitySet);
    if (p.money) out.money += p.money;
    if (p.exp) out.exp += p.exp;
    if (p.pot) out.pot += p.pot;
    if (p.reputation) out.reputation += p.reputation;
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

// 把 resolveStageRewards 的结果真正落地成游戏状态变化。
// setters: { setInv, setChar, setVarTree, setFlags } —— 全部是 MudRPG.jsx 里已有的 setState。
export function applyStageRewards(rewards, { setInv, setChar, setVarTree, setFlags }, now = Date.now()) {
  if (!rewards) return;
  if (rewards.items?.length) {
    setInv(updateField("inv", (prev) => set("inv", [
      ...prev,
      ...rewards.items.map((it, i) => ({ ...it, id: it.id || `quest_reward_${now}_${i}`, equipped: false })),
    ])));
  }
  if (rewards.money) {
    setChar(updateField("char", add("char.money", rewards.money)));
  }
  if (Object.keys(rewards.favorability).length) {
    setVarTree(updateField("varTree", Object.entries(rewards.favorability)
      .map(([name, delta]) => add(["角色", name, "好感度"], delta)), { defaultValue: 10 }));
  }
  if (Object.keys(rewards.favorabilitySet).length) {
    setVarTree(updateField("varTree", Object.entries(rewards.favorabilitySet)
      .map(([name, value]) => set(["角色", name, "好感度"], value))));
  }
  if (rewards.reputation) {
    setVarTree(updateField("varTree", add("世界.威望", rewards.reputation)));
  }
  if (rewards.flags?.length) {
    setFlags(updateField("flags", (f) => set("flags", [...new Set([...f, ...rewards.flags])])));
  }
}
