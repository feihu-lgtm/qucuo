import { SNOW_QUEST_ID, SNOW_TRUSTED, SNOW_SPIRITS, snowQuestActive, snowSpiritCount, snowLeopardPresent } from "../../domain/rules/quests/snowLeopardQuest.js";
import { createQuestProgress } from "../../domain/rules/quests/questEngine.js";
import { selectEffectiveStats } from "../stats/logic.js";
import { CATALOG_INDEX } from "../../domain/data/items/catalog.js";

export const snowLeopardRule = {
  id: "quest.snow-leopard",
  deps: (s) => [s.questProgress, s.flags, s.char, s.inv, s.skills, s.time, s.companionState],
  run(state, ctx = {}) {
    const now = ctx.getNow?.() ?? Date.now();
    const previous = state.questProgress?.[SNOW_QUEST_ID];
    if (state.companionState?.snowLeopard?.unlocked) {
      if (previous?.status === "completed") return null;
      return { changes: { questProgress: (p) => ({ ...p, [SNOW_QUEST_ID]: { ...(previous || createQuestProgress(SNOW_QUEST_ID, now)), status: "completed", currentStageIndex: 2, completedAt: now } }) } };
    }
    if (previous && previous.status !== "active") return null;
    const flags = state.flags || [];
    const stats = selectEffectiveStats({ ...state, inv: state.inv || [], skills: state.skills || [], flags }).effectiveSpecialNow;
    const checks = {
      strength: stats.体魄 >= 7, charm: stats.魅力 >= 7,
      village: Object.entries(state.questProgress || {}).some(([id, p]) => /^village[1-6]_/.test(id) && p.status === "completed"),
    };
    const added = SNOW_SPIRITS.filter(({ key, flag }) => checks[key] && !flags.includes(flag)).map(({ flag }) => flag);
    const trusted = snowSpiritCount([...flags, ...added]) >= 5 && !flags.includes(SNOW_TRUSTED);
    if (trusted) added.push(SNOW_TRUSTED);
    if (previous && !added.length) return null;
    return {
      changes: {
        ...(!previous ? { questProgress: (p) => ({ ...p, [SNOW_QUEST_ID]: createQuestProgress(SNOW_QUEST_ID, now) }) } : {}),
        ...(added.length ? { flags: (f) => [...new Set([...(f || []), ...added])] } : {}),
      },
      logs: trusted ? [{ t: "sys", text: "  ※ 五灵已备，雪豹缓缓以额抵掌——它认准了你，可伸手相邀。" }] : [],
    };
  },
};

export function snowMedicineGift(state, npc, item) {
  if (npc.name !== "雪豹" || !snowQuestActive(state) || !snowLeopardPresent(state) || state.flags?.includes("snow_spirit_medicine")) return false;
  const entry = CATALOG_INDEX[typeof item === "string" ? item : item.name] || item;
  return ["medicine", "药品"].includes(entry?.category) || entry?.tags?.some((tag) => ["药材", "疗伤", "丹药"].includes(tag));
}

const SNOW_MEAT_TAGS = new Set(["肉食", "食品", "食材", "主食", "兽食"]);
const SNOW_MEAT_RE = /肉|羊|鸡|鸭|鱼|猪|牛|兔|鹿|腿|排/;

export function snowMeatGift(state, npc, item) {
  if (npc.name !== "雪豹" || !snowQuestActive(state) || !snowLeopardPresent(state) || state.flags?.includes("snow_spirit_meat")) return false;
  const name = typeof item === "string" ? item : item?.name || "";
  const entry = CATALOG_INDEX[name] || (typeof item === "object" ? item : null);
  if (/奶|酪|乳|酥油/.test(name)) return false; // 乳制品非肉食
  const tags = entry?.tags || [];
  if (tags.includes("肉食")) return true;
  if (tags.length) return tags.some((tag) => SNOW_MEAT_TAGS.has(tag)) && SNOW_MEAT_RE.test(name);
  return SNOW_MEAT_RE.test(name);
}

// ── WO-16C-snow：自由文本「挠痒/喂食」确定性判定 ──
// 双调用判官链里 p={}，旧提取 delta.flags_add 断档——挠痒/自由喂肉改由
// 系统在叙事前确定性落定，不靠模型自证。保守识别：否定/假设/询问一律不触发。

// 询问/假设/条件句整句豁免——宁可漏判不可误触发
const SNOW_UNCERTAIN_RE = /[吗呢嘛？?]|要不要|如果|假如|若是|要不|是不是|能不能|可不可以|该不该/;
// 「怎么/如何」仅当紧邻动作动词才视为询问方法；「我知道怎么做了」这类陈述不豁免
const SNOW_HOW_RE = /(怎么|如何|怎样|为啥|为什么)[^，。！？,.!?：:；;]{0,6}(喂|给|挠|搔|吃|递|丢|抛)/;
// 否定词紧贴动作（4 字内）视为否定
const snowNegated = (cmd, verb) => {
  const re = new RegExp(`[不别没莫勿未休].{0,3}${verb}`, "g");
  let m;
  while ((m = re.exec(cmd))) {
    if (cmd[m.index + m[0].length] !== "的") return true; // 「我不吃的肉」是定语非否定
  }
  return false;
};

export function isSnowMeatItem(item) {
  const name = typeof item === "string" ? item : item?.name || "";
  if (!name) return false;
  const entry = CATALOG_INDEX[name] || (typeof item === "object" ? item : null);
  if (/奶|酪|乳|酥油/.test(name)) return false; // 乳制品非肉食
  const tags = entry?.tags || [];
  if (tags.includes("肉食")) return true;
  if (tags.length) return tags.some((tag) => SNOW_MEAT_TAGS.has(tag)) && SNOW_MEAT_RE.test(name);
  return SNOW_MEAT_RE.test(name);
}

// 返回 null（不触发）或 { kind:"scratch"|"feed", changes, logs, note }
export function resolveSnowInteraction(state, cmd) {
  if (!cmd || typeof cmd !== "string") return null;
  if (!snowQuestActive(state) || !snowLeopardPresent(state)) return null;
  if (SNOW_UNCERTAIN_RE.test(cmd) || SNOW_HOW_RE.test(cmd)) return null;
  if (/[不别莫勿]把/.test(cmd)) return null; // 「别把X喂给雪豹」整句禁止式（没把/未把是过去陈述非禁止）
  if (!cmd.includes("雪豹") && !/挠|搔|喂/.test(cmd)) return null;
  const flags = state.flags || [];

  // 挠痒：明确给雪豹挠痒（或「挠痒」且雪豹在场唯一语境）
  if (!flags.includes("snow_spirit_scratch") && !snowNegated(cmd, "[挠搔抓]")) {
    // 必须雪豹是被挠对象：「给/替/帮/为雪豹…挠」或「挠…雪豹」直接及物；
    // 「我挠挠头，雪豹看着」这类自挠/旁观不误触发
    const scratchHit = /(给|替|帮|为)雪豹.{0,4}(挠|搔|抓)|(挠|搔|抓)(一?挠|一?搔|一?抓)?雪豹/.test(cmd);
    if (scratchHit) {
      return {
        kind: "scratch",
        changes: { flags: (f) => [...new Set([...(f || []), "snow_spirit_scratch"])] },
        logs: [{ t: "sys", text: "  ※ 你替雪豹挠开了痒痒，它眯起金瞳，喉间滚出低低的呜声。（灵性·挠痒痒 已落账）" }],
        note: "\n[系统裁决：玩家替雪豹挠痒已结算，snow_spirit_scratch 已落账。顺势叙述这一过程即可，禁重复写任何 snow 旗标、禁再结算一遍。]",
      };
    }
  }

  // 喂食：明确喂雪豹 + 背包真有肉食——消耗一件肉（按 id 精确），写 snow_spirit_meat
  if (!flags.includes("snow_spirit_meat") && !snowNegated(cmd, "(喂|给|吃|丢|抛|递)")) {
    const feedHit = /喂(食|了|一口|点)?雪豹|给雪豹(喂|吃|丢|抛|递)|喂雪豹|拿.{0,4}(喂|给).{0,4}雪豹|把.{1,10}(喂|给|丢|抛|递).{0,3}雪豹/.test(cmd);
    if (feedHit) {
      const inv = state.inv || [];
      const itemName = (entry) => (typeof entry === "string" ? entry : entry?.name || "");
      // 指令点名了背包物品时以点名物为准：非肉不触发，不能偷换背包里第一块肉
      const named = inv
        .map((entry, index) => ({ entry, index, at: itemName(entry).length >= 2 ? cmd.indexOf(itemName(entry)) : -1 }))
        .filter((hit) => hit.at !== -1)
        .sort((a, b) => a.at - b.at || itemName(b.entry).length - itemName(a.entry).length)[0]; // 同位置优先更长名称（羊肉干 vs 羊肉）
      // 点名具体物但背包没有（玩家喂食了自己并不携带的东西）——不触发，
      // 不能偷换成背包里别的肉；泛称（肉/吃的/食物…）才允许回落第一块肉
      const offerM = cmd.match(/把([^，。！？,.!?]{1,10}?)(?:喂|给|丢|抛|递)/) || cmd.match(/喂(?:一?口|点)?雪豹吃([^，。！？,.!?]{1,10})/);
      if (offerM && !named) {
        const span = offerM[1].replace(/^一?[块口点些片只]/, "").replace(/[吧呢啊呀啦了]+$/, "");
        if (span && !/^(肉|肉干|吃的|食物|肉食|东西|干粮|猎物)$/.test(span)) return null;
      }
      const meat = named ? named.entry : inv.find((entry) => isSnowMeatItem(entry));
      if (!meat || !isSnowMeatItem(meat)) return null; // 点名物非肉 / 无肉——不触发，叙事自由发挥
      const meatName = itemName(meat) || "肉";
      return {
        kind: "feed",
        changes: {
          flags: (f) => [...new Set([...(f || []), "snow_spirit_meat"])],
          // 按引用/id 精确移除目标件，不靠捕获 index（状态落账时背包可能已变）
          inv: (list) => {
            const arr = list || [];
            const at = arr.findIndex((entry) => entry === meat || (meat?.id && entry?.id === meat.id) || itemName(entry) === meatName);
            return at === -1 ? arr : arr.filter((_, i) => i !== at);
          },
        },
        logs: [{ t: "sys", text: `  ※ 雪豹衔起「${meatName}」三两口吞下，金瞳里透出几分满足。（灵性·吃好了 已落账）` }],
        note: `\n[系统裁决：玩家喂雪豹吃「${meatName}」已结算——肉食一件已消耗、snow_spirit_meat 已落账。顺势叙述进食过程即可，禁重复扣物、禁写任何 snow 旗标。]`,
      };
    }
  }
  return null;
}
