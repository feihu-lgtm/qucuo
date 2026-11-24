// 随行同伴随机插话：不是每回合固定，按概率触发（COMPANION_CHATTER_CHANCE，可调）。
// 话让 AI 现写（askStoryteller 小额调用，thinking 关）；无 API 时用手写兜底句库。
// 产物走系统日志单独一行（标说话者）+ jotNote 进记忆库；不推进事件、不改状态。
// 兽类/机关随从只出声不说话——铁伯这类也算同伴，但只插机括音效。

import { askStoryteller } from "../../engine/ports/storyteller.js";
import { random } from "../../utils/rng.js";
import { ADVENTURER_BY_NAME } from "../../domain/data/dungeon/adventurers.js";
import { NOTE_SOURCE } from "../../domain/rules/memory/note.js";

export const COMPANION_CHATTER_CHANCE = 0.12;
export const CHATTER_MAX_TOKENS = 60;

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
// 给几类常见气质各备一句，命中即用，省得千篇一律
const PERSONA_FALLBACK = [
  [/娇憨|天真|自信|奇/, "眼珠一转：“本小姐有种预感，接下来准有好事——我投过钱的直觉，从不落空！”"],
  [/傲|冷|孤/, "淡淡道：“你走你的，不必管我。”"],
  [/侠|义|正/, "沉声道：“行路在外，多长个心眼总没错。”"],
  [/机灵|狡|贪|商/, "搓了搓手：“这地方看着就有油水，可惜了，没带算盘。”"],
  [/温柔|温婉|柔/, "轻声道：“跟紧些，别走散了。”"],
];

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

export function chatterFallback(who, rng = random) {
  if (who.beast) return BEAST_FALLBACK[Math.floor(rng() * BEAST_FALLBACK.length) % BEAST_FALLBACK.length];
  const hit = PERSONA_FALLBACK.find(([re]) => re.test(`${who.personality}${who.brief}`));
  if (hit) return hit[1];
  return PLAIN_FALLBACK[Math.floor(rng() * PLAIN_FALLBACK.length) % PLAIN_FALLBACK.length];
}

// 回合尾触发一次：抽中人→（兽类直接出声）→AI 现写→兜底。返回 {speaker, line} 或 null。
// ask 可注入替身便于测试。
export async function companionChatterTick({ companionState, roomName, rng = random, ask = askStoryteller } = {}) {
  const who = pickChatter(companionState, { rng });
  if (!who) return null;
  let line = null;
  if (!who.beast) {
    // OC 有全量人设（性格/身世/亲密画风），普通同伴只有 brief——有哪个用哪个
    const adv = ADVENTURER_BY_NAME[who.name];
    const persona = adv ? `${adv.archetypeLabel || ""}，${adv.personality || adv.brief || ""}` : (who.personality || who.brief || "江湖散人");
    line = await ask(
      "你是武侠MUD里玩家的随行同伴。只写一句贴合人设的闲谈、感慨或调侃（不超过30字），不推进事件、不描述玩家动作、不带引号。",
      `同伴：${who.name}（${persona}）\n当前所在：${roomName || "赶路途中"}`,
      { callLabel: "companion-chatter", maxTokens: CHATTER_MAX_TOKENS },
    );
  }
  if (!line) line = chatterFallback(who, rng);
  return { speaker: who.name, line, noteSource: NOTE_SOURCE.NARRATIVE };
}
