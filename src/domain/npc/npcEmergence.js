// NPC 涌现系统（参照 AI Roguelite 的设计思路）
// 核心原则跟 AI Roguelite 官方说明完全一致："AI 负责生成内容的名字/描述，
// 系统本地做 plausibility check + 数值裁决"——AI 不直接吐出技能/属性数值，
// 只负责给出定性描述，最终数值由系统本地映射，理由跟 npcGeneration.js
// 里"不让AI自由编技能池数值"是同一个理由：AI对"这个数字该多大"没有稳定校准。
//
// 人名识别这一步，不用正则猜测——中文人名边界模糊（"了捋胡须""子阿福就"这类
// 误判几乎不可避免），改为让AI在输出JSON里自己显式声明"这段话提到了哪些新的
// 具名人物"，这是AI天然擅长的语义判断，比字符窗口正则可靠得多，而且是同一次
// 请求内的信息，不产生额外调用。
//
// 两阶段设计保留：
// 1. AI声明"提到了新人物XX" -> 系统记一笔"传闻中的人物"，不立即生成技能/属性。
// 2. 玩家明确指向这个人（提到名字/去他可能在的地方）-> 系统指示AI下一轮把他
//    实体化，AI给出定性描述，系统本地映射成数值。

const RUMOR_KEY = "传闻人物";

// 记录AI本轮声明的新提及人物列表（由AI在JSON里通过 mentionedNewNpcs 字段
// 显式给出，不再靠正则猜测）。
export function recordRumoredNpcs(varTree, mentionedNames, context) {
  if (!mentionedNames || mentionedNames.length === 0) return varTree;
  const rumors = varTree.世界?.[RUMOR_KEY] || {};
  const nextRumors = { ...rumors };
  for (const name of mentionedNames) {
    if (nextRumors[name]) continue; // 已经记过，不重复覆盖上下文
    nextRumors[name] = { name, context: context || "", mentionedAt: Date.now() };
  }
  return {
    ...varTree,
    世界: { ...varTree.世界, [RUMOR_KEY]: nextRumors },
  };
}

export function getRumoredNpc(varTree, name) {
  return varTree.世界?.[RUMOR_KEY]?.[name] || null;
}

export function isRumoredNpc(varTree, name) {
  return !!getRumoredNpc(varTree, name);
}

// 判断玩家这句输入是否在"明确指向"某个传闻人物——对应触发实体化的第二阶段。
// 简单子串匹配即可：玩家输入里出现了这个人的名字，就认为是明确指向。
export function findTargetedRumor(varTree, playerInput) {
  const rumors = varTree.世界?.[RUMOR_KEY] || {};
  for (const name of Object.keys(rumors)) {
    if (playerInput.includes(name)) return rumors[name];
  }
  return null;
}

// 涌现之后，从"传闻"名单里移除（已经是正式NPC了，不再是传闻）
export function clearRumor(varTree, name) {
  const rumors = { ...(varTree.世界?.[RUMOR_KEY] || {}) };
  delete rumors[name];
  return { ...varTree, 世界: { ...varTree.世界, [RUMOR_KEY]: rumors } };
}
