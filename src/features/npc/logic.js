import { markNpcAsKnown } from "../../npcAwareness.js";
import { tryLearnFromMaster } from "../../kungfu/learnSkill.js";

export function learnNpcSkill(state, npc) {
  if (!npc) return { logs: [{ t: "err", text: "  此地没有这位人物。" }] };

  const char = state.char || {};
  const skills = state.skills || [];
  const decision = tryLearnFromMaster(npc, state.varTree || {}, skills, char);
  if (!decision.ok) {
    return { logs: [{ t: "sys", text: `  ${decision.reason}` }] };
  }

  const money = char.money || 0;
  if (money < decision.totalPrice) {
    return {
      logs: [{
        t: "sys",
        text: `  ${npc.name}愿意传授，但束脩需银${decision.totalPrice}两（现有${money}两），你银两不够，一时难以成行。`,
      }],
    };
  }

  const priceNote = decision.totalPrice > 0
    ? `，奉上束脩银${decision.totalPrice}两`
    : "（好感深厚，分文不取）";
  const label = decision.isMaster ? "授业绝学" : "江湖通行招";
  const verb = decision.isMaster ? "将平生所学" : "将几手江湖基本功";

  return {
    changes: {
      varTree: (prev) => markNpcAsKnown(prev || {}, npc.name),
      char: { ...char, money: money - decision.totalPrice },
      skills: [...skills, ...decision.freshSkills],
    },
    logs: [{
      t: "sys",
      text: `  （习得 ${decision.freshSkills.length} 招${priceNote}，已录入武学栏 · ${label}，学即完整）`,
    }],
    settle: `拜${npc.name}为师，${npc.name}${verb}「${decision.moveBrief}」倾囊相授，我凝神习得`,
    settleOptions: {
      settleNpc: npc.name,
      settleKind: "learn_skill",
      learnInfo: {
        isMaster: decision.isMaster,
        moveBrief: decision.moveBrief,
        totalPrice: decision.totalPrice,
        beast: !!npc.beast || !!npc.cannotSpeak,
      },
    },
  };
}
