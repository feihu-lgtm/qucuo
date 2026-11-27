import { INTIMATE_FIELDS, PUBLIC_FIELDS } from "./bodyProfile.js";
import { COMPANION_PROFILES } from "../../data/npc/companionProfiles.js";

export const INTIMATE_DETAIL_FIELDS = Object.freeze([
  { key: "chest", label: "胸", def: "肩胸锁骨与上胸肌肤轮廓" },
  { key: "breasts", label: "乳", def: "双乳形态、手感、乳晕与乳尖敏感反应" },
  { key: "butt", label: "屁股", def: "臀部弧度、肉感弹力与尾根衔接触感" },
  { key: "vulva", label: "小穴", def: "私处外观、芳草、湿润度与内壁紧致反应" },
  { key: "legsAndFeet", label: "腰腿玉足", def: "双腿曲线、足踝足型与情动反应" },
]);

export const COMPANION_BODY_PROFILES = Object.freeze({
  pearl: COMPANION_PROFILES.pearl.bodyProfile,
  snowLeopard: COMPANION_PROFILES.snowLeopard.bodyProfile,
});

export function formatCompanionBodyBlock(key, { nsfw = false } = {}) {
  const full = COMPANION_PROFILES[key];
  const profile = full?.bodyProfile || COMPANION_BODY_PROFILES[key];
  if (!profile) return "";
  const fields = nsfw ? [...PUBLIC_FIELDS, ...INTIMATE_FIELDS] : PUBLIC_FIELDS;
  const lines = fields
    .filter((field) => (profile[field.key] || "").trim())
    .map((field) => `  ${field.label}（${field.def}）: ${profile[field.key].trim()}`);
  if (nsfw && full?.nsfwProfile) {
    for (const detail of INTIMATE_DETAIL_FIELDS) {
      const value = (full.nsfwProfile[detail.key] || "").trim();
      if (value) lines.push(`  私密·${detail.label}（${detail.def}）: ${value}`);
    }
  }
  if (!lines.length) return "";
  return `\n【化形体貌明细】\n${lines.join("\n")}`;
}
