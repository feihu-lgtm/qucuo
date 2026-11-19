import { useCallback, useEffect, useRef } from "react";
import { gameStore } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import {
  applyPigeonReply,
  failPigeonReply,
  processPigeons,
  recordPigeonNpcLocations,
} from "../../features/pigeon/logic.js";
import { callModel } from "../../apiConfig.js";
import { allFactSummaries } from "../../knowledge.js";
import { getTimeStr } from "../../utils/mudHelpers.js";

export function usePigeonReplies({
  room, apiCfg, preset, applyPigeonResult, time, varTree, featureCtxRef,
}) {
  const pigeonProcessing = useRef(new Set());

  useEffect(() => {
    applyResult(featureCtxRef.current, recordPigeonNpcLocations(gameStore.getState()));
  }, [room.name, room.npcs]);

  const replyPigeonLetter = useCallback(async (letter) => {
    const { npcName, sentContent, id, channel, giftName } = letter;
    const state = gameStore.getState();
    try {
      const npcObj = room.npcs.find(n => n.name === npcName) || {};
      const attrs = state.varTree?.角色?.[npcName] || {};
      const curAff = typeof attrs.好感度 === "number" ? attrs.好感度 : 0;
      const thread = (attrs.飞鸽 || []).map(m => `${m.dir === "send" ? "主角来信" : "你的回信"}：${m.content}${m.gift ? `（附礼：${m.gift}）` : ""}`).join("\n");
      const facts = allFactSummaries(state.varTree, 12).map(f => `· （${getTimeStr(f.诞生回合 || 0)}）${f.摘要}${f.标签 ? `〔${f.标签}〕` : ""}`).join("\n");
      const gaveGift = channel === "postgift" && giftName;
      const canReturnGift = gaveGift;
      const sys = `你是武侠世界「曲措乡」中的【${npcName}】${npcObj.brief ? "，" + npcObj.brief : ""}${npcObj.fullBio ? npcObj.fullBio + " " : ""}${npcObj.personality ? "性情：" + npcObj.personality + "。" : ""}
你与主角的关系：好感度 ${curAff}/100${attrs.态度 ? "，" + attrs.态度 : ""}。好感越低越冷淡疏离，越高越亲近热络。
剧本背景：${preset.scenario || ""}
你收到主角${gaveGift ? `托驿卒捎来的信，并随信附赠了「${giftName}」` : "寄来的信"}。你们此前往来的信件（须前后连贯、不自相矛盾）：
${thread || "（这是你们第一次通信）"}
${facts ? "你也隐约知道的近来见闻（可自然带一两句，不要生硬罗列）：\n" + facts : ""}
请以【${npcName}】的口吻，用白话古文书信体写一封回信。只写信的正文（可含简短落款），约 80–160 字，关系冷淡则简短公事甚至推拒、亲厚则温言絮语${gaveGift ? "；收了礼要有所表示（谢或却）" : ""}。
写完信正文后，另起附两个隐藏标记（会被系统读走、玩家看不到，不要在正文提它们）：
① ⟦好感X⟧：X 为整数 -3~+8，表示这次通信${gaveGift ? "与收礼" : ""}让你对主角好感升降多少（寻常问候+1~2；说到心坎/贴心/有趣+3~+6；${gaveGift ? "礼物合心意可再高些至+8；" : ""}敷衍冒犯给负数）。
${canReturnGift ? "② ⟦回礼:物品名|类别⟧：若你确实想回赠一件礼（类别取 weapon/armor/accessory/misc 之一），从你身份/处境合理拿得出手的东西里挑一件写在这里（例如僧人回赠念珠、猎户回赠兽皮、富贵者回赠玉器）；不想回或拿不出就整条省略。" : "（这次不涉及回礼，无需第二个标记。）"}`;
      const { text } = await callModel(apiCfg, sys, [{ role: "user", content: `主角的来信：${sentContent}` }], { maxTokens: apiCfg.callTokenLimits?.pigeonReply ?? 3000, callLabel: "飞鸽回信" });
      applyPigeonResult(applyPigeonReply(state, letter, text));
    } catch {
      pigeonProcessing.current.delete(id);
      applyPigeonResult(failPigeonReply(gameStore.getState(), letter));
    }
  }, [room.npcs, apiCfg, preset, applyPigeonResult]);

  useEffect(() => {
    const due = processPigeons(gameStore.getState()).filter(l => !pigeonProcessing.current.has(l.id));
    if (!due.length) return;
    due.forEach(l => { pigeonProcessing.current.add(l.id); replyPigeonLetter(l); });
  }, [time, varTree, replyPigeonLetter]);
}
