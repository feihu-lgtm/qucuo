import { buildSysBase } from "../../domain/prompt/sysBase.js";
import { renderFieldScales, renderPromptTemplate } from "../../domain/prompt/promptRefs.js";
import { step as traceStep, attachInjectionSnapshot } from "../../infra/actionTrace.js";
import { NSFW_RULES, MODE_PRIMER_MESSAGES } from "../../domain/prompt/modePrimer.js";
import { GM_RULE } from "../../domain/prompt/enginePrompts.js";
import { gateBodyProfile } from "../../domain/character/bodyProfile.js";
import { labelMessage, makeBlock } from "../../domain/prompt/tavernMapping.js";
import { buildDistantViewBlock } from "../../domain/memory/daySummary.js";
import { targetLedger } from "../../domain/prompt/materials/index.js";
import { embeddingReady } from "../../domain/memory/embeddingService.js";
import { buildExtractionCfg } from "../../domain/prompt/extractionEngine.js";
import { applyPresetOverrides, getActivePreset } from "../../domain/prompt/presetSystem.js";
import { createWebAi } from "../ports/ai.js";
import { buildAngryNote } from "../prompt/assemblePrompt.js";
import { getApiModel } from "../../core/apiModel.js";
import { formatSettleNote } from "../../domain/settle/settle.js";

const webAi = createWebAi();

// 调用一次主剧情（流式/非流式），返回 { rawFull, finishReason }。流式占位日志每次调用各自管理。
// narrativeOnly=true：提取层模式，主调用只输出散文；流式时将文本直接展示并保留在日志里。
// d 是 act 在调用点现取的回合上下文（ref 值按调用时机读取，保证时序与原闭包一致）。
export function buildMainCallPayload(extraNudge, narrativeOnly = false, d) {
  const traceEvents = [];
  const cmdSuffix = narrativeOnly ? "处理最新命令，直接输出叙事正文。" : "处理最新命令。纯JSON，字符串不换行。";
  // 成文铁律放在 user 块最末尾（酒馆语义里插入深度=0、贴着生成处的最强位，
  // 见 ST prompt-manager：Depth 0 = 提示末尾 = 最强）。文体规则若埋在 system 里
  // 位置太靠前、常被模型当耳旁风，这条挪到最低深度逼它逐段照做。
  const proseRule = "\n\n【成文铁律·逐段自查（本条最优先，落笔前先过一遍）】每写完一段，先在心里核两样再往下写：其一，这一段每个句子都要是完整句——主谓宾齐全、该带的定状补都补上，不许出现半截话、掐头去尾、省略到看不明白的残句；其二，这一段凡涉及到的，时间、地点、人物、起因、经过、结果都要交代到实处（这一段确实用不上的那几样可以不写，但只要沾边就得写全，不许用『那人』『某处』『后来』这类含糊词一笔带过）。宁可句子写得实、写得满，也绝不为省字丢主语宾语或掐断句子。";
  // 远景（日总结）作背景垫底，放在 ctx 之后、回忆之前——比"最近对话/回忆"更靠前=分量更轻，
  // 只保连贯不喧宾夺主。
  const distantBlock = buildDistantViewBlock(d.varTree, 5);
  // 动态注入 scope：结算轮只演既定事实（砍物件志/认知隔离/远景/极简schema），移动只喂场景相关，
  // 对话保留认知隔离，其余全量。创造模式必须全量（要能凭空发物品/召唤NPC），故 gm 时强制 full。
  const promptScope = d.gm ? "full"
    : d.isSettle ? "settle"
    : d.isTalk ? "talk"
    : d.intent.code === "MOVE" ? "move"
    : d.intent.code === "LOOK" ? "talk"  // 查看/环顾：只描述当前场景与在场人物，不发物品，砍物件志（同 talk 档）
    : "full";
  let _gateReport = null;
  let { sysBlocks, phiBlock, phiRules } = buildSysBase(
    d.apiCfg.targetWordCount, d.narrator, d.scenario, d.budgetInstruction,
    // 结算轮灭 lore——但牵涉具体某人的结算（送礼/拜师/赌石成交）仍要人设，
    // 否则那人只剩个名字，写出来的对白没脾气。此时保留 lore（本就是绿灯，只注入在场者）。
    d.embeddingEnabled, (d.isSettle && !d.settleNpc) ? "" : d.npcLoreBlockWithQuest, narrativeOnly, promptScope,
    {
      settleNpc: d.settleNpc || null,
      settleKind: d.settleKind || null,
      softSettle: d.softSettle || null,
      duelReport: d.duelReport || null,
      snowLeopardGift: d.settleKind === "gift" && d.settleNpc === "雪豹" && !!d.snowLeopardContext,
      giftInfo: d.giftInfo || null,
      settleBeast: !!d.settleBeast,
      hasNpc: d.visibleNpcsCount > 0,
      inSeaOfMind: !!d.inSeaOfMind,
      gm: d.gm,
      playerName: d.charName || "主角", // memory摘要统一用这个称呼，不用你/我，避免人称混乱
      activePreset: d.activePreset,
      // 物件志（批四）：只有本轮真可能发出物品才挂——移动拾取命中/战斗/创造模式。
      mayGrantItem: d.gm || d.intent.code === "COMBAT" || !!d.pickupJudgment,
      // scenario 绿灯扫描源（批三）：玩家本轮输入 + 上轮引擎回复，等同酒馆"扫描深度2"。
      // 战斗轮把 scope 记作 combat，好让装备掉落规则那条按状态点灯。
      gateCtx: d.gm ? null : {
        scope: d.intent.code === "COMBAT" ? "combat" : promptScope,
        userInput: d.cmd,
        lastReply: [...d.convo].reverse().find(m => m.role === "assistant")?.content || "",
      },
      onGateReport: (g) => { _gateReport = g; },
      onSnapshot: (snap) => traceEvents.push({ kind: "snapshot", snap }),
      onDuelReportMissing: (paths) => traceEvents.push({ kind: "step", label: "战报模板字段缺失", level: "warn", text: paths.join("、") }),
      onPromptRefMissing: (paths) => traceEvents.push({ kind: "step", label: "提示词引用缺失", level: "warn", text: paths.join("、") }),
    }
  );

  // NSFW + GM 规则提前到 11 号位（inChat，user role）——规则放 user 嘴里，
  // 不让 AI 在 assistant 位"补全"规则文本（旧 bug：GM_RULE 贴生成处，AI 顺着规则思考不写正文）。
  let rulesBlock = "";
  if (d.nsfwOn) {
    rulesBlock += NSFW_RULES + "\n" + MODE_PRIMER_MESSAGES.map(m => m.content).join("\n");
  }
  if (d.gm) {
    rulesBlock += (rulesBlock ? "\n" : "") + GM_RULE;
  }
  // ── 体貌·蓝绿灯 ──
  // 公开层跟着"这一轮有没有人近距离看着你"走（full/talk 亮，赶路结算灭），
  // 私密层只认 ■ 模式。灭灯不只是省 token——赶路轮塞一段私处描写，模型真的会
  // 顺着那个方向写。详见 bodyProfile.js 顶部。
  const _bodyGate = gateBodyProfile(d.charBodyProfile, {
    scope: promptScope,
    nsfw: d.nsfwOn,
    scanText: `${d.cmd}\n${[...d.convo].reverse().find(m => m.role === "assistant")?.content || ""}`,
  });
  if (_bodyGate.text) {
    const authorsNote = sysBlocks.find(b => b.tavernBlock === "authorsNote");
    if (authorsNote) authorsNote.content += (authorsNote.content ? "\n" : "") + _bodyGate.text;
  }
  if (_bodyGate.lit.length || _bodyGate.dark.length) {
    traceEvents.push({
      kind: "step", label: "体貌", level: "info",
      text: `🟢${_bodyGate.lit.join("、") || "无"}　⚫灭:${_bodyGate.dark.join("、") || "无"}`,
    });
  }

  // 计算 system 总长度（仅用于 trace 展示）。
  const sysLength = sysBlocks.reduce((sum, b) => sum + (b.content?.length || 0), 0);

  // 构造 Tavern 顺序的 user 侧消息数组。
  let chatMessages = [];
  // 结算轮：远景/召回/信息域灭灯——这一轮只是把一件已定的事写好看，不需要"记起往事"
  // 或"守信息域"，那些块是给有博弈的轮次用的。但牵涉具体某人时保留「重逢」块
  // （久别重逢那句招呼要认得人，是这类轮次唯一真正用得上的记忆信号）。
  // phiRules 是从 13 号位摘出来的约束（MVU 路径规矩 + 送礼/认主/拜师铁律 + 叙事铁律）。
  // 与 NSFW/GM 并列放 11 号位（user）：规则放 user 嘴里是指令，放 assistant 嘴里
  // 模型会当成自己已说出的话去续写。顺序上先立规矩、再给 [状态]。
  if (phiRules) rulesBlock += (rulesBlock ? "\n\n" : "") + phiRules;
  const rulesPrefix = rulesBlock ? rulesBlock + "\n\n" : "";
  const angrySettleNote = d.isSettle && d.settleNpc
    ? buildAngryNote(d.varTree, [d.settleNpc])
    : "";
  const ledgerBlock = targetLedger({
    target: d.settleNpc || d.activeTarget || d.talkTarget,
    room: d.room,
    varTree: d.varTree,
  });
  const ledgerSuffix = ledgerBlock ? `\n\n${ledgerBlock}` : "";
  const softSettleNote = d.softSettle ? formatSettleNote(d.softSettle) : "";
  const inChatContent = d.isSettle
    ? rulesPrefix + (d.snowLeopardContext || "") + (d.settleNpc ? d.reunionBlock : "") + ledgerSuffix + angrySettleNote + softSettleNote + "\n\n" + proseRule
    : rulesPrefix + d.ctx + distantBlock + d.recallBlock + ledgerSuffix + d.reunionBlock + d.infoDomainBlock + "\n\n" + proseRule;
  const latestUserContent = cmdSuffix + (extraNudge || "");

  // 10 号位 Chat History / 11 号位 In-Chat Injection / 12 号位 User's Latest Message。
  chatMessages.push(makeBlock("chatHistory", d.hist));
  chatMessages.push(makeBlock("inChat", inChatContent));
  chatMessages.push(makeBlock("latestUser", latestUserContent));
  // 13 号位 PHI（assistant role）：schema + 起始暗示。
  // prefill：assistant 位放"我马上要开始写了"的起始暗示，AI 顺着冒号直接写。
  // 【与姬侠传(char_card_1)的实际差别，别再照抄那句注释】它是 6 条消息，
  // assistant 在第 5 位、后面还跟一条 user("reply:{Order **扩写only**}")，
  // 所以那条 assistant 不是最后一条、不构成真 prefill，而是"假装 AI 上一轮
  // 已经答应了这些规则"的自我一致性施压——它那条里塞了 246 字的规则
  // （NSFW许可+格式复核+篇幅规格）。我们这里 phi 是真最后一条 = 真 prefill，
  // 两种技法不同：真 prefill 里堆规则更容易让模型顺着把规则续写完而不产正文，
  // 所以 NSFW/GM 规则挪去了 11 号位（user）。
  const prefillHint = narrativeOnly
    ? `\n回溯玩家输入「${d.cmd}」，直接续写正文：`
    : `\n回溯玩家输入「${d.cmd}」，直接输出JSON：`;
  phiBlock.content += prefillHint;
  chatMessages.push(phiBlock);

  // ── 赌石谈价·轻量挂载（借世界书"蓝灯/绿灯"思路：谈价这轮，重量条目全灭灯）──
  // 谈价是一对一、目标单一的对手戏，之前却挂着全量 talk 档（预设全文+在场全员lore+任务+
  // 认知隔离+远景/召回/重逢/信息域+20条历史+MVU），一轮砍价烧掉整套世界书。现在仿
  // inspectItem 的轻：sys/userContent 整体换成"文风+这一位竞价者的人设+石头局面+<deal>
  // 结算规则+近8条对话"。S2 convo/S3 小纸条/S4 账本照旧落（p.memory 仍写），记忆链不断。
  if (d.isTalk && d.gambleTalkCtx) {
    const g = d.gambleTalkCtx;
    const pers = g.persona || {};
    const dealWords = Math.min(d.apiCfg.targetWordCount || 220, 220);
    const dealFmt = narrativeOnly
      ? `直接输出对白叙事散文，写完即止。谈成明确协议（加价/让价/搭赠）则末尾另起一行附<deal>{"priceMult":1.0,"addItem":null}</deal>；未谈成不附。`
      : `回复纯JSON，字符串不换行：{"output":["行1","行2"],"memory":"≤50字谈价关键事实（无进展可省略）"}
谈成明确协议（加价/让价/搭赠）则另起一行附<deal>{"priceMult":1.0,"addItem":null}</deal>；未谈成不附。`;
    const gambleSys = `你是曲措乡这个武侠世界的说书人。此刻玩家在天都镇玉石料场的赌桌前，与竞价者「${g.bidderName}」就一块开出的玉料讨价还价——这是一场一对一的砍价对手戏，只演这一件事。

[这位竞价者]
${g.bidderName}${pers.brief ? `，${pers.brief}` : ""}。${pers.personality || ""}
${pers.bio || ""}
随身可搭赠之物：${(g.carry || []).map(i => i.name || i).join("、") || "无"}

[局面] ${g.scene || "赌桌上一块开出的玉料"}。${g.bidderName}当前报价约 ${g.baseOffer || "?"} 两（兜里现银上限 ${g.cash || "?"} 两）。

[砍价规则] 按其性格接招：玩家说得在理便松口，胡搅蛮缠便顶回去，也可主动搭赠随身物件促成交易；不要一轮就把价谈死，留出拉扯余地。本轮不改变房间/物品/任何游戏状态，只有对白、神态与心思。
对话用「」包裹，旁白叙述不加标记，心理用*斜体*。总字数约 ${dealWords} 字。

[结算标签说明] priceMult 是对原报价 ${g.baseOffer || "?"} 两的倍率（范围 ${renderPromptTemplate("@尺度.谈价", {}, { trace: (paths) => traceEvents.push({ kind: "step", label: "提示词引用缺失", level: "warn", text: paths.join("、") }) }).text}）；addItem 只能填其随身确有且愿搭的物件名，否则填 null。标签只给系统看，玩家看不到。${renderFieldScales(["gambleNegotiation.*.*.mult"])}

${dealFmt}`;
    const dealHist = d.mainConvo.slice(-8).map(m => (m.role === "user" ? "[玩家] " : "[引擎] ") + m.content).join("\n");
    sysBlocks = [makeBlock("main", gambleSys)];
    chatMessages = [
      makeBlock("chatHistory", `[最近对话]\n${dealHist}`),
      makeBlock("latestUser", `处理最新命令${narrativeOnly ? "，直接输出叙事正文。" : "。纯JSON，字符串不换行。"}${extraNudge || ""}`),
    ];
  }

  const _scopeLabel = (d.isTalk && d.gambleTalkCtx) ? "谈价·轻量"
    : ({ settle: "结算·轻量", move: "移动·精简", talk: "对话·中", full: "全量" }[promptScope] || promptScope);
  const _scopeWhy = _scopeLabel === "谈价·轻量" ? "，已砍预设/世界书/lore/召回/远景/MVU，仅留人设+局面+近8条对话"
    : promptScope === "settle" ? `，已砍物件志/认知隔离/lore/远景/召回/全量schema${d.settleNpc ? `（保留MVU：牵涉${d.settleNpc}）` : "/MVU"}`
    : promptScope === "move" ? "，已砍物件志/认知隔离/复杂schema/拓扑外的世界观"
    : promptScope === "talk" ? "，已砍物件志/拓扑与装备规则" : "";
  traceEvents.push({
    kind: "step", label: "Prompt注入", level: "info",
    text: `级别=${_scopeLabel}（system ${sysLength}字${_scopeWhy}）`,
  });
  // 调用模式标注：单调用/双调用是两条完全不同的 prompt 结构（前者主模型直接
  // 出JSON+MVU，后者主模型只写散文、好感度等状态判定全部转交提取层的另一
  // 个模型），排查"好感度怎么没变/怎么变得莫名其妙"时第一步就该确认走的
  // 是哪条路、双调用时具体是哪个模型在判——不写清楚，排查者会误以为
  // 主模型和判定好感度的模型是同一个。
  if (d.apiCfg.extractionEnabled) {
    // 与 MudRPG.act 里的 extractionSpecKey 保持同一套判定：对话模式走 TALK_CASUAL。
    // 两处若不一致，这行 trace 报的模型名就会和真正发起提取的那个对不上。
    const exKey = d.isTalk ? "TALK_CASUAL" : d.intent.code;
    const exCfg = buildExtractionCfg(exKey, d.apiCfg);
    traceEvents.push({
      kind: "step", label: "调用模式", level: "info",
      text: `双调用（叙事/状态分离）　主叙事模型=${getApiModel(d.apiCfg) || "未设置"}　提取模型(spec=${exKey})=${getApiModel(exCfg) || "未设置"}${getApiModel(exCfg) === getApiModel(d.apiCfg) ? "（未单独配置，沿用主模型）" : ""}`,
    });
  } else {
    traceEvents.push({
      kind: "step", label: "调用模式", level: "info",
      text: `单调用（叙事+状态一次性产出）　主模型=${getApiModel(d.apiCfg) || "未设置"}`,
    });
  }
  // 世界书点灯明细：🟢亮了哪条（被什么词/哪个状态点亮）、⚫灭了哪条。排"AI 怎么不知道 X"用。
  if (_gateReport && (_gateReport.lit.length || _gateReport.dark.length)) {
    traceEvents.push({
      kind: "step", label: "世界书·总纲", level: "info",
      text: `🟢${_gateReport.lit.join("、") || "无"}　⚫灭:${_gateReport.dark.join("、") || "无"}`,
    });
  }
  // 把当前激活的 Chat Completion 预设里配置的采样参数（temperature/maxTokens/
  // topP/topK/frequencyPenalty/presencePenalty）融合进这次调用的 cfg——只有预设
  // 里显式配置过（非 null）的字段才覆盖，其余沿用 apiCfg 原有的全局设置。
  // 主叙事这一路是唯一真正受"叙事风格采样参数"影响的调用点，私聊旁白/方向判定
  // /提取层等辅助调用不套用这份覆盖，避免预设改动意外影响到不相关的小任务。
  const effectiveCfg = applyPresetOverrides(d.apiCfg, d.effectivePreset);
  return {
    sysBlocks,
    chatMessages,
    effectiveCfg,
    stream: effectiveCfg.streamEnabled && effectiveCfg.apiType !== "gemini" && !d.duelReport,
    intent: { code: d.intent.code, label: d.intent.label },
    recallInfo: d.recallInfo,
    modelOptions: { callLabel: "主叙事" },
    traceEvents,
  };
}

export async function callMainOnce(extraNudge, narrativeOnly = false, d) {
  const payload = buildMainCallPayload(extraNudge, narrativeOnly, {
    ...d,
    embeddingEnabled: embeddingReady(d.apiCfg),
    activePreset: getActivePreset(),
    effectivePreset: getActivePreset(),
  });
  const { sysBlocks, chatMessages, effectiveCfg, stream, intent, recallInfo, modelOptions, traceEvents } = payload;
  for (const event of traceEvents) {
    if (event.kind === "snapshot") attachInjectionSnapshot(d._trace, event.snap);
    else traceStep(d._trace, event.label, event.level, event.text);
  }
  const ai = d.ai || webAi;
  if (d.isStale?.()) return { rawFull: "", finishReason: "stale" };
  if (stream) {
    const streamLogIndex = { current: null };
    d.addLog([{ t: "desc", text: "  ▌", streaming: true }]);
    d.setLog(l => {
      if (d.isStale?.()) return l;
      streamLogIndex.current = l.length - 1;
      return l;
    });
    const { text, finishReason } = await ai.chat(chatMessages, {
      cfg: effectiveCfg,
      systemPrompt: sysBlocks,
      stream: true,
      onChunk: (_delta, fullSoFar) => {
        d.setLog(l => {
          if (d.isStale?.() || streamLogIndex.current == null) return l;
          const copy = [...l];
          // 叙事模式：直接展示散文文本；JSON模式：只看最后200字（避免长 JSON 刷屏）
          copy[streamLogIndex.current] = { t: "desc", text: "  " + (narrativeOnly ? fullSoFar : fullSoFar.slice(-200)) + " ▌", streaming: true };
          return copy;
        });
      },
      intent,
      recallInfo,
      modelOptions,
    });
    if (d.isStale?.()) return { rawFull: "", finishReason: "stale" };
    if (narrativeOnly) {
      // 叙事模式：把流式条目转为永久日志项（而不是移除它）。谈价 <deal> 标签仅供系统，显示时剥掉。
      const shown = text.replace(/<deal>[\s\S]*?<\/deal>/gi, "").replace(/<deal>[\s\S]*$/i, "").trim();
      d.setLog(l => {
        if (d.isStale?.() || streamLogIndex.current == null) return l;
        const copy = [...l];
        copy[streamLogIndex.current] = { t: "desc", text: "  " + shown, streaming: false, streamed: true };
        return copy;
      });
    } else {
      // JSON 模式：移除占位条目（正式 output 会在解析后追加）
      d.setLog(l => (d.isStale?.() || streamLogIndex.current == null ? l : l.filter((_, i) => i !== streamLogIndex.current)));
    }
    return { rawFull: text, finishReason };
  }
  const result = await ai.chat(chatMessages, {
    cfg: effectiveCfg,
    systemPrompt: sysBlocks,
    intent,
    recallInfo,
    modelOptions,
  });
  if (d.isStale?.()) return { rawFull: "", finishReason: "stale" };
  return { rawFull: result.text, finishReason: result.finishReason };
}
