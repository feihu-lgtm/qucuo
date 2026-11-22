import { useCallback } from "react";
import { QUCUO_QUESTS } from "../../../domain/data/quests/qucuoQuests.js";
import { getActivePreset } from "../../../domain/rules/prompt/presetSystem.js";
import { describeCatalogForAI } from "../../../domain/data/items/catalog.js";
import { buildBudgetInstruction, INTENT } from "../../../domain/rules/prompt/inputIntent.js";
import { buildNarratorWhisperContext, gateQuestTopic, narratorVoicePrompt, narratorWhisperLengthNote } from "../../../domain/rules/narrator/narrator.js";
import { gateBodyProfile } from "../../../domain/rules/character/bodyProfile.js";
import { matchNpcLore, buildNpcLoreBlock, gateScenario } from "../../../domain/rules/prompt/worldbook.js";
import * as importedRegistry from "../../../domain/rules/cards/importedRegistry.js";
import { buildMainStatePrompt, buildWhisperStatePrompt, getPresentNpcs, renderPromptTemplate } from "../../../domain/rules/prompt/promptRefs.js";
import { gameStore } from "../../../store/gameStore.js";

export function usePromptInspector({
  log, narrator, inv, char, time, room, innerRoomName, varTree, varTreeRef, preset, apiCfg, nsfwOn, questProgress,
}) {
  const buildBugReportTurns = useCallback(() => {
    const groups = [];
    let current = null;
    for (const entry of log) {
      const isStandalone = entry.t === "room" || entry.standalone;
      if (isStandalone) {
        if (current) { groups.push(current); current = null; }
        groups.push({ entries: [entry] });
      } else if (entry.t === "cmd") {
        if (current) groups.push(current);
        current = { entries: [entry] };
      } else {
        if (!current) current = { entries: [] };
        current.entries.push(entry);
      }
    }
    if (current) groups.push(current);
    return groups.map((g, i) => {
      const cmdEntry = g.entries.find(e => e.t === "cmd");
      const firstText = (cmdEntry?.text || g.entries[0]?.text || "").replace(/^[>\s]+/, "").trim();
      const label = `#${i + 1} ${firstText.slice(0, 20) || "（场景/系统）"}`;
      const preview = g.entries.map(e => (e.text || "").trim()).filter(Boolean).join("\n");
      return { label, preview, entries: g.entries };
    });
  }, [log]);

  const getLiveBlockText = useCallback((view) => {
    const out = {};
    const put = (k, v) => { if (v != null && String(v).trim()) out[k] = String(v); };
    try {
      const scope = view?.scope || "full";
      const activePreset = getActivePreset();
      const state = gameStore.getState();

      if (scope === "whisper") {
        put("whisper_ctx", buildNarratorWhisperContext(narrator.affection));
        put("voice", narratorVoicePrompt(narrator));
        put("world_state", buildWhisperStatePrompt(state, { preview: true }));
        put("facts", renderPromptTemplate("@事实摘要", {
          varTree: varTreeRef.current, promptRefOptions: { factLimit: 8 },
        }).text || "（事实账本当前为空）");
        put("narrator_lore", (apiCfg.narratorLorebook || "").trim() || "（未填写，本块一个字都不发）");
        const bg = gateBodyProfile(char.bodyProfile, { whisper: true, nsfw: nsfwOn, scanText: "" });
        put("body_gate", bg.text || `（当前灭灯：${bg.dark.join("、") || "体貌未填写"}）`);
        put("topic_gate", "（默认不给。命中身世/赌石邀帖等关键词才点亮——这里没有输入，故灭灯）");
        const qg = gateQuestTopic("任务", narrator.affection, QUCUO_QUESTS, questProgress);
        put("quest_gate", qg.text || "（本轮没聊到任务）");
        put("whisper_scenario", gateScenario(activePreset.scenario, { scope: "whisper", userInput: "", lastReply: "" }).text);
        put("whisper_length", narratorWhisperLengthNote(narrator.affection, apiCfg.narratorWhisperWords));
        return out;
      }

      put("voice", narratorVoicePrompt(narrator));
      const intentCode = view?.intent || "UNKNOWN";
      const fakeIntent = INTENT[intentCode] || INTENT.UNKNOWN;
      put("length", buildBudgetInstruction(fakeIntent, "", apiCfg.targetWordCount, apiCfg.intentBudgets));
      put("preset_scenario", gateScenario(activePreset.scenario, { scope, userInput: "", lastReply: "" }).text);
      for (const [blockId, promptId] of [["preset_genrules", "generalRules"], ["preset_wenfeng", "styleRules"]]) {
        const found = (preset.prompts || []).find(x => x.id === promptId || (x.name || "").includes(blockId === "preset_genrules" ? "通用规则" : "文体"));
        if (found?.content) put(blockId, found.content);
      }
      const visible = getPresentNpcs(state);
      put("npc_lore", buildNpcLoreBlock(matchNpcLore(
        [...(preset.npcLore || []), ...importedRegistry.getImportedNpcLore()],
        { roomNpcNames: visible.map(n => n.name), userInput: "", lastReply: "", includeLastReply: false }
      )) || "（本轮无在场者需注入人设）");
      if (scope === "full") put("catalog", describeCatalogForAI());
      const bg2 = gateBodyProfile(char.bodyProfile, { scope, nsfw: nsfwOn, scanText: "" });
      put("body_gate", bg2.text || `（当前灭灯：${bg2.dark.join("、") || "体貌未填写"}）`);
      put("user_ctx", buildMainStatePrompt({ ...state, visibleNpcs: visible }, { preview: true }));
    } catch (e) {
      out.__error = `拉取时出错：${e.message || e}`;
    }
    return out;
  }, [narrator, inv, char, time, room, innerRoomName, varTree, varTreeRef, preset, apiCfg, nsfwOn, questProgress]);

  return { buildBugReportTurns, getLiveBlockText };
}
