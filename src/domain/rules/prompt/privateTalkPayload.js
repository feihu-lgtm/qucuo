import { buildNarratorWhisperContext, narratorVoicePrompt, narratorWhisperLengthNote } from "../narrator/narrator.js";
import { seaDialoguePrompt } from "../narrator/narratorQuest.js";
import { getPromptOverrides } from "./registry.js";

function pickOverride(ov, id, fallback) {
  const rule = ov?.[id];
  if (!rule) return fallback;
  if (rule.mode === "off") return "";
  if (typeof rule.text === "string") return rule.text;
  return fallback;
}

function pickLoreOverride(ov, fallback) {
  const rule = ov?.narrator_lore;
  if (!rule) return fallback;
  if (rule.mode === "off") return "";
  if (typeof rule.text === "string") {
    const trimmed = rule.text.trim();
    if (!trimmed) return "";
    return trimmed.startsWith("[旁白专属设定")
      ? `\n\n${trimmed}`
      : `\n\n[旁白专属设定，只有你自己知道，玩家看不到这段文字，不要复述它的存在]\n${trimmed}`;
  }
  return fallback;
}

export function buildPrivateTalkPayload({
  narrator,
  content,
  apiCfg,
  convo,
  inSeaNow,
  seaVars,
  worldState,
  snowLeopardBlock,
  factsBlock,
  recallBlock,
  tallyBlock,
  narratorLoreBlock,
  bodyWhisperText,
  topicGateText,
  questGateText,
  whisperGateText,
  narratorStage,
}) {
  const ov = getPromptOverrides();
  const promptRefEvents = [];
  const trace = (paths) => promptRefEvents.push(paths);

  const recallPart = pickOverride(ov, "recall", recallBlock);
  const lengthPart = pickOverride(
    ov,
    "whisper_length",
    narratorWhisperLengthNote(narrator.affection, apiCfg.narratorWhisperWords),
  );

  let systemPrompt;
  if (inSeaNow) {
    systemPrompt = `${seaDialoguePrompt({ stage: narrator.stage, comfort: seaVars.comfort, spokenKeys: seaVars.knots || [], STAGES: narratorStage })}${recallPart}\n${lengthPart}`;
  } else {
    const ctxPart = pickOverride(ov, "whisper_ctx", buildNarratorWhisperContext(narrator.affection));
    const voicePart = pickOverride(ov, "voice", narratorVoicePrompt(narrator, trace));
    const worldPart = pickOverride(ov, "world_state", worldState);
    const factsPart = pickOverride(ov, "facts", factsBlock);
    const tallyPart = pickOverride(ov, "whisper_tally", tallyBlock);
    const lorePart = pickLoreOverride(ov, narratorLoreBlock);
    const bodyPart = pickOverride(ov, "body_gate", bodyWhisperText);
    const topicPart = pickOverride(ov, "topic_gate", topicGateText);
    const questPart = pickOverride(ov, "quest_gate", questGateText);
    const scenarioBody = pickOverride(ov, "whisper_scenario", whisperGateText);
    const scenarioPart = scenarioBody ? `\n\n剧本背景设定：${scenarioBody}` : "";
    const head = [ctxPart, voicePart].filter(Boolean).join("\n");
    const middle = `${worldPart}${snowLeopardBlock}${factsPart}${recallPart}${tallyPart}${lorePart}${bodyPart}${topicPart}${questPart}`;
    systemPrompt = `${head}\n\n${middle}${scenarioPart}\n${lengthPart}`;
  }

  const talkWindow = Math.max(apiCfg.contextWindow, 20);
  const history = convo.length > talkWindow ? convo.slice(-talkWindow) : convo;
  // convo 条目会带 kind/memory 这类内部字段——API 只认 role/content，剥掉再喂。
  const messages = [...history.map(({ role, content: c }) => ({ role, content: c })),
    { role: "user", content: `（私聊）${content}` }];
  const maxTokens = Math.min(apiCfg.maxTokens, apiCfg.callTokenLimits?.narratorWhisper ?? 6000);
  return { systemPrompt, messages, maxTokens, promptRefEvents };
}
