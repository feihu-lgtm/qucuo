// NPC 出生固化：技能位 + 随身物品
// 核心原则：一个NPC第一次在某个房间出现时，系统本地一次性生成他的四个切磋技能位
// 和随身携带的物品，写死存进这个NPC对象，之后每次交互（查看/切磋/偷窃）都读取
// 这份固定数据，不再变化——跟"移动方向由固定地图裁决""拾取品质由系统骰子决定"
// 是同一个设计哲学：AI不参与数值判定，只负责在系统裁决的结果之上描述细节。
//
// 为什么不让AI在生成NPC时顺手编技能和物品：切磋和偷窃都要用这些数据做真实的
// 数值计算（伤害、克制、成功率），如果每次都让AI自由发挥，同一个NPC今天有这四个
// 技能明天变成另外四个，战斗和偷窃系统就没有稳定的地基可用。
//
// 本文件只留装配入口 ensureNpcCombatData 与战斗掉落 rollBattleLoot；
// 生成器实现按职责拆在 npcStats/npcMovesets/npcCarry/npcSkillMoves，re-export 保兼容。

import { random } from "../../../utils/rng.js";
import { makeItem, ITEM_CATEGORY } from "../economy/equipment.js";
import { makeItemSmart } from "../../data/items/catalog.js";
import { generateNpcAttributes, getTierPower, generateNpcCombatStats } from "./npcStats.js";
import { generateNpcMoveset, deriveSignatureMoveset, resolveBurdenMoves } from "./npcMovesets.js";
import { OC_BY_NAME, ocCarryItems, rollNpcCarry } from "./npcCarry.js";

export {
  generateNpcAttributes, atkFromWaigong, hpFromNeigong, defFromNeigong, getTierPower,
} from "./npcStats.js";
export {
  MOVE_POOL, generateNpcMoveset, deriveSignatureMoveset, BURDEN_MOVE_POOL,
} from "./npcMovesets.js";
export { rollNpcCarry } from "./npcCarry.js";
export { SKILL_EFFECT_KEYS, deriveMoveFromSkill, deriveMovesetFromSkills } from "./npcSkillMoves.js";

const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

// 一次性完整初始化：给一个刚出现在场景里、还没有 moveset/carriedItems 字段的NPC
// 补全这两块数据。已经有这两个字段的NPC（说明之前生成过）直接跳过，不重新随机，
// 这是"固定不变"这条核心原则的落地保证。
export function ensureNpcCombatData(npc, options = {}) {
  if (npc.moveset && npc.carriedItems && npc.special && npc.combatStats) return npc; // 已经生成过，直接返回
  const levelCap = npc.levelCap ?? options.levelCap ?? 0;
  const special = npc.special || generateNpcAttributes(options);
  const tierPower = getTierPower(levelCap);
  // 所见即所得：如果 AI 在 room.npcs 里声明了 carry（出场时描述过的可见物品），
  // 用它初始化 carriedItems，而不是随机生成——NPC 身上有什么玩家看到什么，打死只掉那些。
  // carry 未声明（undefined）= 旧数据或未声明，回退到随机生成保持向后兼容。
  // carry = [] = AI 明确声明此人身无长物，carriedItems 为空，战斗只掉银两。
  let carriedItems;
  // 【判「非空」而不是判「存在」】空数组是 truthy——这一个字之差是
  // "偷不到东西/切磋不掉东西" 折腾了好几轮的真正根因：
  // npcPool.toRoomNpc() 会硬给每个人 `carriedItems: []`（占位），
  // 于是所有经它转换的 NPC（游走人口、驻场、护镖目标、赌石竞价者——
  // 也就是除 AI 现场生成之外的**全部** NPC）都会命中这个分支，
  // 拿着那个空数组直接返回，**residentNpcs.js 里精心配的 carry 与
  // rollNpcCarry 的兜底全被跳过**。玩家的体感就是"我给每个人都放了物品，
  // 可谁身上都摸不出东西"。
  // 真要表达"此人身无长物"，走下面 Array.isArray(npc.carry) 且 carry 为 []
  // 那条路（有显式声明），不该靠一个占位空数组来表达。
  if (Array.isArray(npc.carriedItems) ? npc.carriedItems.length > 0 : !!npc.carriedItems) {
    carriedItems = npc.carriedItems;
  } else if (Array.isArray(npc.carry) && OC_BY_NAME[npc.name]) {
    // OC 冒险者：carry 是数据卡里的具名真货，stealables 私物同批落地——
    // 走 ocCarryItems 整批出，不然人设写的可偷物永远不会出现在掉落/偷窃里。
    carriedItems = ocCarryItems(OC_BY_NAME[npc.name], npc);
  } else if (Array.isArray(npc.carry)) {
    carriedItems = npc.carry.map((c, i) => ({
      ...makeGameItem({ name: c.name, category: c.category || ITEM_CATEGORY.MISC, quality: c.quality || "白" }),
      id: `${npc.id}_ci${i}`,
      stolen: false,
    }));
  } else {
    // 四池随身物：按 role×region×levelCap 抽 catalog 真货（替代旧匿名池）
    carriedItems = rollNpcCarry(npc, { ...options, levelCap });
  }
  // 品阶层四招：优先用 npcSignatureMoves.js 里登记的专属出招表（数值仍按
  // levelCap 对应品阶套用，只是名字/描述专属）；没登记专属招式的 NPC 回退到
  // generateNpcMoveset 的随机品质 + MOVE_POOL 通用名老逻辑，行为不变。
  const baseMoveset =
    deriveSignatureMoveset(npc, { ...options, levelCap }) ||
    generateNpcMoveset(npc, { ...options, levelCap });
  return {
    ...npc,
    special,
    // 品阶直接存在NPC身上——之前只在生成瞬间当参数用完就扔，UI想显示"这人是什么
    // 品阶"、AI想在叙事里知道"这人看着是什么分量"，都无从查起，只能反推stats，
    // 现在存成npc自己的字段，谁都能直接读。
    levelCap,
    neigong: npc.neigong ?? tierPower.neigong,
    waigong: npc.waigong ?? tierPower.waigong,
    baseAtk: npc.baseAtk ?? tierPower.baseAtk,
    equipAtk: npc.equipAtk ?? 0,
    equipDef: npc.equipDef ?? 0,
    // moveset = 品阶层固定招式（现有 generateNpcMoveset）+ 博弈层招式
    // （resolveBurdenMoves 解析 npc.burdenMoveIds，见 residentNpcs.js 里
    // 显式声明的博弈层招式id）。博弈层招式不受 levelCap 限制，任何角色
    // 只要声明了 burdenMoveIds 就能装备，体现"品阶定下限，博弈定上限"
    // 这个架构原则（总纲v3第十二章）。未声明 burdenMoveIds 的角色（绝大
    // 多数普通NPC）这里就是空数组，行为跟改动前完全一致，不影响老数据。
    moveset: npc.moveset || [...baseMoveset, ...resolveBurdenMoves(npc.burdenMoveIds)],
    carriedItems,
    combatStats: npc.combatStats || generateNpcCombatStats(special, levelCap),
  };
}

// 战斗胜利掉落：赢了切磋后，从NPC的随身物品（carriedItems）里随机掉落1件
// （如果还有没被偷过的），加上一笔银两。银两掉落额跟NPC的体魄挂钩——
// 体魄越高说明这个NPC本身越强（levelCap高的NPC体魄基准值也更高），
// 掉落的银两自然应该更多，不需要另起一套跟角色强度无关的固定值。
//
// 之所以复用carriedItems而不是单独设计一套"战利品池"：carriedItems本来就是
// 按luck品质分布生成的、这个NPC真实拥有的东西，赢了直接拿走符合直觉；
// 如果被玩家偷窃系统提前偷光了，战斗掉落就没有装备可拿，只剩银两，
// 这也是合理的——同一份"这个人身上有什么"的数据源，不重复建模。
export function rollBattleLoot(npc) {
  const availableItems = (npc.carriedItems || []).filter(i => !i.stolen);
  const droppedItem = availableItems.length > 0
    ? makeGameItem(availableItems[Math.floor(random() * availableItems.length)])
    : null;

  // 固定必掉（guaranteedLoot）：boss 级/剧情级 NPC 身上按剧情必掉的素材，
  // 不参与随机、一次全给（如虎王必掉 虎胆+虎王牙+虎王筋，供虎胆三重门和
  // 虎啸支线各取所需）。跟 droppedItem 的随机掉落并存。
  const guaranteedLoot = (npc.guaranteedLoot || []).map((g, i) => ({
    ...makeGameItem({ name: g.name, category: g.category || ITEM_CATEGORY.MISC, quality: g.quality || "白", desc: g.desc || "" }),
    id: `${npc.id || "npc"}_gloot_${i}`,
    equipped: false,
  }));

  // 之前掉落银两只看体魄（1-10的小范围），红袍高手和白袍杂鱼身家统计上没区别，
  // 跟"品阶对应身家"这个直觉对不上。baseAtk 已经是按品阶指数增长的数（见
  // getTierPower），这里直接拿来做银两的主要来源，体魄只作为同档位内的小幅浮动。
  const bodyStat = npc.special?.体魄 ?? 5;
  const baseMoney = 10 + Math.round((npc.baseAtk ?? 18) * 0.5) + bodyStat * 3;
  const droppedMoney = baseMoney + Math.floor(random() * baseMoney * 0.6);

  return { droppedItem, droppedMoney, guaranteedLoot };
}
