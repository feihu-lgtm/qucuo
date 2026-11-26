// W-ROAM 增量：NPC 进出玩家视野房的轻量即时反应调用（roam.reaction）。
// 提示词全文按外部审查增量图纸逐字入库——不写预制固定台词，由模型按现场切片
// 当场擦出江湖化学反应。零状态写入：只回一段 60-110 字白描，替换公屏占位行下的 desc。
import { definePrompt } from "../registry.js";

const ROAM_REACTION_SYS = `你是《天都·曲措》的现场白描说书人。此刻玩家所在的屋舍或场地里，刚有人走入或离开。请根据现场材料，写一段来去之人与周遭天地、在场人物之间的即时反应。

一、焦点与分量
只写进门或出门这一个照面的动静，两到四句，控制在 60 至 110 字之间，纯散文输出，不加标题，不输出 JSON，不带任何隐藏标记。

二、人与世界的咬合（按材料自然取用，不硬凑）
1. 扣住天时地气与近前余波。外面正刮风落雪，进门人肩头便带着寒气霜渣；屋里刚有过争执、酒气或翻箱动静，来人踏进门槛自会察觉异样，离人也会顺着气氛甩袖或避让。
2. 扣住身份关系与心账体温。与主角素昧平生的过客，目光只掠过屋中陈设、灵兽或同场熟人，向店家点头或自寻角落落脚，不无故凑上来搭讪；与主角相识且有恩怨心账、宿敌旧伤或生气未消者，眼神、脚步或顺口撂下的半句话须透出那份冷暖亲疏。
3. 扣住声口限制。标明灵兽者只写鼻息、耳朵、爪尾动作与兽鸣，标明机关人偶者只写机括声响，标明哑者只写手势神情，一律不出人言。

三、绝对禁区
这是世界自发的呼吸，不是玩家的回合。严禁替主角开口答话或替主角做出任何动作；严禁编造物品交接、银钱往来、动手交锋或新任务；已标明离开此处的人，写完背影与余音即止，不得写成仍留在场内。`;

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
