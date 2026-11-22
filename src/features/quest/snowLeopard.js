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
  const tags = entry?.tags || [];
  if (tags.includes("肉食")) return true;
  if (tags.length) return tags.some((tag) => SNOW_MEAT_TAGS.has(tag)) && SNOW_MEAT_RE.test(name);
  return SNOW_MEAT_RE.test(name);
}
