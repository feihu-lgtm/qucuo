// 伙伴外貌形态文案（从 companion.js 拆出）与化形调度拼装
// ============================================================================
import { ADULT_HUMAN_FORM } from "./companionSlots.js";
import { COMPANION_PROFILES, getCompanionProfile } from "../../data/npc/companionProfiles.js";
import { formatCompanionBodyBlock } from "../character/companionBodyProfiles.js";
import { getPromptOverrides } from "../prompt/registry.js";
import { loadCopy } from "../../../copy/loadCopy.js";

// ── 伙伴外貌形态（兽形/人形）文字描述 + 选择器 ────────────────────────
export const COMPANION_DESC_FORMS = [
  { key: "beast", label: "兽形" },
  { key: "human", label: "人形" },
];

// base：无论兽形人形都要交代的身份底色（认主等；不通人言只写在 beast）；beast/human：两种形态的
// 形貌与表现；nsfw：仅人形且■模式开启时追加的私密性情。
export const COMPANION_LORE = {
  snowLeopard: {
    base: `随行的雪豹（化形三字人名「${COMPANION_PROFILES.snowLeopard.humanName}」，名号「${COMPANION_PROFILES.snowLeopard.title}」）通体雪白，来自雪线之上，并非嘎则或任何人的兽——她无主、命定只认玩家一人，是前世便结下羁绊的灵兽，如今已能化形为成年女子相伴。她对旁人戒备疏离，唯独在玩家身边安静温顺，认主后黏人而忠贞。`,
    beast: `它此刻是兽形——不通人言，情感全凭动作、眼神、姿态传达（以额抵掌、绕身而行、伏低臣服、尾梢轻缠手腕等），叙事时务必如此表现，不要让它开口说人话。`,
    human: `认主入队后，她已化为人形女子「${COMPANION_PROFILES.snowLeopard.humanName}」相伴（${ADULT_HUMAN_FORM}），人形时能开口说人话，嗓音清冷、措辞简短——及腰一头雪白银发，发间垂着松石蓝珠与金穗流苏，头顶生一对雪豹兽耳、白绒里缀墨斑，额心嵌一枚菱形松石额饰，一双眸子是雪线天光般的蓝灰、瞳仁竖如兽目，肤白胜雪，肩头腰腹隐约透出雪豹的墨色斑纹，如兽皮花纹长在肉里，身披半透的雪纹薄纱、内衬豹纹，腰系金链松石，身后拖着一条粗长的雪豹斑尾，手里常按一柄镶松石、垂金穗的长剑，神情清冷而骨子里压着一股未驯的野性。化形后她仍认玩家为主，黏人而忠贞，化形与否由她随心意切换，叙事中可视情境让她在兽形与人形间自然转换。`,
    nsfw: `\n【■模式·雪豹（白栖雪）化形私密性情】${COMPANION_PROFILES.snowLeopard.nsfwProfile.summary}她耳根与尾根最是敏感，被顺毛、被挠耳后会忍不住喉咙里发出呼噜般的低鸣、兽耳轻抖、长尾缠上玩家手腕；平日清冷寡言，床笫间反差极烈，喜欢被从背后环抱、被咬颈侧，动情时瞳孔竖成一线、用牙轻啃玩家肩头留下月牙印痕，事后蜷在怀里舔舐指尖。涉及亲密剧情时，按■模式写作规则直白铺陈其胸、乳、臀、穴与兽性反应细节，不必替她遮掩。`,
  },
  pearl: {
    base: `随行的小白马名叫珍珠（藏语本名「哈瓦夏日」，化形三字人名「${COMPANION_PROFILES.pearl.humanName}」，名号「${COMPANION_PROFILES.pearl.title}」），是认主只随玩家一人的灵马，如今已能化形为成年女子相伴；忠心无二、脚力惊人，平日却志不在驰骋，最爱专心干饭、就地躺平。`,
    beast: `它此刻是马形——一匹睫毛长长、丰神俊朗的白马，随在玩家身侧同行，走两步就要低头啃草，惫懒得很，真要护主赶路时却撒蹄如飞、快如白影。此形不通人言，情感全凭嘶鸣、甩尾、低头蹭人传达，叙事时不要让它开口说人话。`,
    human: `认主入队后，她已化为人形「${COMPANION_PROFILES.pearl.humanName}」相伴（${ADULT_HUMAN_FORM}），人形时能开口说人话——一位带着马儿身体元素的成年女子，上身穿一袭比基尼、外罩一件轻纱小衣，一头栗色长发扎成高马尾，发间立着一对毛茸茸的马耳朵，身后拖着一条蓬松的马尾，五官明艳、身形健美，肌肤与常人无异、是实打实的人类身体，唯独那对马耳和那条马尾露着她的来历。化形后她仍认玩家为主，黏人而忠贞，性子却依旧惫懒贪吃，化形与否由她随心意切换，叙事中可视情境让她在马形与人形间自然转换。`,
    nsfw: `\n【■模式·珍珠（夏明珠）化形私密性情】${COMPANION_PROFILES.pearl.nsfwProfile.summary}她马耳耳根与后腰尾根雪白绒圈最是敏感，被顺毛摩挲便立刻仰颈弓腰；平日惫懒讨食，动情时却比谁都直球滚烫，既爱整个人窝进怀里让人揉按胸臀，也会凭惊人腰腿劲道翻身主动骑乘掌控起伏，事后赖在胸口蹭尾讨吻讨零嘴。涉及亲密剧情时，按■模式写作规则直白铺陈其胸、乳、臀、穴与反应细节，不必替她遮掩。`,
  },
};

function renderTpl(tpl, vars) {
  let out = String(tpl || "");
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`@${k}`).join(v ?? "");
  }
  return out;
}

function summarizeKungfu(profile) {
  const kf = profile?.kungfu;
  if (!kf) return "";
  const moveNames = (kf.moves || []).map((m) => `${m.name}（${m.slot}）`).join("、");
  return `${kf.school}｜内功「${kf.neigongName}」｜轻功「${kf.qinggongName}」｜兵刃「${kf.weapon}」｜招式：${moveNames}。${kf.desc}`;
}

export function buildFirstTransformPrompt(nameOrKey, { overrides = getPromptOverrides(), singleCall = false } = {}) {
  const ov = overrides?.companion_transform;
  if (ov?.mode === "off") return "";
  const profile = getCompanionProfile(nameOrKey);
  if (!profile) return "";
  const lore = COMPANION_LORE[profile.key];
  const tpl = typeof ov?.text === "string" && ov.text.trim()
    ? ov.text
    : loadCopy("companionTransform.txt");
  const mvuTail = singleCall
    ? "本轮禁输出任何好感相关 <mvu>——同行情谊与化形入队均已由系统确定性结算完毕。"
    : "";
  return renderTpl(tpl, {
    beastName: profile.beastName,
    humanName: profile.humanName,
    title: profile.title,
    age: String(profile.age),
    adultRule: ADULT_HUMAN_FORM,
    transformCue: profile.firstJoinCue,
    humanAppearance: lore?.human || profile.fullBio,
    personality: profile.personality,
    kungfuSummary: summarizeKungfu(profile),
    mvuTail,
  }).trimEnd();
}

export function formatCompanionDossierBlock(key, { active = false, form = "human", nsfw = false, overrides = getPromptOverrides() } = {}) {
  const ov = overrides?.companion_dossier;
  if (ov?.mode === "off") return "";
  const profile = getCompanionProfile(key);
  const lore = profile ? COMPANION_LORE[profile.key] : null;
  if (!profile || !lore) return "";
  const isHuman = form !== "beast";
  const bodyBlock = isHuman ? formatCompanionBodyBlock(profile.key, { nsfw: !!nsfw }).trim() : "";
  const nsfwNote = isHuman && nsfw && lore.nsfw ? `\n${lore.nsfw.trim()}` : "";
  const habitLine = isHuman && nsfw && profile.bodyProfile?.habit
    ? `\n亲密习性：${profile.bodyProfile.habit}`
    : "";
  const tpl = typeof ov?.text === "string" && ov.text.trim()
    ? ov.text
    : loadCopy("companionDossier.txt");
  const baseTag = active ? "当前出战随行" : "随行在侧";
  const formText = isHuman
    ? `${baseTag} · 人形相伴（${ADULT_HUMAN_FORM}）。${lore.human}`
    : `${baseTag} · 兽形相随。${lore.beast}`;
  return `\n\n${renderTpl(tpl, {
    beastName: profile.beastName,
    humanName: profile.humanName,
    nativeSuffix: profile.nativeName ? `，藏语原名「${profile.nativeName}」` : "",
    title: profile.title,
    age: String(profile.age),
    formText,
    personality: profile.personality,
    habitLine,
    kungfuSummary: summarizeKungfu(profile),
    bodyBlock: bodyBlock ? `${bodyBlock}` : "（兽形状态不注入人形体貌与私密细节）",
    nsfwNote,
  }).trimEnd()}`;
}
