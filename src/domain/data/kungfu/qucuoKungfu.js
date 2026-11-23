// 曲措乡武学目录：各武馆出售的功法秘籍清单。
// 武学分三类：招式（战斗用，有 moveType）、内功（被动加成 passiveBonus）、轻功（被动加成）。
// 购买后以"入门"阶段加入角色的 skills 数组，通过 deriveMovesetFromSkills 自动影响战斗。
//
// passiveBonus 目前支持：maxHp（气血上限加成）、speedBonus（身法加值，影响先手判断）。
// 被动加成在 MudRPG 里调用 computePassiveBonus(skills) 汇总后叠加到 char 的相关字段上。

export const SKILL_TYPE = {
  MOVE: "招式",
  NEIGONG: "内功",
  QINGGONG: "轻功",
};

// 各武馆的武学目录，key 对应 qucuoBuildings.js 里 skillSet 字段

import { SKILL_CATALOG } from "./catalog/index.js";

export { SKILL_CATALOG };

// 汇总某角色skills里所有内功/轻功的被动加成。
//
// 【这个函数曾经从来没有被调用过】文件头写着"被动加成在 MudRPG 里调用
// computePassiveBonus(skills) 汇总后叠加到 char 的相关字段上"——MudRPG 里没有这一行。
// 结果是 15 门武学里 9 门带 passiveBonus 的全是死数据：青城玄门气的气血+20、
// 梯云纵的身法+2、独孤九剑的身法+2、雪山养气诀的+15，一个都没生效，只在图鉴里
// 显示得挺好看。整个内功/轻功品类的存在意义都悬着。
// 现在接上了，两条出口分别是：
//   maxHp     → effectiveMaxHp()，叠进战斗入场血量、面板显示、以及各处回血封顶
//   speedBonus→ equipment.js 的 effectiveSpecial()，叠进七维「身法」（resolveTurn
//               里同类型对撞比身法定先手，正是文件头承诺的那个用途）
// 两条都做成**派生**而不是写回存档：写回存档会在读档/重复习得时反复叠加，
// 而派生值随 skills 变化自动跟上，也不需要给老存档写迁移。
export function computePassiveBonus(skills) {
  const bonus = { maxHp: 0, speedBonus: 0 };
  if (!Array.isArray(skills)) return bonus;
  for (const s of skills) {
    if (s?.passiveBonus) {
      bonus.maxHp += (Number(s.passiveBonus.maxHp) || 0);
      bonus.speedBonus += (Number(s.passiveBonus.speedBonus) || 0);
    }
  }
  return bonus;
}

// 有效气血上限 = 存档里的 hp[1] + 内功被动。
// 【为什么不直接改 hp[1]】hp[1] 是存档字段，且会被内功修炼（MudRPG 里 newMax 那段）
// 真实写高。把被动也写进去，读档时分不清哪部分是修炼来的、哪部分是装备/武学给的，
// 卸掉武学就减不回去。所以被动一律派生，hp[1] 只保留"自身修为"这一份。
// 全项目凡是要用"这个人到底有多少血上限"的地方都该走这里：战斗入场、面板显示、
// 打坐/客栈/丹药的回血封顶。
export function effectiveMaxHp(baseMaxHp, skills) {
  const base = Number(baseMaxHp) || 0;
  return base + computePassiveBonus(skills).maxHp;
}

// 检查某个 skill id 是否已被玩家习得
export function hasSkill(skills, skillId) {
  return skills.some(s => s.id === skillId);
}

// 拜师/偷师学到的招式：并入"武学"栏统一管理，但学到即【完整版】——不修炼、不
// 成长，没有阶段/等级/经验。保存完整招式本体 move，deriveMovesetFromSkills 原样
// 取用，不做阶段缩放（区别于武馆买的可修炼武学）。
// source 标注这一条是怎么来的，供右栏 UI 显示不同小标签：
//   "拜师"（专属招，倾囊相授）/ "拜师·通用"（平民教通用招池的招）/ "偷师"（偷来的）
// 不传 source 时兜底成 "拜师"，向后兼容旧调用点。
export function makeLearnedMoveSkill(move, source = "拜师") {
  return {
    id: move.id,
    name: move.name,
    type: SKILL_TYPE.MOVE,
    moveType: move.type,                 // 攻击/防御/状态
    quality: move.quality || "白",       // 完整版的品阶，直接显示
    fixed: true,                         // 固定招：武学栏不显示成长条
    upgradable: false,                   // 与 fixed 同义，供统一习得系统按这个字段判断能否升阶
    learned: true,                       // 来源：拜师/偷师所授，区别于武馆买的
    source,                              // ★来源维度："拜师" | "拜师·通用" | "偷师"
    active: false,
    move: { ...move, sourceSkill: move.name }, // 完整招式本体，带 sourceSkill 与派生招统一
  };
}

// 从目录定义生成一条 skills 数组里的初始记录（武馆购买）
export function makeSkillEntry(catalogItem) {
  return {
    id: catalogItem.id,
    name: catalogItem.name,
    type: catalogItem.type,
    quality: catalogItem.quality || "白", // 武学本身的品阶（白绿蓝紫橙红），随学会带入，供武学栏显示。
    level: 1,
    exp: 0,
    maxExp: 100,
    stage: "入门",
    active: false,
    moveType: catalogItem.moveType,
    passiveBonus: catalogItem.passiveBonus || null,
    source: "武馆",       // ★来源维度，武馆买的都能潜能升阶
    upgradable: true,     // 与 fixed:false 同义
  };
}
