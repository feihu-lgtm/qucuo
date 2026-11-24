// 随行同伴随机插话 + 重逢台词（同伴系统 PR-B，docs/同伴系统规格 §3/§5/§6）。
// 插话不是闲聊——是队友看到玩家干了什么（打了架/买了东西/偷了东西/赢了切磋）
// 按概率插一句评价，按各自人设语气（朵朵嚷分红、侠义系赞或嗔）。
// 重逢：唤回留守队友时开口第一句按"被留守多久+好感度"演——丢久了幽怨、刚留守就开心。
// 话让 AI 现写（ask 注入 askStoryteller，features 层不直接引 engine/ports，守住依赖红线）；
// 无 API 走手写兜底句库。产物由调用方记日志 + jotNote 进记忆链，本模块不碰状态。

import { random } from "../../utils/rng.js";
import { buildNpcContext } from "../../domain/rules/npc/npcContext.js";

export const COMPANION_CHATTER_CHANCE = 0.12;
export const CHATTER_MAX_TOKENS = 60;
export const REUNION_MAX_TOKENS = 60;

const BEAST_FALLBACK = [
  "低低呜了一声，蹭了蹭你的衣角。",
  "甩了甩尾巴，东嗅嗅西嗅嗅。",
  "（一身机括轻响，亦步亦趋地跟着。）",
];
const PLAIN_FALLBACK = [
  "打了个哈欠：“这路还得走多久？”",
  "左右张望：“这地方倒有几分意思。”",
  "抱着胳膊嘀咕：“饿了，寻个地方歇脚罢。”",
  "忽道：“你身上这股江湖气，倒是越来越足了。”",
  "轻声道：“跟着你，比一个人闯荡有趣些。”",
];
// 按活动类别的兜底评价——AI 不在时队友也不至于对玩家干的事装没看见
const ACTIVITY_FALLBACK = {
  combat: ["咂咂嘴：“刚才那几下，干净利落。”", "拍着胳膊笑：“打得好！下次让我也凑个热闹。”"],
  trade: ["眼睛一亮：“这件货色不错，多少钱出的手？”", "小声嘀咕：“这价钱……要是我，再砍三成。”"],
  steal: ["压着嗓子：“手脚挺麻利，下回带上我？”", "别过脸去：“这营生……你自己掂量。”"],
  gift: ["弯起眼：“出手这么大方，谁教你的？”", "笑盈盈：“人家收了你的礼，回头准念你的好。”"],
  intimate: ["耳根一红，别过脸去：“咳咳，我什么都没瞧见。”", "促狭一笑：“哟，这就好上了？”"],
  duel: ["竖起大拇指：“点到为止，切磋得漂亮！”", "揉着胳膊：“看得我手痒，回头咱也过两招。”"],
};
// 给几类常见气质各备一句，命中即用
const PERSONA_FALLBACK = [
  [/娇憨|天真|自信|奇/, "眼珠一转：“本小姐有种预感，接下来准有好事——我投过钱的直觉，从不落空！”"],
  [/傲|冷|孤/, "淡淡道：“你走你的，不必管我。”"],
  [/侠|义|正/, "沉声道：“行路在外，多长个心眼总没错。”"],
  [/机灵|狡|贪|商/, "搓了搓手：“这地方看着就有油水，可惜了，没带算盘。”"],
  [/温柔|温婉|柔/, "轻声道：“跟紧些，别走散了。”"],
];
// 活动类别兜底→意图码粗映射（兜底句用，判定语义归 AI）
const INTENT_TO_ACTIVITY = {
  COMBAT: "combat", EXPLORE_ACTION: "combat", TRADE: "trade", STEAL: "steal",
  GIFT: "gift", INTIMATE: "intimate", DUEL: "duel",
};

// 随行同伴名单：已解锁、没在别处留守。返回 {key,name,beast,personality,brief}
export function eligibleChatters(companionState) {
  return Object.entries(companionState || {})
    .filter(([, c]) => c?.unlocked && c?.data && !c?.stationed)
    .map(([key, c]) => ({
      key,
      name: c.label || c.data?.name || key,
      beast: !!c?.beast,
      personality: c.data?.personality || "",
      brief: c.data?.brief || "",
    }));
}

// 概率触发 + 从随行同伴里抽一位；rng 可注入便于测试/seeded
export function pickChatter(companionState, { rng = random, chance = COMPANION_CHATTER_CHANCE } = {}) {
  const pool = eligibleChatters(companionState);
  if (!pool.length) return null;
  if (rng() >= chance) return null;
  return pool[Math.floor(rng() * pool.length) % pool.length];
}

export function chatterFallback(who, rng = random, activityCode) {
  if (who.beast) return BEAST_FALLBACK[Math.floor(rng() * BEAST_FALLBACK.length) % BEAST_FALLBACK.length];
  const actLines = ACTIVITY_FALLBACK[INTENT_TO_ACTIVITY[activityCode]];
  if (actLines && rng() < 0.7) return actLines[Math.floor(rng() * actLines.length) % actLines.length];
  const hit = PERSONA_FALLBACK.find(([re]) => re.test(`${who.personality}${who.brief}`));
  if (hit) return hit[1];
  return PLAIN_FALLBACK[Math.floor(rng() * PLAIN_FALLBACK.length) % PLAIN_FALLBACK.length];
}

// 回合尾触发一次：抽中人→（兽类直接出声）→AI 按"玩家刚干了什么"现写一句评价→兜底。
// activity={text,intent} 是玩家本轮输入和识别出的意图码。ask 缺省=离线兜底。
export async function companionChatterTick({ companionState, roomName, activity, state, rng = random, ask } = {}) {
  const who = pickChatter(companionState, { rng });
  if (!who) return null;
  let line = null;
  if (!who.beast && typeof ask === "function") {
    const npcCtx = buildNpcContext({ name: who.name, personality: who.personality, brief: who.brief }, state || {}, { includeOcPool: true });
    const favorLine = npcCtx.favorability != null ? `\n对主角好感度：${npcCtx.favorability}/100` : "";
    const exposureLine = npcCtx.exposure ? `\n当下衣着状态：${npcCtx.exposure}` : "";
    line = await ask(
      "你是武侠MUD里玩家的随行同伴。玩家刚做了一件事，你只说一句贴合人设的评价/反应（不超过30字）——可以赞、嗔、调侃、讨赏、提醒，照你的性子来；不推进事件、不描述玩家动作、不带引号。",
      `同伴：${who.name}（${npcCtx.chatterPersona}）\n当前所在：${roomName || "赶路途中"}${favorLine}${exposureLine}\n玩家刚做的事：${activity?.text || "赶路"}`,
      { callLabel: "companion-chatter", maxTokens: CHATTER_MAX_TOKENS },
    );
  }
  if (!line) line = chatterFallback(who, rng, activity?.intent);
  return { speaker: who.name, line };
}

// 重逢台词：唤回留守队友时，开口第一句按留守时长+好感演。
// 丢久了（days≥3）幽怨/阴阳怪气，刚留守（days<1）开心；中等平叙。返回 {speaker,line,dayCount} 或 null。
export async function companionReunionLine({ companionState, slotKey, favor, now, state, rng = random, ask } = {}) {
  const c = companionState?.[slotKey];
  if (!c?.unlocked || !c?.data) return null;
  const stationed = c.stationed;
  const days = stationed?.since != null ? Math.max(0, Math.floor((now - stationed.since) / 24)) : 0;
  const name = c.label || c.data?.name || slotKey;
  const mood = days >= 3 ? "被丢久了，又幽又嗔" : days >= 1 ? "等了几日，嘴上埋怨心里欢喜" : "刚留守就等到你回来，开心";
  let line = null;
  if (!c.beast && typeof ask === "function") {
    const npcCtx = buildNpcContext({ name, personality: c.data?.personality || "", brief: c.data?.brief || "" }, state || {}, { includeOcPool: true });
    const resolvedFavor = favor ?? npcCtx.favorability ?? "？";
    line = await ask(
      `你是武侠MUD里被玩家留守后重逢的同伴。开口第一句：${mood}。按人设语气说（不超过30字），提及被丢在此地多久/好感深浅的分寸由你拿捏；不推进事件、不带引号。`,
      `同伴：${name}（${npcCtx.chatterPersona}）\n留守地点：${stationed?.roomName || stationed?.district || "此地"}\n留守天数：${days}天\n对你的好感度：${resolvedFavor}/100`,
      { callLabel: "companion-reunion", maxTokens: REUNION_MAX_TOKENS },
    );
  }
  if (!line) {
    line = days >= 3 ? `幽幽道：“${days}天了……你可算想起我来了。”`
      : days >= 1 ? "嗔怪道：“就知道你会回来接我。”"
      : c.beast ? "（高兴地绕着你转了一圈。）" : "眼睛一亮：“回来啦？走罢！”";
  }
  return { speaker: name, line, dayCount: days };
}
