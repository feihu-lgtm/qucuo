import { buildNarratorWhisperContext, narratorVoicePrompt, narratorWhisperLengthNote } from "../narrator/narrator.js";
import { seaDialoguePrompt } from "../narrator/narratorQuest.js";

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
  const promptRefEvents = [];
  const trace = (paths) => promptRefEvents.push(paths);
  const systemPrompt = inSeaNow
    ? `${seaDialoguePrompt({ stage: narrator.stage, comfort: seaVars.comfort, spokenKeys: seaVars.knots || [], STAGES: narratorStage })}${recallBlock}\n${narratorWhisperLengthNote(narrator.affection, apiCfg.narratorWhisperWords)}`
    : `${buildNarratorWhisperContext(narrator.affection)}\n${narratorVoicePrompt(narrator, trace)}\n\n${worldState}${snowLeopardBlock}${factsBlock}${recallBlock}${tallyBlock}${narratorLoreBlock}${bodyWhisperText}${topicGateText}${questGateText}\n\n剧本背景设定：${whisperGateText}\n${narratorWhisperLengthNote(narrator.affection, apiCfg.narratorWhisperWords)}`;

  const talkWindow = Math.max(apiCfg.contextWindow, 20);
  const history = convo.length > talkWindow ? convo.slice(-talkWindow) : convo;
  // convo 条目会带 kind/memory 这类内部字段——API 只认 role/content，剥掉再喂。
  const messages = [...history.map(({ role, content: c }) => ({ role, content: c })),
    { role: "user", content: `（私聊）${content}` }];
  const maxTokens = Math.min(apiCfg.maxTokens, apiCfg.callTokenLimits?.narratorWhisper ?? 6000);
  return { systemPrompt, messages, maxTokens, promptRefEvents };
}
