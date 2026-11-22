import "../../../content/index.js";
import { contentEntries } from "../../rules/content/registry.js";
// 据点固定驻场NPC：跟 npcPool.js 的"游走/按权重随机出现"是相反的概念——
// 这里登记的NPC只要玩家进了对应据点，就一定会出现在 room.npcs 里，不受
// 任何权重/时间段判定影响。
//
// 【为什么需要这份数据】感叹号任务面板的判定逻辑极其简单：
//   room.npcs?.some(n => n.name === quest.giver)
// 只要这个字符串在当前 room.npcs 里能找到，任务就会被检测到、显示出来。
// 但 qucuoQuests.js 里有7个任务的giver（巴桑/卓央/丹增/兰姐/梵衍那/罗琦/
// 柳青鸢），在 presets/qucuo.js 的初始房间数据、npcPool.js 的游走池里都
// 找不到对应实体——因为 presets/qucuo.js 只给开局据点（鱼定村）配置了
// 初始NPC，玩家走到其他据点，NPC是AI临场生成的，感叹号面板永远检测不到
// 这些具名剧情角色，他们的任务实质上永远不会出现在面板上。
//
// 这份表就是补这个缺口：登记"哪个据点，该固定驻场谁"，MudRPG.jsx 里
// 复用护镖任务"强制注入targetNpc"的同一个模式（见现有 activeEscortTargets
// 那段逻辑），玩家一进这个据点，就把对应固定NPC强制塞进 room.npcs，不用
// AI去猜、也不受随机权重影响。
//
// 【与 innerMap.js residentNpcName 的关系】innerMap.js 里的 residentNpcName
// 只回答"这个人该在哪个内层小房间"，是更细粒度的房间归属信息；这份表
// 回答的是更基础的一层问题："这个人到底存不存在于游戏运行时的NPC列表
// 里"。两者不冲突，配合使用：这份表负责"把人加载出来"，innerMap.js的
// residentNpcName 负责"在内层UI层面过滤展示到具体哪个房间"。
//
// brief/personality 字段跟 npcPool.js 保持同样的结构，供AI叙事时注入。
//
// 【carry 设计原则】每人≥7件：≥1武器+≥1护甲+≥1饰品+杂物若干。
// 武器类型配合武学风格（剑客配剑、掌法配杖/短匕、骑射配弩、寨主多兵器）。
// 具名物优先用 catalog 里有主的（掉出来有来历），缺口从制式通货池补。
// 品质不超 levelCap 对应档（白0/绿1/蓝2/紫3/橙4/红5）。

export const RESIDENT_NPCS = Object.fromEntries(contentEntries("residentGroup"));

export function getResidentNpcs(districtName) {
  return RESIDENT_NPCS[districtName] || [];
}

export function getAllResidentNpcLore() {
  const result = [];
  for (const npcs of Object.values(RESIDENT_NPCS)) {
    for (const npc of npcs) {
      const bioText = npc.fullBio || npc.personality || npc.brief || "";
      result.push({
        name: npc.name,
        entry: `- ${npc.name}（${npc.brief || ""}）：${bioText}`,
      });
    }
  }
  return result;
}

let _allResidentNames = null;
export function getAllResidentNpcNames() {
  if (!_allResidentNames) {
    _allResidentNames = new Set();
    for (const npcs of Object.values(RESIDENT_NPCS)) {
      for (const npc of npcs) _allResidentNames.add(npc.name);
    }
  }
  return _allResidentNames;
}
