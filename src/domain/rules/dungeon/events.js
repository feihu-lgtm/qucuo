// 地宫房间事件 resolver（设计稿 docs/设计_地宫内层地图.md A 节 · 十类互动）。
// 消费 districts.js / districtsExtra.js 的 eventSeeds：{kind, desc, check, dc, outcome}。
// 纯函数无 IO：属性走 attrs[check]、当前战利品走 loot、随机源走 rng（() => [0,1)，默认全局 random）。
// 返回骨架 {log, effects, lootDelta, combatNpc?, branch?, nsfwBranch?}——只给确定性结构与 log 骨架，
// 具体数值结算与叙事润色由 engine/AI 层接力。

import { random } from "../../../utils/rng.js";
import { calcDungeonCheckRate, buildCombatNpc } from "./internal.js";
import { makePuzzle } from "./puzzles.js";

export const ROOM_EVENT_KINDS = Object.freeze([
  "fight", "event", "nsfw", "supply", "loot",
  "watch", "meet", "appraise", "puzzle", "checkpoint",
]);

function statOf(attrs, check) {
  return Number(attrs?.[check]) || 5;
}

// 统一检定：{check,dc} → {rate, success}；rng() 输出 [0,1)。
function runCheck(seed, attrs, rng) {
  const rate = calcDungeonCheckRate(statOf(attrs, seed.check), seed.dc ?? 5);
  return { rate, success: rng() * 100 < rate };
}

const HANDLERS = {
  // 打架：seed 可带 enemy 模板（name/levelCap/carry/role/region），缺省按 desc/dc 合成杂兵。
  fight(seed, { rng }) {
    const tpl = seed.enemy || {
      id: `evt_${seed.kind || "fight"}`,
      name: seed.enemyName || seed.desc,
      desc: seed.desc,
      levelCap: seed.dc ?? 3,
      carry: [],
    };
    const combatNpc = buildCombatNpc(tpl, "evt");
    return {
      log: `${seed.desc}——避无可避，只得拔刃相向。`,
      effects: [{ type: "combat", enemy: combatNpc.name }],
      lootDelta: {},
      combatNpc,
    };
  },

  // 随机事件：一次检定定成败，失败按 dc 折算扣血骨架。
  event(seed, { attrs, rng }) {
    const { rate, success } = runCheck(seed, attrs, rng);
    return success
      ? {
          log: `${seed.desc}——有惊无险，${seed.outcome}。`,
          effects: [{ type: "check", stat: seed.check, dc: seed.dc, rate, success: true }],
          lootDelta: {},
        }
      : {
          log: `${seed.desc}——处置失当，${seed.outcome}。`,
          effects: [
            { type: "check", stat: seed.check, dc: seed.dc, rate, success: false },
            { type: "hp_loss", amount: (seed.dc ?? 5) * 5 },
          ],
          lootDelta: {},
        };
  },

  // 色桥段：分支骨架留给 UI/AI 层展开。
  nsfw(seed) {
    return {
      log: `${seed.desc}——是去是留，只在一念之间。`,
      effects: [],
      lootDelta: {},
      nsfwBranch: {
        options: [
          { label: "依计而行", check: seed.check, dc: seed.dc, effect: { type: "nsfw_resolve", outcome: seed.outcome } },
          { label: "抽身离开", check: null, dc: 0, effect: { type: "leave" } },
        ],
      },
    };
  },

  // 补给：休整房白捡，无需检定。
  supply(seed) {
    return {
      log: `${seed.desc}——${seed.outcome}到手。`,
      effects: [{ type: "supply", outcome: seed.outcome }],
      lootDelta: { supplies: 1 },
    };
  },

  // 开奖：检定过了得银钱彩头，实物名目由开箱结算层按 outcome 另配。
  loot(seed, { attrs, rng }) {
    const { rate, success } = runCheck(seed, attrs, rng);
    if (!success) {
      return {
        log: `${seed.desc}——机关难开，只得悻悻作罢。`,
        effects: [{ type: "check", stat: seed.check, dc: seed.dc, rate, success: false }],
        lootDelta: {},
      };
    }
    const money = 20 + Math.floor(rng() * 30);
    return {
      log: `${seed.desc}——${seed.outcome}，另有碎银${money}两。`,
      effects: [{ type: "check", stat: seed.check, dc: seed.dc, rate, success: true }, { type: "loot_open", outcome: seed.outcome }],
      lootDelta: { money },
    };
  },

  // 观战：旁观 NPC 互斗，可观摩/插手/离开。
  watch(seed) {
    return {
      log: `${seed.desc}——隔着暗处看了一阵。`,
      effects: [],
      lootDelta: {},
      branch: {
        options: [
          { label: "暗中观摩", check: seed.check, dc: seed.dc, effect: { type: "insight", outcome: seed.outcome } },
          { label: "插手其中", check: null, dc: 0, effect: { type: "intervene" } },
          { label: "悄然离开", check: null, dc: 0, effect: { type: "leave" } },
        ],
      },
    };
  },

  // 偶遇：结交检定或避开。
  meet(seed) {
    return {
      log: `${seed.desc}——对方抬眼打量过来。`,
      effects: [],
      lootDelta: {},
      branch: {
        options: [
          { label: "上前结交", check: seed.check, dc: seed.dc, effect: { type: "companion_offer", outcome: seed.outcome } },
          { label: "远远避开", check: null, dc: 0, effect: { type: "leave" } },
        ],
      },
    };
  },

  // 鉴定：检定过了识真伪，没过白花眼力。
  appraise(seed, { attrs, rng }) {
    const { rate, success } = runCheck(seed, attrs, rng);
    return success
      ? {
          log: `${seed.desc}——眼力不差，${seed.outcome}。`,
          effects: [{ type: "check", stat: seed.check, dc: seed.dc, rate, success: true }, { type: "appraise", success: true }],
          lootDelta: {},
        }
      : {
          log: `${seed.desc}——看不出门道，怕是打了眼。`,
          effects: [{ type: "check", stat: seed.check, dc: seed.dc, rate, success: false }, { type: "appraise", success: false }],
          lootDelta: {},
        };
  },

  // 解密：直接挂谜题模板（seed.puzzleType + seed.puzzleConfig），实例交 engine 层驱动。
  puzzle(seed) {
    const puzzle = makePuzzle(seed.puzzleType, seed.puzzleConfig || {});
    return {
      log: `${seed.desc}——${puzzle.prompt || "机关深处另有乾坤。"}`,
      effects: [{ type: "puzzle", instance: puzzle }],
      lootDelta: {},
    };
  },

  // 检查点：中途存档房，无检定。
  checkpoint(seed) {
    return {
      log: `${seed.desc}——${seed.outcome}，在此稍作喘息。`,
      effects: [{ type: "checkpoint" }],
      lootDelta: {},
    };
  },
};

// 入口：kind 为 ROOM_EVENT_KINDS 之一；seed 为该 kind 的 eventSeed 配置。
export function resolveRoomEvent(kind, seed, { attrs = {}, loot = {}, rng = random } = {}) {
  const handler = HANDLERS[kind];
  if (!handler) throw new Error(`未知地宫事件类型: ${kind}`);
  return handler(seed || { desc: "", check: null, dc: 0, outcome: "" }, { attrs, loot, rng });
}
