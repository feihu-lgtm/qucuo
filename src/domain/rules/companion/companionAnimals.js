// 具名伙伴实例与解锁逻辑（雪豹→白栖雪 / 珍珠→夏明珠 / 明日香）
import { generateNpcAttributes, getTierPower, hpFromNeigong, deriveSignatureMoveset } from "../npc/npcGeneration.js";
import { createEmptyStatusSlots } from "../combat/statusEffects.js";
import { COMPANION_SLOTS } from "./companionSlots.js";
import { COMPANION_PROFILES, HUMAN_PROFILE_REV } from "../../data/npc/companionProfiles.js";

const SNOW_LEOPARD_LEVEL_CAP = 2; // 蓝档

export const SNOW_LEOPARD_PROFILE = {
  moveWeights: { 攻击: 0.55, 防御: 0.2, 状态: 0.25 },
  riskAppetite: 0.75,
  avoidRepeat: 0.15,
};

function attachHumanProfile(npcShape, profile) {
  return {
    ...npcShape,
    humanName: profile.humanName,
    beastName: profile.beastName,
    nativeName: profile.nativeName,
    aliases: [...profile.aliases],
    title: profile.title,
    gender: profile.gender,
    age: profile.age,
    faction: profile.faction,
    brief: profile.brief,
    beastBrief: profile.beastBrief,
    personality: profile.personality,
    lifeHistory: profile.lifeHistory,
    fullBio: profile.fullBio,
    likes: profile.likes,
    hobby: profile.hobby,
    tradeStyle: profile.tradeStyle,
    kungfu: profile.kungfu,
    nsfw: profile.nsfwProfile.summary,
    nsfwProfile: profile.nsfwProfile,
    bodyProfile: profile.bodyProfile,
    carry: profile.carry.map((item) => ({ ...item })),
    stealables: {
      equipment: profile.stealables.equipment.map((item) => ({ ...item })),
      sundries: profile.stealables.sundries.map((item) => ({ ...item })),
    },
    humanProfileRev: HUMAN_PROFILE_REV,
  };
}

function deactivateOtherSlots(companionState, activeKey) {
  const next = { ...companionState };
  const keys = new Set([...COMPANION_SLOTS.map((s) => s.key), ...Object.keys(next)]);
  for (const k of keys) {
    if (k !== activeKey && next[k] && typeof next[k] === "object") {
      next[k] = { ...next[k], active: false };
    }
  }
  return next;
}

export function createSnowLeopard() {
  const levelCap = SNOW_LEOPARD_LEVEL_CAP;
  const special = generateNpcAttributes({ levelCap });
  special.身法 = Math.min(10, special.身法 + 2);
  special.体魄 = Math.min(10, special.体魄 + 1);
  special.悟性 = Math.max(1, special.悟性 - 2);

  const { baseAtk, neigong, waigong } = getTierPower(levelCap);
  const maxHp = hpFromNeigong(neigong, special.体魄);
  const profile = COMPANION_PROFILES.snowLeopard;

  const npcShape = { name: "雪豹", id: "companion_snow_leopard", levelCap, special, waigong, neigong, baseAtk };
  const moveset = deriveSignatureMoveset(npcShape, { levelCap });

  return attachHumanProfile({
    ...npcShape,
    beast: true,
    profile: SNOW_LEOPARD_PROFILE,
    moveset,
    equipAtk: 0,
    equipDef: 0,
    combatStats: {
      hp: [maxHp, maxHp],
      energy: [10, 10],
      statusSlots: createEmptyStatusSlots(),
    },
  }, profile);
}

export function unlockSnowLeopard(companionState, { now = null } = {}) {
  const cur = companionState?.snowLeopard;
  if (cur?.unlocked && cur?.data) return companionState;
  const profile = COMPANION_PROFILES.snowLeopard;
  return {
    ...deactivateOtherSlots(companionState, "snowLeopard"),
    snowLeopard: {
      unlocked: true,
      active: true,
      data: createSnowLeopard(),
      form: "human",
      transformed: true,
      humanName: profile.humanName,
      beastName: profile.beastName,
      transformedAt: now,
      voice: "human",
      cannotSpeak: false,
      affectionable: true,
    },
  };
}

export function isSnowLeopardAvailable(companionState) {
  return !!(companionState?.snowLeopard?.unlocked && companionState?.snowLeopard?.active && companionState?.snowLeopard?.data);
}

const PEARL_LEVEL_CAP = 2; // 蓝档

export const PEARL_PROFILE = {
  moveWeights: { 攻击: 0.4, 防御: 0.35, 状态: 0.25 },
  riskAppetite: 0.5,
  avoidRepeat: 0.25,
};

export function createPearl() {
  const levelCap = PEARL_LEVEL_CAP;
  const special = generateNpcAttributes({ levelCap });
  special.体魄 = Math.min(10, special.体魄 + 2);
  special.身法 = Math.min(10, special.身法 + 1);
  special.悟性 = Math.max(1, special.悟性 - 2);

  const { baseAtk, neigong, waigong } = getTierPower(levelCap);
  const maxHp = hpFromNeigong(neigong, special.体魄);
  const profile = COMPANION_PROFILES.pearl;

  const npcShape = { name: "珍珠", id: "companion_pearl", levelCap, special, waigong, neigong, baseAtk };
  const moveset = deriveSignatureMoveset(npcShape, { levelCap });

  return attachHumanProfile({
    ...npcShape,
    beast: true,
    profile: PEARL_PROFILE,
    moveset,
    equipAtk: 0,
    equipDef: 0,
    combatStats: {
      hp: [maxHp, maxHp],
      energy: [10, 10],
      statusSlots: createEmptyStatusSlots(),
    },
  }, profile);
}

export function unlockPearl(companionState, { now = null } = {}) {
  const cur = companionState?.pearl;
  if (cur?.unlocked && cur?.data) return companionState;
  const profile = COMPANION_PROFILES.pearl;
  return {
    ...deactivateOtherSlots(companionState, "pearl"),
    pearl: {
      unlocked: true,
      active: true,
      data: createPearl(),
      form: "human",
      transformed: true,
      humanName: profile.humanName,
      beastName: profile.beastName,
      transformedAt: now,
      voice: "human",
      cannotSpeak: false,
      affectionable: true,
    },
  };
}

const ASUKA_LEVEL_CAP = 5; // 红档

export function createAsuka() {
  const levelCap = ASUKA_LEVEL_CAP;
  const special = generateNpcAttributes({ levelCap });
  special.身法 = Math.min(10, special.身法 + 2);
  special.气运 = Math.min(10, special.气运 + 1);
  special.体魄 = Math.max(1, special.体魄 - 1);

  const { baseAtk, neigong, waigong } = getTierPower(levelCap);
  const maxHp = hpFromNeigong(neigong, special.体魄);

  const npcShape = { name: "明日香", id: "companion_asuka", levelCap, special, waigong, neigong, baseAtk };
  const moveset = deriveSignatureMoveset(npcShape, { levelCap });

  return {
    ...npcShape,
    beast: false,
    moveset,
    brief: "红衣长枪的女侠，自称本女侠",
    carry: [
      { name: "朗基努斯", category: "weapon", quality: "红" },
      { name: "红缎发带", category: "accessory", quality: "蓝" },
      { name: "藏银经轮", category: "accessory", quality: "紫" },
      { name: "布偶猴子", category: "misc", quality: "白" },
      { name: "没有标签的药瓶", category: "misc", quality: "蓝" },
      { name: "半块酥油曲奇", category: "misc", quality: "绿" },
    ],
    equipAtk: 0,
    equipDef: 0,
    combatStats: {
      hp: [maxHp, maxHp],
      energy: [10, 10],
      statusSlots: createEmptyStatusSlots(),
    },
  };
}

export function unlockAsuka(companionState) {
  const cur = companionState?.asuka;
  if (cur?.unlocked && cur?.data) return companionState;
  return {
    ...companionState,
    asuka: { unlocked: true, active: true, data: createAsuka() },
    snowLeopard: { ...(companionState?.snowLeopard || { unlocked: false, active: false, data: null }), active: false },
  };
}

export function isAsukaAvailable(companionState) {
  return !!(companionState?.asuka?.unlocked && companionState?.asuka?.active && companionState?.asuka?.data);
}
