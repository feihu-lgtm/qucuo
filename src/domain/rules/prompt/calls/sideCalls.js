import { definePrompt } from "../registry.js";

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
请以【@npcName】的口吻，用白话古文书信体写一封回信。只写信的正文（可含简短落款），约 80–160 字，关系冷淡则简短公事甚至推拒、亲厚则温言絮语${gaveGift ? "；收了礼要有所表示（谢或却）" : ""}。
写完信正文后，另起附两个隐藏标记（会被系统读走、玩家看不到，不要在正文提它们）：
① ⟦好感X⟧：X 为整数，表示这次通信${gaveGift ? "与收礼" : ""}让你对主角好感升降多少。@{尺度.飞鸽}
${gaveGift ? "② ⟦回礼:物品名|类别⟧：若你确实想回赠一件礼（类别取 weapon/armor/accessory/misc 之一），从你身份/处境合理拿得出手的东西里挑一件写在这里（例如僧人回赠念珠、猎户回赠兽皮、富贵者回赠玉器）；不想回或拿不出就整条省略。" : "（这次不涉及回礼，无需第二个标记。）"}`, { ...scope, factsBlock, giftName });
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

  definePrompt("block", "fact.summary.sys", {
    label: "事实摘要系统指令",
    slot: "sys",
    text: "你是一个只负责生成简短设定文本的工具。用户会给你一个事件线索，你只需返回一句话（不超过30字）的中文简要描述，白话古文风格，客观陈述这件事是什么。只返回这一句话本身，不要任何解释、引号、标点装饰或多余内容。",
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
    text: "你是一个只负责归纳的工具。用户会给你一个事件线索，以及游戏中真实发生过的若干旧事片段。你只需**依据这些旧事片段**，用一句话（不超过30字）的中文、白话古文风格，概括该事件是怎么回事。严禁编造素材里没有的情节；若素材不足以说清，就只概括素材确实提到的部分。只返回这一句话本身，不要解释、引号或多余内容。",
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
