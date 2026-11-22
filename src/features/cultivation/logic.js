import { set, updateField } from "../../domain/rules/state/applyWrite.js";
import { SKILL_CATALOG, effectiveMaxHp } from "../../domain/data/kungfu/qucuoKungfu.js";
import { isSkillBreakthroughLocked } from "../../domain/rules/economy/skillUnlock.js";
import { hpFromNeigong } from "../../domain/rules/npc/npcGeneration.js";
import { STAGES, STAGE_UP_COST } from "../../utils/mudHelpers.js";

export const trainCost = (value) => 4 + Math.floor((value ?? 0) / 10);

export function meditate(state) {
  const char = state.char;
  const cap = effectiveMaxHp(char.hp[1], state.skills);
  const hpGain = Math.max(1, Math.round(cap * 0.15));
  const nextHp = Math.min(cap, char.hp[0] + hpGain);
  return {
    changes: {
      char: updateField("char", set("char.hp", [nextHp, char.hp[1]]))(char),
      time: state.time + 1,
    },
    logs: [
      { t: "cmd", text: "> 打坐运功" },
      { t: "desc", text: "  你盘膝调息，气血回转了些。" },
      { t: "stat", text: `  气血 ${char.hp[0]}→${nextHp}` },
    ],
    note: { text: "打坐调息一回，气血回转了些。", source: "dumb" },
  };
}

export function trainNeigong(state) {
  const char = state.char;
  const current = char.neigong ?? 0;
  if (current >= 100) {
    return { logs: [{ t: "sys", text: "  内功已至大成，再无寸进之地（100/100）" }] };
  }

  const cost = trainCost(current);
  if (state.pot < cost) {
    return { logs: [{ t: "err", text: `  潜能不足，运气尚需${cost}点潜能（现有${state.pot}）` }] };
  }

  const next = Math.min(100, current + 1);
  const tiPo = char.special?.体魄 ?? 5;
  const oldMax = char.hp?.[1] ?? hpFromNeigong(current, tiPo);
  const newMax = hpFromNeigong(next, tiPo);
  const delta = Math.max(0, newMax - oldMax);
  const newCurrentHp = Math.min(newMax, (char.hp?.[0] ?? newMax) + delta);
  const name = char.name || "主角";

  return {
    changes: {
      pot: state.pot - cost,
      char: updateField("char", [set("char.neigong", next), set("char.hp", [newCurrentHp, newMax])])(char),
      time: state.time + 2,
    },
    logs: [
      { t: "cmd", text: "> 运气打坐（练内功）" },
      { t: "desc", text: "  你盘膝运气，内息缓缓精进了一分。" },
      { t: "stat", text: `  内功 ${current}→${next}（花费${cost}潜能）· 气血上限 ${oldMax}→${newMax}` },
    ],
    note: { text: "运气打坐，内功精进一分。", source: "dumb" },
    fact: {
      id: `train_neigong_${state.time}_${next}`,
      摘要: `${name}运气打坐，内功精进一分（${current}→${next}）。`,
      标签: "修炼",
      知晓者: [],
      currentTurn: state.time,
    },
  };
}

export function trainWaigong(state) {
  const char = state.char;
  const current = char.waigong ?? 0;
  if (current >= 100) {
    return { logs: [{ t: "sys", text: "  外功已至大成，再无寸进之地（100/100）" }] };
  }

  const cost = trainCost(current);
  if (state.pot < cost) {
    return { logs: [{ t: "err", text: `  潜能不足，拆招尚需${cost}点潜能（现有${state.pot}）` }] };
  }

  const next = Math.min(100, current + 1);
  const name = char.name || "主角";
  return {
    changes: {
      pot: state.pot - cost,
      char: updateField("char", set("char.waigong", next))(char),
      time: state.time + 2,
    },
    logs: [
      { t: "cmd", text: "> 拆招练武（练外功）" },
      { t: "desc", text: "  你反复拆解招式，外家功夫扎实了一分。" },
      { t: "stat", text: `  外功 ${current}→${next}（花费${cost}潜能）` },
    ],
    note: { text: "拆招练武，外功扎实一分。", source: "dumb" },
    fact: {
      id: `train_waigong_${state.time}_${next}`,
      摘要: `${name}拆招练武，外功扎实一分（${current}→${next}）。`,
      标签: "修炼",
      知晓者: [],
      currentTurn: state.time,
    },
  };
}

export function breakthroughSkill(state, skillRef) {
  const skills = state.skills || [];
  const hasMatchingId = skillRef !== undefined && skills.some((skill) => skill.id === skillRef);
  const index = hasMatchingId
    ? skills.findIndex((skill) => skill.id === skillRef)
    : skills.findIndex((skill) => skill.name === skillRef);
  if (index < 0) return { logs: [] };

  const skill = skills[index];
  if (skill.fixed) {
    return { logs: [{ t: "sys", text: `  ${skill.name}是授业绝学，学即完整，无需修炼。` }] };
  }

  const lock = isSkillBreakthroughLocked(state, skill, Object.values(SKILL_CATALOG).flat());
  if (lock.locked) {
    return { logs: [{ t: "sys", text: `  你已叛出${lock.faction}，「${skill.name}」的后续法门再无人传，只能守着现有火候。` }] };
  }

  const currentStageIndex = STAGES.indexOf(skill.stage);
  if (currentStageIndex < 0 || currentStageIndex >= STAGES.length - 1) {
    return { logs: [{ t: "sys", text: `  ${skill.name}已臻${skill.stage}，登峰造极，再无寸进。` }] };
  }

  const nextStage = STAGES[currentStageIndex + 1];
  const cost = STAGE_UP_COST[nextStage] ?? 12;
  if (state.pot < cost) {
    return { logs: [{ t: "err", text: `  潜能不足，${skill.name}突破${nextStage}需${cost}点潜能（现有${state.pot}）` }] };
  }

  return {
    changes: {
      pot: state.pot - cost,
      skills: skills.map((entry, entryIndex) => entryIndex === index ? { ...entry, stage: nextStage } : entry),
      time: state.time + 2,
    },
    logs: [
      { t: "cmd", text: `> 潜心修炼「${skill.name}」` },
      { t: "desc", text: `  日夜揣摩，${skill.name}的火候更进一层。` },
      { t: "stat", text: `  ${skill.name} ${skill.stage}→${nextStage}（花费${cost}潜能）· 招式威力、品阶随之精进` },
    ],
    note: { text: `潜心修炼${skill.name}，突破至${nextStage}。`, source: "dumb" },
  };
}
