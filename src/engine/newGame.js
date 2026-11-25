import { QUCUO_PRESET } from "../domain/data/presets/qucuo.js";
import { QUCUO_MAP } from "../domain/data/map/qucuoMap.js";
import { hasInnerMap, getDistrictAnchor, getInnerRoomNames } from "../domain/rules/map/innerMap.js";
import { mapDescriptionToGenParams } from "../domain/data/npc/npcDescriptionMapping.js";
import { ensureNpcCombatData, deriveMovesetFromSkills, hpFromNeigong } from "../domain/rules/npc/npcGeneration.js";
import { backfillInventoryFromCatalog } from "../domain/data/items/catalog.js";
import { initialNarratorState } from "../domain/rules/narrator/narrator.js";
import { initialVarTree } from "../domain/rules/prompt/mvu.js";
import { seedKnowledge } from "../domain/rules/prompt/knowledge.js";
import { initCompanionState } from "../domain/rules/companion/companionState.js";
import { npcTradeOf } from "../domain/rules/npc/npcTrade.js";
import { CURRENT_VERSION } from "../utils/version.js";
import { setRngState, setSeed } from "../utils/rng.js";
import { stampLogEntries } from "../domain/rules/log/logTypes.js";

export const DEFAULT_PRESETS = [QUCUO_PRESET];

/**
 * @param {{ preset: object, snap: object } | null} restored
 * @param {number} [seed] 新局或没有随机状态的旧存档使用的种子
 * @returns {object}
 */
export function buildInitialGameState(restored, seed) {
  const savedRngState = restored?.snap.rngState;
  const hasSavedRngState = setRngState(savedRngState);
  if (!hasSavedRngState) setSeed(seed ?? Date.now());

  const state = {
    preset: restored?.preset || DEFAULT_PRESETS[0],
    room: (() => {
      const initialRoom = restored?.snap.room || DEFAULT_PRESETS[0].room;
      // 初始房间（无论来自预设默认值还是存档恢复）里的NPC都可能还没有 moveset/carriedItems
      // 字段（预设手写时不会带这些，老存档存的时候这套系统还不存在），启动时补全一次。
      const initLuck = (restored?.snap.char || DEFAULT_PRESETS[0].char).special?.气运 ?? 5;
      return {
        ...initialRoom,
        // 之前这里没传 levelCap，预设手写的具名NPC（老猎户/杂货商人等）一律落到
        // getTierPower 的默认档位（白/村民），跟他们的实际人设强度（比如"猎户"
        // 关键词该是绿袍档）对不上——尤其是品质档位改成~20倍/档增长之后，
        // 这个疏漏会让本该有点门槛的对手变得形同虚设。这里跟AI涌现NPC用同一套
        // matchLevelCap 关键词映射，从名字+简介里推断档位。
        npcs: (initialRoom.npcs || []).map(n => {
          const { levelCap } = mapDescriptionToGenParams(`${n.name || ""} ${n.brief || ""}`);
          return ensureNpcCombatData(n, { luck: initLuck, levelCap, trade: npcTradeOf(restored?.snap.npcState, n) });
        }),
      };
    })(),
    innerRoomName: (() => {
      const initial = restored?.snap.room || DEFAULT_PRESETS[0].room;
      if (!hasInnerMap(initial.name)) return null;
      // 优先吃存档里记的内层房间（本轮新增字段）；老存档没有、或存的房间已不在
      // 该据点内景里，才退回锚点。
      const saved = restored?.snap.innerRoomName;
      if (saved && getInnerRoomNames(initial.name).includes(saved)) return saved;
      return getDistrictAnchor(initial.name);
    })(),
    char: (() => {
      const initial = restored?.snap.char || DEFAULT_PRESETS[0].char;
      const initialSkills = restored?.snap.skills || DEFAULT_PRESETS[0].skills;
      // moveset 不再是开局纯随机生成的独立数据，而是从"武学"（skills）派生——
      // 见 npcGeneration.js 的 deriveMovesetFromSkills，武学阶段决定招式品质上限，
      // 练得越深切磋越强，这样"三脚猫拳法"这类武学才是真正影响战斗的东西。
      const base = { ...initial, moveset: deriveMovesetFromSkills(initialSkills) };
      // 主角气血上限统一走 hpFromNeigong（与所有 NPC 同一套公式），不再用 preset 里
      // 写死的 100——否则同为白袍内功5，主角100、NPC却116，主角凭空矮一截。仅新开局
      // 时按公式重算上限（存档恢复则沿用存档里玩家当前的血量，不覆盖）。
      if (!restored) {
        const maxHp = hpFromNeigong(base.neigong ?? 5, base.special?.体魄 ?? 5);
        base.hp = [maxHp, maxHp];
      }
      return base;
    })(),
    dao: restored?.snap.dao || DEFAULT_PRESETS[0].dao,
    skills: restored?.snap.skills || DEFAULT_PRESETS[0].skills.map(s => ({ ...s })),
    companionState: restored?.snap.companionState || initCompanionState(),
    // 地宫内层地图 run 快照：读档把 checkpoint 进度带回来（老档无此字段按 null 兜底）
    dungeonRun: restored?.snap.dungeonRun || null,
    // NPC 随身交易账随档还原（老档无此字段按空集兜底）
    npcState: restored?.snap.npcState || {},
    // 备料缓存随档还原（WO-24A）：缓存非事实，老档无字段按空数组兜底
    prepSeeds: Array.isArray(restored?.snap.prepSeeds) ? restored.snap.prepSeeds : [],
    inv: backfillInventoryFromCatalog(restored?.snap.inv || [...DEFAULT_PRESETS[0].inv]),
    log: restored
      ? [...stampLogEntries([{ t: "sys", text: `── 已从上次自动存档恢复进度（${new Date(restored.snap.savedAt || Date.now()).toLocaleString()}） ──` }], restored?.snap.time ?? 6), ...restored.snap.log]
      : stampLogEntries([{ t: "sys", text: `MUD引擎 · 「${CURRENT_VERSION.codename}」${CURRENT_VERSION.time} · ${DEFAULT_PRESETS[0].name}` }, ...DEFAULT_PRESETS[0].opening], 6),
    convo: restored?.snap.convo || [],
    exp: restored?.snap.exp || 0,
    pot: restored?.snap.pot || 0,
    flags: restored?.snap.flags || [],
    questProgress: restored?.snap.questProgress || {},
    persuasionProgress: restored?.snap.persuasionProgress || {},
    mapData: restored?.snap.mapData || { [DEFAULT_PRESETS[0].room.name]: { x: QUCUO_MAP[DEFAULT_PRESETS[0].room.name]?.x ?? 0, y: QUCUO_MAP[DEFAULT_PRESETS[0].room.name]?.y ?? 0 } },
    time: restored?.snap.time ?? 6,
    // 原文段落谱系随档恢复：缺省 undefined/0，由启动 reconcile/首写 allocator 建根
    proseLineage: restored?.snap.proseLineage,
    proseSeq: restored?.snap.proseSeq ?? 0,
    claimedMilestones: new Set(restored?.snap.claimedMilestones || []),
    narrator: restored?.snap.narrator || initialNarratorState(),
    varTree: (() => {
      if (restored?.snap.varTree) return restored.snap.varTree; // 读档：存档里已含知识领域，不重复灌
      const base = initialVarTree();
      const p = restored?.preset || DEFAULT_PRESETS[0];
      return seedKnowledge(base, p.知识基底, 0); // 新局：灌入剧本写死的知识基底
    })(),
    deposit: restored?.snap.deposit || 0,
    depositedAt: restored?.snap.depositedAt ?? null,
    pledgedItems: restored?.snap.pledgedItems || [],
  };
  // 读档时补全 NPC 数据可能掷骰，补全后仍从存档记录的位置继续。
  if (hasSavedRngState) setRngState(savedRngState);
  return state;
}
