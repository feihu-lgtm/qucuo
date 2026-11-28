import { QUCUO_QUESTS } from "../../data/quests/qucuoQuests.js";
import { migrateCompanionState } from "../companion/companion.js";
import { ocSignatureMovesByName } from "../companion/ocKungfu.js";
import { deriveSignatureMoveset, resolveBurdenMoves } from "./npcMovesets.js";
import { scrubLogEntries } from "../log/logTypes.js";

// 历史版本人物改名迁移表：同一个 NPC 在旧版本里叫别的名字/用别的 id 时，
// 老存档里按旧名/旧 id 记下的数据（角色面板键、在场 NPC、roomMap、日志文本等）
// 读档时统一迁到新名，老档不断档。
// 只登记「同人改名」；新增/删除人物不走这里（PR274 天龙教改回原作名后的迁移表）。

// 显示名 → 新显示名（人物名、房间/roomMap npcs[].name、varTree.角色 键、日志文本）
export const LEGACY_NPC_RENAMES = {
  石重岳: "厉苍龙", // 龙王·天龙教现任教主
  安世衡: "厉苍天", // 天王·前教主，被废软禁
  // AI娘四位冒险者改用诗经二字名（id 不变）
  "Claude娘": "秩秩",
  "Gemini猫娘": "参昴",
  "Grok娘": "笑敖",
  "大肥鱼": "鱼丽",
};

// npc id → 新 npc id（resident_ 前缀的常驻人物 id，act 指令按它找人）
export const LEGACY_NPC_ID_RENAMES = {
  resident_shizhongyue: "resident_licanglong",
  resident_anshiheng: "resident_licangtian",
};

const ALL_RENAMES = { ...LEGACY_NPC_RENAMES, ...LEGACY_NPC_ID_RENAMES };
const OLD_TOKENS = Object.keys(ALL_RENAMES);

function renameText(s) {
  let out = s;
  for (const old of OLD_TOKENS) out = out.split(old).join(ALL_RENAMES[old]);
  return out;
}

function migrateValue(v) {
  if (typeof v === "string") return renameText(v);
  if (Array.isArray(v)) return v.map(migrateValue);
  if (v && typeof v === "object") {
    // 导入人物卡（玩家自己导的角色）不是游戏内 NPC：name/id 原样保留，
    // 卡还在 importedRegistry 单独册子里，迁名会让它和注册表里的本尊分身。
    // 其余字段照常迁——卡里引用了游戏内旧名的文本（如「石重岳的徒弟」）仍要改。
    if (v.imported === true) {
      const out = {};
      for (const [k, val] of Object.entries(v)) {
        out[k] = (k === "name" || k === "id") ? val : migrateValue(val);
      }
      return out;
    }
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      const nk = ALL_RENAMES[k] ?? k;
      const mv = migrateValue(val);
      // 老存档里新旧名并存（同名人物两边各有一条记录）时以新名为准，
      // 另一边的条目只补缺失字段，不丢数据。两个方向都要兜：旧键先到、
      // 新键后到（新键覆盖旧键值但保留旧键独有字段），或新键先到、旧键后到。
      if (nk in out) {
        const cur = out[nk];
        if (mv && typeof mv === "object" && !Array.isArray(mv)
          && cur && typeof cur === "object" && !Array.isArray(cur)) {
          out[nk] = nk === k ? { ...cur, ...mv } : { ...mv, ...cur };
        } else if (typeof mv === "number" && typeof cur === "number") {
          // 数值冲突（好感日增计数、回合戳之类）：取大者——同一人的计数往保守合。
          out[nk] = Math.max(mv, cur);
        } else {
          // 其余标量冲突一律新名条目优先：新键后到（nk===k）mv 即新值；
          // 旧键后到（nk!==k）保留已在的 cur（新值），旧值弃之。
          out[nk] = nk === k ? mv : cur;
        }
      } else {
        out[nk] = mv;
      }
    }
    return out;
  }
  return v;
}

// 迁移整个存档快照：深遍历所有字段，命中旧名/旧 id 一律改写。
// 旧名是新名字的子串、且互不重叠，逐 token 替换不会误伤；旧档物品描述、
// 日志、私聊记录里提到旧名的文本也一并迁过去。
// 玩家自己取的名字（snap.char.name）除外——那是玩家输入，不动。
export function migrateLegacySnapshot(snap) {
  if (!snap || typeof snap !== "object") return snap;
  const migrated = migrateValue(snap);
  if (migrated.char && snap.char && snap.char.name != null) migrated.char.name = snap.char.name;
  if (Array.isArray(migrated.log)) migrated.log = scrubLogEntries(migrated.log);
  return migrateOcContent(realignQuestStages(migrated));
}

// OC 内容迁移（幂等）：
//  ① companionState：已入队 OC 的招式按 kungfu 重建、补建缺失的随从槽（铁伯）。
//  ② 房间里的 OC：出生固化时用的是通用随机招（moveset 里没有任何 signature 标记），
//     按 OC 卡的 kungfu.moves 重派生。「没有 signature 标记」就是干净的判据——专属招/OC 招
//     派生出来的每一招都带 signature:true；博弈层招（burdenMoveIds）单独重解析后接在尾部，不丢。
function rederiveOcMoveset(npc) {
  if (!npc || !Array.isArray(npc.moveset) || !npc.moveset.length) return npc;
  if (npc.moveset.some((m) => m?.signature)) return npc;
  if (!ocSignatureMovesByName(npc.name)) return npc;
  const base = deriveSignatureMoveset(npc, { levelCap: npc.levelCap });
  if (!base) return npc;
  return { ...npc, moveset: [...base, ...resolveBurdenMoves(npc.burdenMoveIds)] };
}

function rederiveNpcList(list) {
  if (!Array.isArray(list)) return list;
  const next = list.map(rederiveOcMoveset);
  return next.some((n, i) => n !== list[i]) ? next : list;
}

function migrateOcContent(snap) {
  let out = snap;
  const companionState = migrateCompanionState(snap.companionState);
  if (companionState !== snap.companionState) out = { ...out, companionState };
  const roomNpcs = rederiveNpcList(snap.room?.npcs);
  if (roomNpcs !== snap.room?.npcs) out = { ...out, room: { ...out.room, npcs: roomNpcs } };
  if (snap.roomMap && typeof snap.roomMap === "object") {
    let roomMap = snap.roomMap;
    for (const [name, entry] of Object.entries(snap.roomMap)) {
      const npcs = rederiveNpcList(entry?.npcs);
      if (npcs !== entry?.npcs) roomMap = { ...roomMap, [name]: { ...entry, npcs } };
    }
    if (roomMap !== snap.roomMap) out = { ...out, roomMap };
  }
  return out;
}

// 中间插了新阶段的任务（香2 比武招贤由 3 步扩成 6 步）：老档存的阶段序号对不上新阶段表，
// 按已持有的 flag 重新定位到第一个还没过的阶段。新档的序号本来就等于这个位置，原样不变。
export const LEGACY_RESTAGED_QUESTS = ["huanxijiao_2_biwuzhaoxian"];

function realignQuestStages(snap) {
  const flags = snap.flags || [];
  let questProgress = snap.questProgress;
  for (const id of LEGACY_RESTAGED_QUESTS) {
    const progress = questProgress?.[id];
    const quest = QUCUO_QUESTS.find((entry) => entry.id === id);
    if (progress?.status !== "active" || !quest?.stages?.length) continue;
    const index = quest.stages.findIndex((stage) => ![].concat(stage.completionFlag).some((flag) => flags.includes(flag)));
    if (index < 0 || index === progress.currentStageIndex) continue;
    questProgress = { ...questProgress, [id]: { ...progress, currentStageIndex: index } };
  }
  return questProgress === snap.questProgress ? snap : { ...snap, questProgress };
}
