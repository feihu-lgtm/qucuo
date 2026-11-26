import { FIELDS, readField } from "../state/fields.js";
export { getPresentNpcs, formatFactSummariesForPrompt, readField as resolveRef } from "../state/fields.js";

function displayPromptValue(value) {
  if (value == null) return "";
  if (Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)) return value.join("/");
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

// ASCII segments stop before Han text (e.g. @round.round回合). Braces disambiguate any boundary.
const REF_PATTERN = /@(?:\{([^\s{}]+)\}|((?:[A-Za-z0-9_]+|\p{Script=Han}[\p{L}\p{N}_]*)(?:\.(?:[A-Za-z0-9_]+|\p{Script=Han}[\p{L}\p{N}_]*))*))/gu;

export function renderPromptTemplate(template, scope, { trace } = {}) {
  const missing = new Set();
  const text = template.replace(REF_PATTERN, (_, braced, bare) => {
    const path = braced ?? bare;
    const value = readField(scope, path);
    if (value === undefined) missing.add(path);
    return displayPromptValue(value);
  });
  const missingPaths = [...missing];
  if (missingPaths.length) trace?.(missingPaths);
  return { text, missingPaths };
}

export function renderFieldScales(paths, scope = {}, trace) {
  const lines = [...new Set(paths)].flatMap((path) => {
    const field = FIELDS[path];
    return field?.scale ? [`- ${field.label}：${renderPromptTemplate(field.scale, scope, { trace }).text}`] : [];
  });
  return lines.length ? "\n【本轮可写字段的尺度】\n" + lines.join("\n") : "";
}

const PLAYER = "主角:@主角.名〔@主角.性别〕";
const LOCATION = "时间:@时间 " + PLAYER + " 房间:@房间.名 出口:@房间.出口 NPCs:@在场NPC";
// 夜班调查实证：银两不进状态行时模型对玩家贫富一无所知，500两照写「半文钱摸不出来」——
// 银两必须随 HP 同槽喂给主叙事；铁律贴状态块钉死：叙事不得写系统未结算的收付钱。
const VITALS = "HP:@气血 内功:@内功 外功:@外功 银两:@银两";
const SILVER_RULE = "\n[银两铁律] 玩家银两以状态值为准，正文不得虚构哭穷或摆阔；付钱、收钱、找零、结账只写系统已结算的（本轮定案签发或商店成交），系统未扣账时不得出现伙计收钱结清、掌柜找零之类情节——吃喝未结账就写赊着或未写付账，绝不让叙事与账务各说各话。";
const MAIN_STATE_TEMPLATE = LOCATION + "\n此处:@房间.描写\n地上物品:@地上物品 " + VITALS +
  " 七维:@特殊属性 背包:@背包 装备:@装备 武功:@武学 因果:@道德 劫数:@劫数\n[已触发事件] @标记@今日起居" + SILVER_RULE;
const PREVIEW_STATE_TEMPLATE = LOCATION + " " + VITALS + " 背包:@背包";
const WHISPER_STATE_TEMPLATE = PLAYER + " 时间:@时间 房间:@房间.名（@房间.描写） 房间里的人:@在场NPC 玩家背包:@背包";

export function buildMainStatePrompt(scope, { gmNote = "", preview = false, trace } = {}) {
  const promptRefOptions = preview
    ? { inventoryNames: true, inventorySeparator: "，", emptyInventory: "空", outerRoomOnly: true }
    : { detailedNpcs: true };
  const text = renderPromptTemplate(preview ? PREVIEW_STATE_TEMPLATE : MAIN_STATE_TEMPLATE,
    { ...scope, promptRefOptions }, { trace }).text;
  return preview ? text : `[状态] ${gmNote}${text}`;
}

export function buildWhisperStatePrompt(scope, { preview = false, trace } = {}) {
  const prefix = preview ? "" : "[当前世界状态，仅供你了解背景，不必主动复述] ";
  const promptRefOptions = { inventorySeparator: "，", emptyInventory: "空", outerRoomOnly: preview };
  return prefix + renderPromptTemplate(WHISPER_STATE_TEMPLATE, { ...scope, promptRefOptions }, { trace }).text;
}
