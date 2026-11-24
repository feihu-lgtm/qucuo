import { definePrompt } from "../registry.js";
import { npcTradeOf, itemKey } from "../../npc/npcTrade.js";

export function registerSideCalls() {
  definePrompt("block", "pigeon.sys", {
    label: "飞鸽回信系统指令",
    slot: "sys",
    text: (ctx, render) => {
      const state = ctx.state || {};
      const { npcName, giftName, channel } = ctx.letter || {};
      const preset = ctx.preset || {};
      const npcObj = state.room?.npcs?.find((npc) => npc.name === npcName) || {};
      const bio = (npcObj.brief ? "，" + npcObj.brief : "") + (npcObj.fullBio ? npcObj.fullBio + " " : "") +
        (npcObj.personality ? "性情：" + npcObj.personality + "。" : "");
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
    label: "飞鸽回信",
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
      const npcObj = (npc && npc.name === npcName ? npc : {})
        || state.room?.npcs?.find((n) => n.name === npcName) || {};
      const bio = (npcObj.brief ? "，" + npcObj.brief : "") + (npcObj.fullBio ? npcObj.fullBio + " " : "") +
        (npcObj.personality ? "性情：" + npcObj.personality + "。" : "");
      const attrs = state.varTree?.角色?.[npcName] || {};
      // 台账按 npc.id 落（pool_ 前缀随出场换），走 npcTradeOf 按 id/name 兜底盘账；
      // 行头：live 房间实例的 carriedItems → 数据底稿 carry/stealables → 台账里买走的件。
      const trade = npcTradeOf(state.npcState, npcObj) || {};
      const boughtItems = Array.isArray(trade.bought) ? trade.bought : Object.keys(trade.bought || {});
      const soldKeys = trade.sold || {};
      // 已被买走/偷走/掉落的件不算随身——底稿是会过时的，台账才是现在的包。
      const stillOwned = (i) => i && !i.stolen && !i.dropped && !soldKeys[itemKey(i)] && !soldKeys[i?.name];
      const carryNames = [
        ...(npcObj.carriedItems || npcObj.carry || []),
        ...(npcObj.stealables?.sundries || []),
        ...(npcObj.stealables?.equipment || []),
        ...boughtItems,
      ].filter(stillOwned)
        .map((i) => (typeof i === "object" && i ? i.name : i)).filter(Boolean)
        .filter((name, idx, arr) => arr.indexOf(name) === idx).join("、");
      const bought = boughtItems.length;
      const sold = Object.keys(soldKeys).length;
      const 近况 = [
        attrs.所在地 ? `眼下身在「${attrs.所在地}」` : "",
        carryNames ? `随身带着：${carryNames}` : "",
        // 台账是写信人（NPC）视角：sold=他卖给主角、bought=他从主角手里收下。
        bought || sold ? `与主角的买卖往来：你卖给他 ${sold} 件、从他手里买走 ${bought} 件` : "",
      ].filter(Boolean).join("；") || "近况平平";
      const scope = { ...state, npcName, bio, scenario: preset.scenario || "", promptRefOptions: { factLimit: 12 } };
      const facts = render("@事实摘要", scope);
      const factsBlock = facts ? "你与主角的共同记忆与近来见闻（自然带一两句，不要生硬罗列）：\n" + facts : "";
      return render(`你是武侠世界「曲措乡」中的【@npcName】@bio
你与主角的关系：好感度 @通信.好感度/100@通信.态度。好感越低越冷淡疏离，越高越亲近热络。
剧本背景：@scenario
你的近况：@近况
你们此前往来的信件（须前后连贯、不自相矛盾）：
@通信.往来
@factsBlock
你心血来潮，主动给主角写信。按你的性情与近况起笔：落魄就诉穷借钱、受过恩惠就问候致谢、被他怠慢过或卖过他东西就夹枪带棒埋怨两句、油滑风流就婊里婊气撩拨——写什么由你的成色定。
请以【@npcName】的口吻，用白话古文书信体写信。只写正文（可含简短落款），约 80–160 字。`, { ...scope, factsBlock, 近况 });
    },
  });

  definePrompt("block", "pigeon.inbound.user", {
    label: "主动来信任务",
    slot: "user",
    text: () => "请写这封信。",
  });

  definePrompt("call", "pigeon.inbound", {
    label: "主动来信",
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
    label: "事实摘要",
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
    label: "事实摘要",
    tokenLimitKey: "knowledge",
    defaultMaxTokens: 120,
    join: "",
    blocks: ["fact.summaryFromRecall.sys", "fact.summaryFromRecall.user"],
  });
}

registerSideCalls();
