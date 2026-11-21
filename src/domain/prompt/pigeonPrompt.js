import { renderPromptTemplate } from "./promptRefs.js";

export function buildPigeonPrompt(state, { npcName, giftName, channel }, preset, trace) {
  const npcObj = state.room?.npcs?.find((npc) => npc.name === npcName) || {};
  const bio = (npcObj.brief ? "，" + npcObj.brief : "") + (npcObj.fullBio ? npcObj.fullBio + " " : "") +
    (npcObj.personality ? "性情：" + npcObj.personality + "。" : "");
  const scope = { ...state, npcName, bio, scenario: preset.scenario || "", promptRefOptions: { factLimit: 12 } };
  const facts = renderPromptTemplate("@事实摘要", scope, { trace }).text;
  const factsBlock = facts ? "你也隐约知道的近来见闻（可自然带一两句，不要生硬罗列）：\n" + facts : "";
  const gaveGift = channel === "postgift" && giftName;
  return renderPromptTemplate(`你是武侠世界「曲措乡」中的【@npcName】@bio
你与主角的关系：好感度 @通信.好感度/100@通信.态度。好感越低越冷淡疏离，越高越亲近热络。
剧本背景：@scenario
你收到主角${gaveGift ? `托驿卒捎来的信，并随信附赠了「@giftName」` : "寄来的信"}。你们此前往来的信件（须前后连贯、不自相矛盾）：
@通信.往来
@factsBlock
请以【@npcName】的口吻，用白话古文书信体写一封回信。只写信的正文（可含简短落款），约 80–160 字，关系冷淡则简短公事甚至推拒、亲厚则温言絮语${gaveGift ? "；收了礼要有所表示（谢或却）" : ""}。
写完信正文后，另起附两个隐藏标记（会被系统读走、玩家看不到，不要在正文提它们）：
① ⟦好感X⟧：X 为整数 -3~+8，表示这次通信${gaveGift ? "与收礼" : ""}让你对主角好感升降多少（寻常问候+1~2；说到心坎/贴心/有趣+3~+6；${gaveGift ? "礼物合心意可再高些至+8；" : ""}敷衍冒犯给负数）。
${gaveGift ? "② ⟦回礼:物品名|类别⟧：若你确实想回赠一件礼（类别取 weapon/armor/accessory/misc 之一），从你身份/处境合理拿得出手的东西里挑一件写在这里（例如僧人回赠念珠、猎户回赠兽皮、富贵者回赠玉器）；不想回或拿不出就整条省略。" : "（这次不涉及回礼，无需第二个标记。）"}`, { ...scope, factsBlock, giftName }, { trace }).text;
}
