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

function getRumoredNpc(varTree, name) {
  return varTree.世界?.[RUMOR_KEY]?.[name] || null;
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

// ── WO 过渡复接：SEAL 尾章涌现申报校验（纯函数）──
// SEAL 与正文同出模型一人之口，凡申报必经五路校验，非法项安静丢弃：
//   · 名字必须在正文真实出现（防自证空报）；
//   · 剔除空白/超长/玩家名/在场 NPC/同伴（含雪豹）/驻场名册/已有传闻重复项；
//   · emergedNpc 必须对应 varTree.世界.传闻人物 里已存在的传闻——无传闻不登场；
//   · description 只准定性短句：非数字、不超 40 字、不带阿拉伯数字数值。
import { getAllResidentNpcNames } from "../../data/npc/residentNpcs.js";
import { getImportedResidentNames } from "../cards/importedRegistry.js";
import { COMPANION_SLOTS } from "../companion/companionSlots.js";

const MAX_NAME_LEN = 8;

function exclusionSet({ roomNpcs = [], playerName = "" } = {}) {
  const set = new Set([...getAllResidentNpcNames(), ...getImportedResidentNames()]);
  for (const slot of COMPANION_SLOTS) if (slot?.label) set.add(slot.label);
  for (const npc of roomNpcs) if (npc?.name) set.add(npc.name);
  if (playerName) set.add(playerName);
  return set;
}

function isValidNewName(name, { screenText, excluded }) {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > MAX_NAME_LEN) return false;
  if (trimmed.includes("雪豹")) return false;
  if (excluded.has(trimmed)) return false;
  return String(screenText || "").includes(trimmed);
}

// 返回值全是干净副本；非法项进 notes/warnings，不进状态。
export function validateEmergenceSeal(sealData, {
  screenText = "", varTree = {}, roomNpcs = [], playerName = "",
} = {}) {
  const notes = [];
  const warnings = [];
  // 申报被拒清单（放行指标用）：模型在 SEAL 里声明了传闻/登场但校验没过——
  // 每一条都是模型申报质量失败的证据。重复传闻剔除不计入：传闻册不进 prompt，
  // 模型无从知晓在册名单，冗余非失败。
  const rejections = [];
  const excluded = exclusionSet({ roomNpcs, playerName });
  const rumors = varTree?.世界?.[RUMOR_KEY] || {};

  const mentionedNewNpcs = [];
  const rawMentioned = Array.isArray(sealData?.mentionedNewNpcs) ? sealData.mentionedNewNpcs : [];
  for (const name of rawMentioned) {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (rumors[trimmed]) {
      // 重复申报只进 notes 不进 rejections：传闻册不进 prompt，模型无从知晓
      // 哪些名字已在册——重复是冗余不是质量失败，不能压放行指标 passed 率。
      notes.push(`「${trimmed}」已在传闻册，重复申报剔除`); continue;
    }
    if (!isValidNewName(trimmed, { screenText, excluded })) {
      const msg = `传闻申报「${trimmed || "?"}」未过校验（未见正文/在册/非法形），丢弃`;
      notes.push(msg); rejections.push(msg);
      continue;
    }
    if (!mentionedNewNpcs.includes(trimmed)) mentionedNewNpcs.push(trimmed);
  }

  let emergedNpc = null;
  const rawEmerged = sealData?.emergedNpc;
  if (rawEmerged && typeof rawEmerged === "object") {
    const name = typeof rawEmerged.name === "string" ? rawEmerged.name.trim() : "";
    const description = typeof rawEmerged.description === "string" ? rawEmerged.description.trim() : "";
    if (!name || !rumors[name]) {
      const msg = `登场申报「${name || "?"}」无对应传闻，丢弃`;
      notes.push(msg); rejections.push(msg);
    } else if (name.length > MAX_NAME_LEN || name.includes("雪豹") || excluded.has(name)) {
      // 与传闻申报同一套排除：旧存档可能有脏传闻，登场校验不能指望册子天然干净
      const msg = `登场申报「${name}」命中排除名单（玩家/在场/同伴雪豹/驻场/超长），丢弃`;
      notes.push(msg); rejections.push(msg);
    } else if (!String(screenText || "").includes(name)) {
      const msg = `登场申报「${name}」未在正文登场，丢弃`;
      notes.push(msg); rejections.push(msg);
    } else if (!description || description.length > 40 || /\d/.test(description)) {
      const msg = `登场申报「${name}」定性描述非法（空/超长/带数值），丢弃`;
      warnings.push(msg); rejections.push(msg);
    } else {
      emergedNpc = { name, description };
    }
  }
  return { mentionedNewNpcs, emergedNpc, notes, warnings, rejections };
}
