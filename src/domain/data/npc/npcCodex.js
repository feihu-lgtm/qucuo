// 人物志图鉴静态底账（domain/data 纯数据汇聚）：
// 汇总据点固定驻场、OC 冒险者、同游伙伴、游走人物与已入库小像名录，
// 只暴露展示字段（不含任何规则计算），供图鉴面板读取。
import { RESIDENT_NPCS } from "./residentNpcs.js";
import { NPC_POOL } from "./npcPool.js";
import { ADVENTURER_POOL } from "../dungeon/adventurers.js";
import { ADVENTURER_POOL_IP } from "../dungeon/adventurersIP.js";
import { NPC_ART } from "../art/artManifest.js";
import { COMPANION_PROFILES } from "./companionProfiles.js";

const ART_SET = new Set(NPC_ART);
const COMPANION_REGION = new Set(["雪豹", "珍珠", "明日香"]);

const EXTRA_COMPANIONS = [
  {
    name: "明日香",
    region: "同行伙伴",
    brief: "红衣长枪的女侠，自称本女侠，与你从心灵之海一路同行而来",
    bio: "来自心灵之海的红衣长枪女侠，傲气直爽，随时可出战或留守据点。",
    levelCap: 4,
    carry: [],
  },
];

function topRoutineRegion(routineWeights) {
  if (!routineWeights || typeof routineWeights !== "object") return "江湖游走";
  const entries = Object.entries(routineWeights).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] || "江湖游走";
}

function normalizeCarry(npc) {
  if (Array.isArray(npc.carry)) {
    return npc.carry.map((c) => (typeof c === "string" ? c : c?.name)).filter(Boolean);
  }
  const eq = Array.isArray(npc.stealables?.equipment) ? npc.stealables.equipment : [];
  const sun = Array.isArray(npc.stealables?.sundries) ? npc.stealables.sundries : [];
  return [...eq, ...sun].map((c) => (typeof c === "string" ? c : c?.name)).filter(Boolean);
}

let cachedEntries = null;

export function getNpcCodexEntries() {
  if (cachedEntries) return cachedEntries;
  const byName = new Map();
  const upsert = (name, patch) => {
    if (!name) return;
    const prev = byName.get(name);
    if (!prev) {
      byName.set(name, {
        name,
        region: patch.region || "曲措众生",
        brief: patch.brief || "",
        bio: patch.bio || patch.brief || "",
        levelCap: typeof patch.levelCap === "number" ? patch.levelCap : 0,
        carry: patch.carry || [],
        hasArt: ART_SET.has(name),
      });
      return;
    }
    byName.set(name, {
      ...prev,
      region: prev.region === "曲措众生" && patch.region ? patch.region : prev.region,
      brief: prev.brief || patch.brief || "",
      bio: prev.bio.length >= (patch.bio || "").length ? prev.bio : patch.bio,
      levelCap: Math.max(prev.levelCap, typeof patch.levelCap === "number" ? patch.levelCap : 0),
      carry: prev.carry.length ? prev.carry : (patch.carry || []),
    });
  };

  for (const [district, list] of Object.entries(RESIDENT_NPCS)) {
    for (const npc of list || []) {
      upsert(npc.name, {
        region: COMPANION_REGION.has(npc.name) ? "同行伙伴" : district,
        brief: npc.brief || "",
        bio: npc.fullBio || npc.personality || npc.brief || "",
        levelCap: npc.levelCap,
        carry: normalizeCarry(npc),
      });
    }
  }

  for (const npc of EXTRA_COMPANIONS) {
    upsert(npc.name, npc);
  }

  for (const adv of [...ADVENTURER_POOL, ...ADVENTURER_POOL_IP]) {
    upsert(adv.name, {
      region: adv.homeDistrict || "江湖游侠",
      brief: adv.brief || "",
      bio: adv.fullBio || adv.personality || adv.brief || "",
      levelCap: adv.levelCap,
      carry: normalizeCarry(adv),
    });
  }

  for (const npc of NPC_POOL) {
    upsert(npc.name, {
      region: topRoutineRegion(npc.routineWeights),
      brief: npc.brief || "",
      bio: npc.personality || npc.brief || "",
      levelCap: npc.levelCap,
      carry: normalizeCarry(npc),
    });
  }

  for (const name of NPC_ART) {
    upsert(name, { region: COMPANION_REGION.has(name) ? "同行伙伴" : "曲措众生" });
  }

  for (const profile of Object.values(COMPANION_PROFILES)) {
    const prev = byName.get(profile.beastName);
    if (!prev) continue;
    byName.set(profile.beastName, {
      ...prev,
      humanName: profile.humanName,
      title: profile.title,
      aliases: [...profile.aliases],
      kungfu: profile.kungfu,
      nsfwProfile: profile.nsfwProfile,
      bodyProfile: profile.bodyProfile,
      bio: profile.fullBio,
      brief: profile.brief,
      carry: profile.carry.map((c) => c.name),
    });
  }

  cachedEntries = [...byName.values()].sort((a, b) => {
    const aComp = a.region === "同行伙伴" ? 0 : 1;
    const bComp = b.region === "同行伙伴" ? 0 : 1;
    if (aComp !== bComp) return aComp - bComp;
    if (a.hasArt !== b.hasArt) return a.hasArt ? -1 : 1;
    return a.name.localeCompare(b.name, "zh-CN");
  });
  return cachedEntries;
}

export function getNpcCodexRegions() {
  const counts = new Map();
  for (const entry of getNpcCodexEntries()) {
    counts.set(entry.region, (counts.get(entry.region) || 0) + 1);
  }
  return ["全部", ...[...counts.entries()]
    .sort((a, b) => {
      if (a[0] === "同行伙伴") return -1;
      if (b[0] === "同行伙伴") return 1;
      if (a[0] === "曲措众生") return 1;
      if (b[0] === "曲措众生") return -1;
      return b[1] - a[1];
    })
    .map(([r]) => r)];
}
