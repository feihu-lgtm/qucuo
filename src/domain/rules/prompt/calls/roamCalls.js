// W-ROAM 增量：NPC 进出玩家视野房的轻量即时反应调用（roam.reaction）。
// 提示词全文按外部审查增量图纸逐字入库——不写预制固定台词，由模型按现场切片
// 当场擦出江湖化学反应。零状态写入：只回一段 60-110 字白描，替换公屏占位行下的 desc。
import { definePrompt } from "../registry.js";
import ROAM_REACTION_SYS from "../../../../copy/roamReaction.sys.txt?raw";


export function buildRoamReactionUserContent({
  placeLabel,
  roomDescBrief,
  diegeticLine,
  lastBeatEcho,
  movements = [],
  bystanders = [],
  playerName = "少侠",
} = {}) {
  const moveLines = movements.map((m) => {
    const dirPart = m.kind === "arrive"
      ? `刚从「${m.from}」走入此处`
      : `正离开此处，往${m.dirLabel}去「${m.to}」`;
    const motivePart = m.scheduled ? "（按日常营生作息往来）" : "（信步游走途经）";
    const voicePart = m.voiceTag ? `，发声限制为${m.voiceTag}` : "";
    const relationPart = m.relationBrief ? `；与${playerName}关系为${m.relationBrief}` : "；与主角尚未结识";
    const ledgerPart = m.latestLedger ? `，近账记有「${m.latestLedger}」` : "";
    const carryPart = m.carryBrief ? `，外显随身物有${m.carryBrief}` : "";
    return `· ${m.name}（${m.brief || "江湖人"}）${dirPart}${motivePart}${voicePart}${carryPart}${relationPart}${ledgerPart}`;
  });

  const lines = [
    `当前所在：${placeLabel}${roomDescBrief ? `（${roomDescBrief}）` : ""}`,
    diegeticLine ? `天时与${playerName}外显态势：${diegeticLine}` : "",
    lastBeatEcho ? `屋内方才余波：${lastBeatEcho}` : "",
    bystanders.length ? `原本在场者：${bystanders.join("、")}` : "原本在场者：除主角外空无旁人",
    "本刻进出动向：",
    ...moveLines,
    "请写出这一刻的现场即时反应：",
  ].filter(Boolean);

  return lines.join("\n");
}

export function registerRoamCalls() {
  definePrompt("block", "roam.reaction.sys", {
    label: "人物游走即时反应系统指令",
    slot: "sys",
    editable: "engine",
    text: () => ROAM_REACTION_SYS,
  });

  definePrompt("block", "roam.reaction.user", {
    label: "人物游走现场态势切片",
    slot: "user",
    editable: "engine",
    text: (ctx) => buildRoamReactionUserContent(ctx),
  });

  definePrompt("call", "roam.reaction", {
    group: "async",
    label: "游走进退场即时反应",
    execution: "async_background",
    route: "light",
    reviewDesc: "NPC 进出玩家当前房间时的轻量世界反应，关思考纯散文，受 epoch 与房间一致性双门禁保护，零状态写入",
    tokenLimitKey: "inspect",
    defaultMaxTokens: 240,
    cfg: (_apiCfg, ctx) => (ctx.cfg ? { ...ctx.cfg, thinkingMode: "off" } : undefined),
    modelOptions: { disableThinking: true },
    join: "",
    matrixBlocks: ["roam.reaction.sys", "roam.reaction.user"],
    blocks: ["roam.reaction.sys", "roam.reaction.user"],
  });
}

registerRoamCalls();
