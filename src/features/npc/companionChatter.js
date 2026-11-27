// 随行同伴随机插话 + 重逢台词（同伴系统 PR-B，docs/同伴系统规格 §3/§5/§6）。
// 插话不是闲聊——是队友看到玩家干了什么（打了架/买了东西/偷了东西/赢了切磋）
// 按概率插一句评价，按各自人设语气（朵朵嚷分红、侠义系赞或嗔）。
// 重逢：唤回留守队友时开口第一句按"被留守多久+好感度"演——丢久了幽怨、刚留守就开心。
// 话让 AI 现写（ask 注入 askStoryteller，features 层不直接引 engine/ports，守住依赖红线）；
// 无 API 走手写兜底句库。产物由调用方记日志 + jotNote 进记忆链，本模块不碰状态。
//
// 【开口节奏】useTurn 每个成功回合调一次 companionChatterTick，节奏在这里裁决：
//   每回合 COMPANION_CHATTER_CHANCE(20%) 开口一次；全队任意两句至少隔 CHATTER_GAP_TURNS(3) 回合；
//   同一位同伴两次开口至少隔 CHATTER_COOLDOWN_TURNS(8) 回合。
//   平均约每 5~6 回合有人说一句，4 位同伴轮着说，不会一人刷屏。
//   回合计数/冷却记在模块级 memory（不进存档：读档后冷却清零，最多多说一句，无害）。
//
// 【谁怎么说话】voice 四种：human 能说人话（走 AI+兜底）；beast 真兽（只出声）；
//   mechanical 机关人偶（铁伯等，只出机括声）；silent 哑巴随从（铁牛、哑奴……只比划）。
//   雪豹/珍珠已娘化为人形成年女子（humanForm），按 human 开口，用各自人设与兜底句库。
//   冒险者的随从入队时把 voice 写进槽位（见 companion.js followerPreset）。

import { random } from "../../utils/rng.js";
import { buildNpcContext } from "../../domain/rules/npc/npcContext.js";
import { isHumanFormCompanion } from "../../domain/rules/companion/companionSlots.js";
import { readBond, pairKey } from "../../domain/rules/companion/companionBonds.js";

export const COMPANION_CHATTER_CHANCE = 0.2;
export const CHATTER_COOLDOWN_TURNS = 8;
export const CHATTER_GAP_TURNS = 3;
export const CHATTER_MAX_TOKENS = 120;
// V7b 事件加权：强事件（切磋胜负/破费/偷盗/受挫/踏入新据点/赠送）开口概率抬到
// 0.55~0.75，普通走路维持 0.2；强事件开口冷却减半、队间隙缩到 1 回合。
export const STRONG_EVENT_WEIGHTS = {
  DUEL: 0.75,   // 切磋胜负
  GIFT: 0.7,    // 赠送
  STEAL: 0.65,  // 偷盗
  TRADE: 0.6,   // 破费
  COMBAT: 0.55, // 动武
};
export const NEW_PLACE_WEIGHT = 0.65;  // 踏入新据点
export const SETBACK_WEIGHT = 0.6;     // 受挫（行动落空/被拒）
export const DUO_CHATTER_CHANCE = 0.35; // 随行满 2 人时双人互怼/接茬概率

// 本轮开口权重：activity.intent 命中强事件表、或调用方标了 newPlace/setback。
export function eventChatterWeight(activity) {
  let w = STRONG_EVENT_WEIGHTS[activity?.intent] ?? COMPANION_CHATTER_CHANCE;
  if (activity?.newPlace) w = Math.max(w, NEW_PLACE_WEIGHT);
  if (activity?.setback) w = Math.max(w, SETBACK_WEIGHT);
  return w;
}
export const REUNION_MAX_TOKENS = 60;

// 真兽（墨团这类没化形的）只出声
const BEAST_FALLBACK = [
  "低低呜了一声，蹭了蹭你的衣角。",
  "甩了甩尾巴，东嗅嗅西嗅嗅。",
];
// 机关人偶：无通灵、不开口，只有机括声和动作
const MECHANICAL_FALLBACK = [
  "（一身机括轻响，亦步亦趋地跟着。）",
  "（机括咔哒一声，朝你缓缓点了点头。）",
  "（肚膛里传来发条咯吱上紧的声响。）",
];
// 不会说人话的同伴也走 AI：提示词写清它怎么「开口」，由 AI 按人设现写，不用预制句。
// 兽/机关的兜底句库只在没配 API 时用；哑巴随从没配 API 就不插话（不拿别人的句子凑）。
const VOICE_RULE = {
  human: "只说一句贴合人设的话（不超过30字），不带引号",
  beast: "它是不会说人话的灵兽：只写一句它的叫声或动作（不超过25字，用全角括号包住），不出人言",
  mechanical: "它是无通灵的机关造物，不会说话：只写一句机括声响或动作（不超过25字，用全角括号包住），不出人言",
  silent: "此人是哑巴，不能出声：只写一句手势、神情或动作（不超过25字，用全角括号包住），不出人言",
};
const PLAIN_FALLBACK = [
  "打了个哈欠：“这路还得走多久？”",
  "左右张望：“这地方倒有几分意思。”",
  "抱着胳膊嘀咕：“饿了，寻个地方歇脚罢。”",
  "忽道：“你身上这股江湖气，倒是越来越足了。”",
  "轻声道：“跟着你，比一个人闯荡有趣些。”",
];
// 化形的灵兽伙伴（雪豹→白栖雪 / 珍珠→夏明珠）：人形成年女子，说人话，保留兽形出身的习性
const HUMAN_FORM_PERSONA = {
  snowLeopard: "雪豹化形女子白栖雪（22岁，名号「雪线孤影」）：清冷孤高、话少而简短，认主后黏人忠贞，习武雪隐三绝·栖雪剑掌，保留猫科习性（豹耳轻抖、斑尾缠腕、喉间呼噜）",
  pearl: "小白马珍珠化形女子夏明珠（20岁，藏名哈瓦夏日，名号「踏雪白驹」）：惫懒贪吃、直白坦率，爱干饭躺平，护主时使白驹踏云劲·游缰腿法，保留马的习性（马耳转动、长尾轻扫）",
};
const HUMAN_FORM_FALLBACK = {
  snowLeopard: [
    "豹耳微微一动，淡淡道：“前面有风，当心。”",
    "斑尾轻轻扫过你的手背：“……我在。”",
    "望着远处的雪线，低声道：“这里的风，不如山上干净。”",
  ],
  pearl: [
    "打了个哈欠，马耳朵抖了抖：“走了这么久，该找点吃的了吧？”",
    "吸了吸鼻子：“前面有青草的味道，我先去尝尝？”",
    "懒洋洋靠过来：“让我歇一会儿嘛，就一小会儿。”",
  ],
};
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

// 开口方式：冒险者随从入队时写进槽位的 voice 为准；旧档的铁伯（只有 mute）=机括声；
// 真兽=兽声；化形的雪豹/珍珠与人类 OC 都是 human。
export function chatterVoice(key, entry) {
  if (entry?.voice) return entry.voice;
  if (entry?.mute) return "mechanical";
  if (entry?.beast && !isHumanFormCompanion(entry.label || entry.data?.name || key)) return "beast";
  return "human";
}

// 随行同伴名单：已解锁、没在别处留守。返回 {key,name,voice,personality,brief}
export function eligibleChatters(companionState) {
  return Object.entries(companionState || {})
    .filter(([, c]) => c?.unlocked && c?.data && !c?.stationed)
    .map(([key, c]) => ({
      key,
      name: c.label || c.data?.name || key,
      voice: chatterVoice(key, c),
      personality: c.data?.personality || HUMAN_FORM_PERSONA[key] || "",
      brief: c.data?.brief || "",
    }));
}

// 回合计数 + 各人上次开口的回合。tick 每回合 turn+1；测试注入新实例隔离。
export function createChatterMemory() {
  return { turn: 0, lastAny: -Infinity, last: {} };
}
const sharedMemory = createChatterMemory();

// 概率触发 + 从"冷却已过"的随行同伴里抽一位；rng 可注入便于测试/seeded。
// 传 memory 才查冷却（不传=只看概率，旧调用方式）。
export function pickChatter(companionState, { rng = random, chance = COMPANION_CHATTER_CHANCE, memory, cooldownTurns = CHATTER_COOLDOWN_TURNS, gapTurns = CHATTER_GAP_TURNS } = {}) {
  let pool = eligibleChatters(companionState);
  if (memory) {
    if (memory.turn - memory.lastAny < gapTurns) return null;
    pool = pool.filter((w) => memory.turn - (memory.last[w.key] ?? -Infinity) >= cooldownTurns);
  }
  if (!pool.length) return null;
  if (rng() >= chance) return null;
  return pool[Math.floor(rng() * pool.length) % pool.length];
}

export function chatterFallback(who, rng = random, activityCode) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  if (who.voice === "beast") return pick(BEAST_FALLBACK);
  if (who.voice === "mechanical") return pick(MECHANICAL_FALLBACK);
  if (who.voice === "silent") return null;
  const own = HUMAN_FORM_FALLBACK[who.key];
  const actLines = ACTIVITY_FALLBACK[INTENT_TO_ACTIVITY[activityCode]];
  // 有专属句库的（雪豹/珍珠）多让她说自己的话，别总是套通用评价
  if (actLines && rng() < (own ? 0.35 : 0.7)) return pick(actLines);
  if (own) return pick(own);
  const hit = PERSONA_FALLBACK.find(([re]) => re.test(`${who.personality}${who.brief}`));
  if (hit) return hit[1];
  return pick(PLAIN_FALLBACK);
}

// V7b 上下文补入：说书正文末尾 120 字、关键数值变化、当前场景对象。
function activityContextBlock(activity) {
  const parts = [];
  if (activity?.narrative) parts.push(`说书正文末尾：……${String(activity.narrative).slice(-120)}`);
  if (activity?.deltas) parts.push(`关键数值变化：${activity.deltas}`);
  if (activity?.scene) parts.push(`当前场景对象：${activity.scene}`);
  return parts.length ? `\n${parts.join("\n")}` : "";
}

// 双人互怼/接茬：从在场池抽两人，装配彼此关系档位与近 2 条互涉心账，
// AI 输出极简结构化结果 {lines,bondDelta,ledgerNote?,transfer?}；离线走兜底对口词。
function mutualLedgerLines(state, aName, bName) {
  const out = [];
  for (const [name, other] of [[aName, bName], [bName, aName]]) {
    const entries = state?.varTree?.角色?.[name]?.心账 || [];
    const mutual = entries.filter((e) => String(e?.summary || e?.摘要 || "").includes(other)).slice(-2);
    for (const e of mutual) out.push(`${name}记着：${e.summary || e.摘要}`);
  }
  return out.slice(-4);
}

function parseDuoOutcome(raw, aName, bName) {
  if (!raw) return null;
  let text = String(raw).trim().replace(/^```(?:json)?\s*|```\s*$/g, "");
  const brace = text.indexOf("{");
  if (brace > 0) text = text.slice(brace);
  try {
    const obj = JSON.parse(text);
    const linesObj = obj?.lines;
    if (!linesObj || typeof linesObj !== "object") return null;
    const lines = [];
    for (const speaker of [aName, bName]) {
      const t = String(linesObj[speaker] || "").trim();
      if (t) lines.push({ speaker, text: t.slice(0, 60) });
    }
    if (!lines.length) return null;
    const outcome = {};
    if (Number.isFinite(obj.bondDelta)) outcome.bondDelta = obj.bondDelta;
    if (typeof obj.ledgerNote === "string" && obj.ledgerNote.trim()) outcome.ledgerNote = obj.ledgerNote.trim().slice(0, 40);
    if (obj.transfer && typeof obj.transfer === "object") {
      const { from, to, itemName } = obj.transfer;
      if ([from, to].every((n) => [aName, bName].includes(n)) && from !== to && typeof itemName === "string" && itemName.trim()) {
        outcome.transfer = { from, to, itemName: itemName.trim() };
      }
    }
    return { lines, outcome };
  } catch { return null; }
}

function duoFallback(a, b, rng, activityCode) {
  const first = chatterFallback(a, rng, activityCode) || "瞥了同伴一眼，没说话。";
  const second = chatterFallback(b, rng, activityCode) || "哼了一声，别过脸去。";
  return {
    lines: [
      { speaker: a.name, text: first.replace(/^[（(]|[）)]$/g, "").slice(0, 60) },
      { speaker: b.name, text: second.replace(/^[（(]|[）)]$/g, "").slice(0, 60) },
    ],
    outcome: {},
  };
}

async function duoChatter({ pool, companionState, roomName, activity, state, rng, ask }) {
  const a = pool[Math.floor(rng() * pool.length) % pool.length];
  const rest = pool.filter((w) => w.key !== a.key);
  const b = rest[Math.floor(rng() * rest.length) % rest.length];
  const bond = readBond(companionState, a.name, b.name);
  const ledgerLines = mutualLedgerLines(state, a.name, b.name);
  let parsed = null;
  if (typeof ask === "function") {
    const raw = await ask(
      `你是武侠MUD的编剧。写两位随行同伴之间的一来一往短交锋（互怼或接茬）：${a.name}一句、${b.name}一句，各不超 30 字，贴合各自性子与两人关系，围绕玩家刚做的事或眼前景；不推进事件、不描述玩家动作。只回 JSON：{"lines":{"${a.name}":"…","${b.name}":"…"},"bondDelta":-5到5的整数（这趟往来让两人更近还是更疏）,"ledgerNote":"可选，一句不超过20字的心账由头","transfer":{"from":"${a.name}或${b.name}","to":"另一位","itemName":"必须是 from 真实持有的东西，不确定就别给"}可选}`,
      `同伴甲：${a.name}（${a.personality || a.brief || "江湖中人"}）\n同伴乙：${b.name}（${b.personality || b.brief || "江湖中人"}）\n两人关系：${bond.tier}（${bond.score}）\n近互涉心账：${ledgerLines.join("；") || "无"}\n当前所在：${roomName || "赶路途中"}\n玩家刚做的事：${activity?.text || "赶路"}${activityContextBlock(activity)}`,
      { callLabel: "companion-chatter-duo", maxTokens: CHATTER_MAX_TOKENS * 2 },
    );
    parsed = parseDuoOutcome(raw, a.name, b.name);
  }
  const duo = parsed || duoFallback(a, b, rng, activity?.intent);
  return { duo: true, speakers: [a.name, b.name], keys: [a.key, b.key], lines: duo.lines, outcome: duo.outcome || {} };
}

// 回合尾触发一次：计回合→事件加权抽人（强事件抬权重+缩冷却）→满 2 人 35% 双人互怼→
// AI 按"玩家刚干了什么+说书末尾+数值变化+场景对象"现写→兜底。
// activity={text,intent,narrative?,deltas?,scene?,newPlace?,setback?}。ask 缺省=离线兜底。
export async function companionChatterTick({ companionState, roomName, activity, state, rng = random, ask, memory = sharedMemory } = {}) {
  memory.turn += 1;
  const weight = eventChatterWeight(activity);
  const strong = weight > COMPANION_CHATTER_CHANCE;
  const cooldownTurns = strong ? Math.ceil(CHATTER_COOLDOWN_TURNS / 2) : CHATTER_COOLDOWN_TURNS;
  const gapTurns = strong ? 1 : CHATTER_GAP_TURNS;
  const who = pickChatter(companionState, { rng, chance: weight, memory, cooldownTurns, gapTurns });
  if (!who) return null;
  memory.lastAny = memory.turn;
  // 双人互怼/接茬：满 2 人在场池时 35% 触发，两人同记冷却
  const pool = eligibleChatters(companionState)
    .filter((w) => memory.turn - (memory.last[w.key] ?? -Infinity) >= cooldownTurns);
  if (pool.length >= 2 && rng() < DUO_CHATTER_CHANCE) {
    const duo = await duoChatter({ pool, companionState, roomName, activity, state, rng, ask });
    memory.last[duo.keys[0]] = memory.turn;
    memory.last[duo.keys[1]] = memory.turn;
    return duo;
  }
  memory.last[who.key] = memory.turn;
  let line = null;
  if (typeof ask === "function") {
    const npcCtx = buildNpcContext({ name: who.name, personality: who.personality, brief: who.brief }, state || {}, { includeOcPool: true });
    const favorLine = npcCtx.favorability != null ? `\n对主角好感度：${npcCtx.favorability}/100` : "";
    const exposureLine = npcCtx.exposure ? `\n当下衣着状态：${npcCtx.exposure}` : "";
    line = await ask(
      `你是武侠MUD里玩家的随行同伴。玩家刚做了一件事（或只是在赶路），${VOICE_RULE[who.voice] || VOICE_RULE.human}——可以赞、嗔、调侃、讨赏、提醒，或随口感叹周遭，照你的性子来；不推进事件、不描述玩家动作。`,
      `同伴：${who.name}（${npcCtx.chatterPersona}）\n当前所在：${roomName || "赶路途中"}${favorLine}${exposureLine}\n玩家刚做的事：${activity?.text || "赶路"}${activityContextBlock(activity)}`,
      { callLabel: "companion-chatter", maxTokens: CHATTER_MAX_TOKENS },
    );
  }
  if (!line) line = chatterFallback(who, rng, activity?.intent);
  return line ? { speaker: who.name, line } : null;
}

// 重逢台词：唤回留守队友时，开口第一句按留守时长+好感演。
// 丢久了（days≥3）幽怨/阴阳怪气，刚留守（days<1）开心；中等平叙。返回 {speaker,line,dayCount} 或 null。
export async function companionReunionLine({ companionState, slotKey, favor, now, state, rng = random, ask } = {}) {
  const c = companionState?.[slotKey];
  if (!c?.unlocked || !c?.data) return null;
  const stationed = c.stationed;
  const days = stationed?.since != null ? Math.max(0, Math.floor((now - stationed.since) / 24)) : 0;
  const name = c.label || c.data?.name || slotKey;
  const voice = chatterVoice(slotKey, c);
  const mood = days >= 3 ? "被丢久了，又幽又嗔" : days >= 1 ? "等了几日，嘴上埋怨心里欢喜" : "刚留守就等到你回来，开心";
  let line = null;
  if (typeof ask === "function") {
    const npcCtx = buildNpcContext({ name, personality: c.data?.personality || HUMAN_FORM_PERSONA[slotKey] || "", brief: c.data?.brief || "" }, state || {}, { includeOcPool: true });
    const resolvedFavor = favor ?? npcCtx.favorability ?? "？";
    line = await ask(
      `你是武侠MUD里被玩家留守后重逢的同伴。见面第一下：${mood}。${VOICE_RULE[voice] || VOICE_RULE.human}，提及被丢在此地多久/好感深浅的分寸由你拿捏；不推进事件。`,
      `同伴：${name}（${npcCtx.chatterPersona}）\n留守地点：${stationed?.roomName || stationed?.district || "此地"}\n留守天数：${days}天\n对你的好感度：${resolvedFavor}/100`,
      { callLabel: "companion-reunion", maxTokens: REUNION_MAX_TOKENS },
    );
  }
  if (!line && voice !== "silent") {
    line = voice === "beast" ? "（高兴地绕着你转了一圈。）"
      : voice === "mechanical" ? "（机括咔哒一响，缓缓朝你躬了躬身。）"
      : days >= 3 ? `幽幽道：“${days}天了……你可算想起我来了。”`
      : days >= 1 ? "嗔怪道：“就知道你会回来接我。”"
      : "眼睛一亮：“回来啦？走罢！”";
  }
  return line ? { speaker: name, line, dayCount: days } : null;
}
