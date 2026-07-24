// 斗蛐蛐（快速战役）· 参战阵容池
// 把 npcPool.js 的游走人口 + residentNpcs.js 的驻场人口合并成一份统一的
// "可供挑选的参战者名单"，跟主线剧情/存档完全脱钩——这里只借用两份数据
// 现成的 name/brief/personality/levelCap/beast 字段，不读取、不修改任何
// 玩家存档状态，是一次性、无副作用的"沙盘推演"。

import { NPC_POOL } from "../npcPool.js";
import { RESIDENT_NPCS } from "../residentNpcs.js";
import { ensureNpcCombatData } from "../npcGeneration.js";
import { getDefaultProfile } from "../combat/personalityProfile.js";
import { mapDescriptionToGenParams } from "../npcDescriptionMapping.js";

// 有写实立绘的角色（public/bidders/full/）：名字 → 立绘文件名（去 .png）。
// 只有这几位有精美立绘，选人界面拿他们当"卖相担当"，其余人用品阶色占位卡。
// 值跟 GambleStoneScreen 的 PORTRAIT_BY_NAME 保持一致（雪山弟子→雪山门人）。
export const PORTRAIT_NAME = {
  李若由: "李若由", 锦官差役: "锦官差役", 雪山弟子: "雪山门人",
  黑风寨采买: "黑风寨采买", 才旦: "才旦", 苏宛: "苏宛",
  兰姐: "兰姐", 温掌柜: "温掌柜",
};

// 据点名 → 所属大区，纯展示用（选人界面按大区分组，不影响任何战斗逻辑）
const DISTRICT_REGION = {
  鱼定村: "村寨", 鱼定土司: "村寨", 玉泉寨: "村寨",
  天都镇: "市集", 锦官城: "市集",
  喇嘛庙: "寺院", 白塔: "寺院",
  雪山派: "门派", 后山平台: "门派", 山洞: "门派", 顶峰: "门派",
  大草甸: "荒野", 贡措海: "荒野",
};

// 合并出全部候选人，每人补一个 source 字段区分来源（纯展示，无逻辑意义）
export function getAllBattleCandidates() {
  const list = [];

  for (const npc of NPC_POOL) {
    list.push({
      id: npc.id,
      name: npc.name,
      brief: npc.brief,
      personality: npc.personality,
      levelCap: npc.levelCap ?? 0,
      beast: false,
      portrait: PORTRAIT_NAME[npc.name] || null,
      source: "游走",
      region: "四方游走",
    });
  }

  for (const [district, npcs] of Object.entries(RESIDENT_NPCS)) {
    for (const npc of npcs) {
      list.push({
        id: npc.id,
        name: npc.name,
        brief: npc.brief,
        personality: npc.personality,
        levelCap: npc.levelCap ?? 0,
        beast: !!npc.beast,
        portrait: PORTRAIT_NAME[npc.name] || null,
        source: district,
        region: DISTRICT_REGION[district] || "其它",
      });
    }
  }

  // 按名字去重：才旦/李若由/苏宛等在游走池和驻场表里都有（同一个人两地行走），
  // 合并后会重复。保留后出现的那个——驻场表在 NPC_POOL 之后 push，通常带更权威的
  // levelCap 和 fullBio，留驻场版更合适。
  const seen = new Map();
  for (const c of list) seen.set(c.name, c);
  const deduped = [...seen.values()];

  // 按 levelCap 从高到低排（强者在前，方便玩家一眼看到有分量的角色），
  // 有立绘的同档位再往前提一点（卖相好的优先露脸），最后按名字稳定排序
  deduped.sort((a, b) =>
    (b.levelCap - a.levelCap) ||
    ((b.portrait ? 1 : 0) - (a.portrait ? 1 : 0)) ||
    a.name.localeCompare(b.name, "zh"));
  return deduped;
}

// 给一个候选人生成"可以直接上场"的完整战斗快照：数值(hp/energy/攻防) +
// 招式 + 性格权重。每次开战都重新生成一份全新快照（不写回任何全局池子），
// 保证同一个人可以反复拉出来打、互不影响、也不会串改主线存档里的同名NPC。
//
// 性格权重走 mapDescriptionToGenParams 的本地关键词映射（读 personality 字段），
// 比 getDefaultProfile 的中庸权重更贴角色人设，且全程无网络——好战的真会莽、
// 老成的真会守。匹配不到关键词时自动退回中庸兜底，绝不为此报错。
export function buildBattleFighter(candidate) {
  const seedNpc = {
    id: `qb_${candidate.id}_${Math.random().toString(36).slice(2, 8)}`, // 每次开战独立id，不串场
    name: candidate.name,
    levelCap: candidate.levelCap,
  };
  const combatNpc = ensureNpcCombatData(seedNpc, { levelCap: candidate.levelCap });

  let profile;
  try {
    const desc = `${candidate.brief || ""} ${candidate.personality || ""}`;
    profile = mapDescriptionToGenParams(desc).personalityProfile || getDefaultProfile();
  } catch {
    profile = getDefaultProfile();
  }

  return {
    ...combatNpc,
    brief: candidate.brief,
    personality: candidate.personality,
    portrait: candidate.portrait,
    beast: candidate.beast,
    profile,
  };
}
