import { definePrompt, getPromptDef } from "../registry.js";
import { buildNpcContext } from "../../npc/npcContext.js";

export function registerSideCalls() {
  definePrompt("block", "pigeon.sys", {
    label: "飞鸽回信系统指令",
    slot: "sys",
    text: (ctx, render) => {
      const state = ctx.state || {};
      const { npcName, giftName, channel } = ctx.letter || {};
      const preset = ctx.preset || {};
      const npcObj = state.room?.npcs?.find((npc) => npc.name === npcName) || { name: npcName };
      const { bio } = buildNpcContext(npcObj, state);
      const scope = { ...state, npcName, bio, scenario: preset.scenario || "", promptRefOptions: { factLimit: 12 } };
      const facts = render("@事实摘要", scope);
      const factsBlock = facts ? "你也隐约知道的近来见闻（可自然带一两句，不要生硬罗列）：\n" + facts : "";
      const gaveGift = channel === "postgift" && giftName;
      return render(`你是武侠世界「曲措乡」中的【@npcName】@bio
你与主角的关系：好感度 @通信.好感度/100@通信.态度。好感越低越冷淡疏离，越高越亲近热络。
剧本背景：@scenario
你收到主角${gaveGift ? `托驿卒捎来的信，并随信附赠了「@giftName」` : "寄来的信"}。你们此前往来的信件（须前后连贯、不自相矛盾）：
@通信.往来
@factsBlock
请以【@npcName】的口吻，用白话古文书信体写回信。只写正文（可含简短落款），约 80–160 字，关系冷淡则简短公事甚至推拒、亲厚则温言絮语${gaveGift ? "；收了礼要有所表示（谢或却）" : ""}。
正文后另起附两个隐藏标记（系统读走、玩家看不到，不要在正文提）：
① ⟦好感X⟧：X 为整数，表示这次通信${gaveGift ? "与收礼" : ""}让你对主角好感升降多少。@{尺度.飞鸽}
${gaveGift ? "② ⟦回礼:物品名|类别⟧：若你确实想回赠一件礼（类别取 weapon/armor/accessory/misc 之一），从你身份/处境合理拿得出手的东西里挑一件（如僧人回赠念珠、猎户回赠兽皮、富贵者回赠玉器）；不想回或拿不出就整条省略。" : "（这次不涉及回礼，无需第二个标记。）"}`, { ...scope, factsBlock, giftName });
    },
  });

  definePrompt("block", "pigeon.user", {
    label: "飞鸽来信正文",
    slot: "user",
    text: (ctx) => `主角的来信：${ctx.letter?.sentContent ?? ctx.sentContent ?? ""}`,
  });

  definePrompt("call", "pigeon.reply", {
    group: "async",
    label: "飞鸽回信",
    execution: "async_background",
    route: "primary",
    reviewDesc: "核对 epoch/letterId 防切档串台，截出 ⟦好感X⟧ 与回礼并在白名单内落盘",
    tokenLimitKey: "pigeonReply",
    defaultMaxTokens: 3000,
    join: "",
    blocks: ["pigeon.sys", "pigeon.user"],
  });

  definePrompt("block", "pigeon.inbound.sys", {
    label: "主动来信系统指令",
    slot: "sys",
    text: (ctx, render) => {
      const state = ctx.state || {};
      const { npcName, npc } = ctx.letter || {};
      const preset = ctx.preset || {};
      const npcObj = (npc && npc.name === npcName ? npc : null)
        || state.room?.npcs?.find((n) => n.name === npcName)
        || { name: npcName };
      const npcCtx = buildNpcContext(npcObj, state);
      const { bought, sold } = npcCtx.tradeCounts;
      const carryNames = npcCtx.carryNames.join("、");
      const 近况 = [
        npcCtx.location ? `眼下身在「${npcCtx.location}」` : "",
        carryNames ? `随身带着：${carryNames}` : "",
        npcCtx.exposure ? `此刻${npcCtx.exposure}` : "",
        // 台账是写信人（NPC）视角：sold=他卖给主角、bought=他从主角手里收下。
        bought || sold ? `与主角的买卖往来：你卖给他 ${sold} 件、从他手里买走 ${bought} 件` : "",
      ].filter(Boolean).join("；") || "近况平平";
      const scope = { ...state, npcName, bio: npcCtx.bio, scenario: preset.scenario || "", promptRefOptions: { factLimit: 12 } };
      const facts = render("@事实摘要", scope);
      const factsBlock = facts ? "你与主角的共同记忆与近来见闻（自然带一两句，不要生硬罗列）：\n" + facts : "";
      // WO-22B-P4a：契约信（pactMeta 非空）换「这封信是为一桩约定而写」块，
      // 替换原「心血来潮」段——违约后收到闲谈的叙事错位由这里消除。
      // 非契约信 pactView 为 null，走原心血来潮段一字不变。
      const pv = ctx.letter?.pactView || null;
      const 写信缘起 = pv
        ? `【这封信是为一桩约定而写】
事由：${pv.reasonLabel}
约定：在${pv.place}说定「${pv.promise}」，${pv.deadlineText}
允诺的酬谢：${pv.rewardText}
写信人：${pv.npcName}，${pv.factionName || "散人"}
口吻取材：${pv.factionToneHint}
分寸：${pv.severityGuide}

写成书信，四到八句，第一句就点明是哪一桩约定。立诺留凭的，只记事由与期限；如约致谢的，写清酬谢怎么交到对方手上；逾期催问的，按上面的分寸定轻重。不许许下约定之外的新酬谢，不许编造写信人不在场时发生的事。`
        : "你心血来潮，主动给主角写信。按你的性情与近况起笔：落魄就诉穷借钱、受过恩惠就问候致谢、被他怠慢过或卖过他东西就夹枪带棒埋怨两句、油滑风流就婊里婊气撩拨——写什么由你的成色定。";
      return render(`你是武侠世界「曲措乡」中的【@npcName】@bio
你与主角的关系：好感度 @通信.好感度/100@通信.态度。好感越低越冷淡疏离，越高越亲近热络。
剧本背景：@scenario
你的近况：@近况
你们此前往来的信件（须前后连贯、不自相矛盾）：
@通信.往来
@factsBlock
@写信缘起
请以【@npcName】的口吻，用白话古文书信体写信。只写正文（可含简短落款），约 80–160 字。`, { ...scope, factsBlock, 近况, 写信缘起 });
    },
  });

  definePrompt("block", "pigeon.inbound.user", {
    label: "主动来信任务",
    slot: "user",
    text: () => "请写这封信。",
  });

  definePrompt("call", "pigeon.inbound", {
    group: "async",
    label: "主动来信",
    execution: "async_background",
    route: "primary",
    reviewDesc: "由统一 NPC 上下文拼装近况，校验 isStale 后存入信箱",
    tokenLimitKey: "pigeonReply",
    defaultMaxTokens: 3000,
    join: "",
    blocks: ["pigeon.inbound.sys", "pigeon.inbound.user"],
  });

  definePrompt("block", "fact.summary.sys", {
    label: "事实摘要系统指令",
    slot: "sys",
    text: "你是只负责生成简短设定文本的工具。用户给一个事件线索，你只返回一句话（≤30字）的中文简要描述，白话古文风格，客观陈述。只返回这句话本身，不要解释、引号、标点装饰或多余内容。",
  });

  definePrompt("block", "fact.summary.user", {
    label: "事实摘要线索",
    slot: "user",
    text: (ctx) => `事件线索：${ctx.cue}\n请用一句话简要描述这件事。`,
  });

  definePrompt("call", "fact.summary", {
    group: "sync",
    label: "事实摘要",
    execution: "sync_pipeline",
    route: "light",
    reviewDesc: "截取首行 ≤40 字落入知识账本摘要，失败留空下回合自愈",
    tokenLimitKey: "knowledge",
    defaultMaxTokens: 120,
    join: "",
    blocks: ["fact.summary.sys", "fact.summary.user"],
  });

  definePrompt("block", "fact.summaryFromRecall.sys", {
    label: "旧事归纳系统指令",
    slot: "sys",
    text: "你是只负责归纳的工具。用户给一个事件线索和游戏中真实发生过的若干旧事片段。你只**依据这些旧事片段**，用一句话（≤30字）的中文、白话古文风格概括该事件。严禁编造素材里没有的情节；素材不足以说清，就只概括素材确实提到的部分。只返回这句话本身，不要解释、引号或多余内容。",
  });

  definePrompt("block", "fact.summaryFromRecall.user", {
    label: "旧事归纳素材",
    slot: "user",
    text: (ctx) => {
      const 素材 = (ctx.recallTexts || []).map((t, i) => `${i + 1}. ${t}`).join("\n");
      return `事件线索：${ctx.cue}\n\n相关旧事片段（真实发生过）：\n${素材}\n\n请据以上旧事，用一句话概括这件事。`;
    },
  });

  definePrompt("call", "fact.summaryFromRecall", {
    group: "sync",
    label: "旧事归纳摘要",
    execution: "sync_pipeline",
    route: "light",
    reviewDesc: "严格基于召回旧事截取 ≤40 字摘要，严禁编造片段外情节",
    tokenLimitKey: "knowledge",
    defaultMaxTokens: 120,
    join: "",
    blocks: ["fact.summaryFromRecall.sys", "fact.summaryFromRecall.user"],
  });
}

export function ensureSideCalls() {
  if (!getPromptDef("call", "fact.summary")) registerSideCalls();
}

registerSideCalls();
