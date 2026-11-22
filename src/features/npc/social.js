// NPC 社交动作：认出 / 端详 / 搭话。
// 从 logic.js 按动作分组拆出——这组只管"靠近与认识"，不涉及财物或学艺。
import { QUALITY } from "../../domain/rules/economy/equipment.js";
import { markNpcAsKnown as markNpcKnown, markNpcAsLooked } from "../../domain/rules/npc/npcAwareness.js";
import { bar } from "../../utils/mudHelpers.js";
import { ESCORT_QUESTS } from "../../domain/data/quests/escortQuests.js";
import { recordNpcAttempt } from "./anger.js";
import { add, updateField } from "../../domain/rules/state/applyWrite.js";
import { questPlaceDistrict } from "../../domain/rules/quests/questPlace.js";
import { grantFactionRep } from "../../domain/rules/economy/factionRep.js";

export function recognizeNpc(_state, npc) {
  if (!npc?.name) return {};
  return { changes: { varTree: (prev) => markNpcKnown(prev || {}, npc.name) } };
}

export function lookNpc(_state, npc) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }] };
  const extraReplies = [];
  if (npc.combatStats?.hp) {
    const [hp, maxHp] = npc.combatStats.hp;
    extraReplies.push({ t: "stat", text: `  ${npc.name} 气血 ${bar(hp, maxHp, 10)} ${hp}/${maxHp}` });
  }
  if (typeof npc.levelCap === "number") {
    const tier = QUALITY[Math.max(0, Math.min(5, npc.levelCap))];
    extraReplies.push({ t: "stat", text: `  ${npc.name} 品阶 ${tier}袍` });
  }
  return {
    changes: { varTree: (prev) => markNpcAsLooked(markNpcKnown(prev || {}, npc.name), npc.name) },
    extraReplies,
  };
}

export function talkToNpc(state, npc, { now = Date.now() } = {}) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }] };
  const result = { changes: { varTree: (prev) => recordNpcAttempt(prev, npc.name, { kind: "talk", detail: "", time: now }) } };
  const roomName = state.room?.name;
  const flags = state.flags || [];
  const activeEscort = ESCORT_QUESTS.find((quest) => (
    state.questProgress?.[quest.id]?.active
    && quest.targetNpc === npc.name
    && questPlaceDistrict(quest.targetLocation) === roomName
    && !flags.includes(quest.daily
      ? `${quest.daily}${Math.floor((state.time || 0) / 24)}`
      : `quest_done_${quest.id}`)
  ));
  if (activeEscort) {
    const doneFlag = activeEscort.daily
      ? `${activeEscort.daily}${Math.floor((state.time || 0) / 24)}`
      : `quest_done_${activeEscort.id}`;
    result.changes = {
      ...result.changes,
      questProgress: (prev) => ({ ...prev, [activeEscort.id]: { active: false } }),
      flags: (prev) => [...prev, doneFlag],
      char: updateField("char", add("char.money", activeEscort.reward)),
      pot: (prev) => prev + 10,
      varTree: (prev) => {
        // 保留上面 recordNpcAttempt 的搭话记录，再叠势力声誉（走死对头联动）。
        let next = result.changes.varTree(prev);
        if (activeEscort.factionRep) next = grantFactionRep(next, activeEscort.factionRep).varTree;
        return next;
      },
    };
    result.logs = [
      { t: "sys", text: `  你找到了${npc.name}，交出货物，护镖任务「${activeEscort.title}」圆满完成！` },
      { t: "item", text: `  💰 报酬：${activeEscort.reward} 两 · 潜能 +10` },
      ...(activeEscort.factionRep
        ? Object.entries(activeEscort.factionRep).map(([faction, rep]) => ({ t: "affection", text: `  ✦ ${faction}声誉 +${rep}` }))
        : []),
    ];
    result.completedEscort = true;
    return result;
  }
  if (npc.cannotSpeak) {
    result.logs = [{
      t: "sys",
      text: `  ${npc.name}歪着头看你，喉间发出低低的声响，却说不出半句人话——它听不懂你的言语，你也无从与它交谈。（它不能说话，但你可以投喂食物，日久或能与它亲近）`,
    }];
    return result;
  }
  result.logs = [{ t: "sys", text: `  你走向${npc.name}，看样子是想说些什么。` }];
  return result;
}
