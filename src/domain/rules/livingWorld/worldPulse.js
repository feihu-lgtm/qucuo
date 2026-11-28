// WO-25E：活世界离线脉冲——游走编队步进/自动冲突/事件扩散/稳态护栏（纯函数内核）。
//
// 节拍（与 worldRules 壳联动，幂等靠 varTree 记账标记兜底，不靠 firstRun skip）：
//   时辰节拍（每 2 格时间）：编队激活/退场 → 沿 route 在 QUCUO_MAP 外层节点走一步
//     → 同节点敌对编队（张力>=70）抽样结算一场 resolveNpcConflict 离线胜负。
//   跨日节拍（每 24 格）：过期据点局势移除 → decayTension 向基线回落 + 势力战力稳态
//     微恢复（防世界三天打死自毁）→ 事件录沿邻接边向外扩散 1 跳（knownDistricts）。
//
// 状态口径（全部 varTree.世界 之下）：
//   编队册    { [squadId]: { node, routeIndex, dir, active } }——离线位置账，绝不烤进 QUCUO_MAP
//   事件录    最近 80 条 WorldEvent { id, day, turn, kind, text, district, knownDistricts }
//   据点局势  { [district]: [{ id, sinceDay, expireDay, sourceEventId }] }（消费归 WO-25F）
//   势力战力  { [faction]: 0-100 }（无记录视为 100，与 evalWorld 口径一致）
//   活世界时辰 / 活世界日结日——节拍幂等标记
//
// 战斗口径：编队成员按 id 从 RESIDENT_NPCS/NPC_POOL 查实并 buildRoomNpcWithCombat 装配，
// 查无实据的编队不参与离线冲突（绝不编造数值）；种子由 time+节点派生，同 seed 可复现。

import { seededRand } from "../../../utils/seededRandom.js";
import { QUCUO_MAP } from "../../data/map/qucuoMap.js";
import { RESIDENT_NPCS } from "../../data/npc/residentNpcs.js";
import { NPC_POOL } from "../../data/npc/npcPool.js";
import { buildRoomNpcWithCombat } from "../npc/rules.js";
import { resolveNpcConflict } from "../conflict/npcAutoBattle.js";
import { adjustTension, decayTension, getTension } from "../conflict/tension.js";
import { evalWhen, evalWorldStates } from "./evalWorld.js";
import { getRngState, setRngState, setSeed } from "../../../utils/rng.js";

export const EVENT_CAP = 80;
export const CONFLICT_TENSION_THRESHOLD = 70;
export const POWER_RECOVER_PER_DAY = 2; // 稳态微恢复：每日向满血 100 回 2 点
export const POWER_BASELINE = 100;
const HOUR_MARK = "活世界时辰";
const DAY_MARK = "活世界日结日";

const CONTENT = [...Object.values(RESIDENT_NPCS).flat(), ...NPC_POOL];

function worldOf(state) {
  return state?.varTree?.世界 || {};
}

// 编队成员 id → 战斗单位（查无实据返回 null，该编队避战）。
// hpBook 是 人物动态.hpRatio 账：带伤编队按现存血量入场——连败会越打越弱，自然退场修整。
function buildSquadSide(squad, hpBook = {}) {
  const members = (squad.members || []).slice(0, 2); // resolveNpcConflict 每方 1-2 人
  if (members.length === 0) return null;
  const side = [];
  for (const memberId of members) {
    const found = CONTENT.find((n) => n.id === memberId);
    if (!found) return null;
    try {
      const built = buildRoomNpcWithCombat(found);
      const ratio = hpBook[built.id ?? memberId]?.hpRatio ?? hpBook[memberId]?.hpRatio;
      if (typeof ratio === "number" && ratio < 1 && built.combatStats?.hp) {
        const [hp, maxHp] = built.combatStats.hp;
        built.combatStats = { ...built.combatStats, hp: [Math.max(1, Math.round(maxHp * ratio)), maxHp] };
      }
      side.push(built);
    } catch {
      return null;
    }
  }
  return side;
}

// 编队平均血量：任一成员 hpRatio 账低于 RETREAT_RATIO 即撤退休整不接战
export const RETREAT_RATIO = 0.35;
function squadFitForBattle(squad, hpBook) {
  const members = (squad.members || []).slice(0, 2);
  for (const memberId of members) {
    // hpRatio 账键是战斗装配后的单位 id（可能带 pool_ 前缀），两种形态都查
    const ratio = hpBook[memberId]?.hpRatio ?? hpBook[`pool_${memberId}`]?.hpRatio;
    if (typeof ratio === "number" && ratio < RETREAT_RATIO) return false;
  }
  return true;
}

function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = (Math.imul(h, 0x01000193)) >>> 0;
  }
  return h;
}

// 时辰节拍：返回 { squadBook, events, powerDelta, tensionDeltas, hpUpdates } 纯数据补丁。
export function stepHourlyBeat(state, registry) {
  const world = worldOf(state);
  const rng = seededRand(state.time || 0, "livingWorld.hourly");
  const activeStates = evalWorldStates(registry, state);
  const book = { ...(world.编队册 || {}) };
  const activeSquads = [];

  for (const squad of registry?.roamingSquads || []) {
    const route = squad.route || [];
    if (route.length < 2) continue;
    const shouldActive = evalWhen(squad.when ?? null, state, { activeStates });
    const prev = book[squad.id];
    if (!shouldActive) {
      if (prev?.active) book[squad.id] = { ...prev, active: false }; // 退场留位置账
      continue;
    }
    // 激活：首激活落在 route 起点；之后沿 route ping-pong 走一步
    let entry = prev && prev.node ? { ...prev, active: true } : { node: route[0], routeIndex: 0, dir: 1, active: true };
    let nextIndex = entry.routeIndex + entry.dir;
    if (nextIndex >= route.length || nextIndex < 0) {
      entry.dir = -entry.dir;
      nextIndex = entry.routeIndex + entry.dir;
    }
    entry = { ...entry, routeIndex: nextIndex, node: route[nextIndex] };
    book[squad.id] = entry;
    activeSquads.push({ squad, entry });
  }

  // 冲突检测：同节点敌对编队张力 >= 70 → 每节拍最多抽样一场（确定性）
  const events = [];
  const hpUpdates = {}; // npcId -> hpRatio
  const powerDelta = {}; // faction -> delta
  const tensionDeltas = []; // [a, b, delta]
  const byNode = new Map();
  for (const item of activeSquads) {
    const list = byNode.get(item.entry.node) || [];
    list.push(item);
    byNode.set(item.entry.node, list);
  }
  const pairs = [];
  for (const [node, list] of [...byNode.entries()].sort()) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const [x, y] = [list[i], list[j]];
        const tension = getTension(world.tension || {}, x.squad.faction, y.squad.faction);
        if (x.squad.faction && y.squad.faction && x.squad.faction !== y.squad.faction && tension >= CONFLICT_TENSION_THRESHOLD) {
          pairs.push({ node, x, y, tension });
        }
      }
    }
  }
  const hpBook = world.人物动态 || {};
  const fitPairs = pairs.filter(({ x, y }) => squadFitForBattle(x.squad, hpBook) && squadFitForBattle(y.squad, hpBook));
  if (fitPairs.length > 0) {
    const pick = fitPairs[Math.floor(rng() * fitPairs.length)]; // 抽样一场， seeded 可复现
    const seed = (Math.floor(state.time || 0) * 1000003 + hashStr(`${pick.node}|${pick.x.squad.id}|${pick.y.squad.id}`)) >>> 0;
    // 构建+战斗全程固定 seeded：utils/rng 是进程全局态，不固定则同 seed 两遍结果漂移
    const rngSave = getRngState();
    setSeed(seed);
    let sideA = null;
    let sideB = null;
    let result = null;
    try {
      sideA = buildSquadSide(pick.x.squad, hpBook);
      sideB = buildSquadSide(pick.y.squad, hpBook);
      if (sideA && sideB) result = resolveNpcConflict({ sideA, sideB, seed, lethal: "none" });
    } finally {
      setRngState(rngSave);
    }
    if (sideA && sideB && result) {
      const loser = result.winner === "A" ? pick.y : result.winner === "B" ? pick.x : null;
      const winner = result.winner === "A" ? pick.x : result.winner === "B" ? pick.y : null;
      // 战果记账：成员 hpRatio 写 人物动态、势力战力增减、事件录入册
      for (const [npcId, [hp, maxHp]] of Object.entries(result.finalHp || {})) {
        hpUpdates[npcId] = maxHp > 0 ? hp / maxHp : 0;
      }
      if (loser && winner) {
        powerDelta[loser.squad.faction] = (powerDelta[loser.squad.faction] || 0) - (loser.squad.onDefeated?.boostPower ? 0 : 4);
        powerDelta[winner.squad.faction] = (powerDelta[winner.squad.faction] || 0) + 2;
        if (loser.squad.onDefeated?.tensionDelta) {
          tensionDeltas.push([loser.squad.faction, winner.squad.faction, loser.squad.onDefeated.tensionDelta]);
        }
      }
      const day = Math.floor((state.time || 0) / 24);
      events.push({
        id: `wev_${Math.floor(state.time || 0)}_${pick.x.squad.id}_${pick.y.squad.id}`,
        day, turn: state.time || 0, kind: "编队冲突",
        text: `${pick.node}一带，${pick.x.squad.name || pick.x.squad.id}与${pick.y.squad.name || pick.y.squad.id}遭遇交手，${winner ? `${winner.squad.name || winner.squad.id}占了上风` : "两败俱伤各自退去"}。`,
        district: pick.node,
        knownDistricts: [pick.node],
        loserSquad: loser?.squad.id || null,
        winnerSquad: winner?.squad.id || null,
        addTargetSituation: loser?.squad.onDefeated?.addTargetSituation || null,
      });
    }
  }
  return { squadBook: book, events, hpUpdates, powerDelta, tensionDeltas };
}

// 跨日节拍：过期局势移除/张力回落/战力稳态恢复/事件扩散 1 跳。
export function stepDailyBeat(state, registry) {
  const world = worldOf(state);
  const day = Math.floor((state.time || 0) / 24);
  const situations = registry?.situations || [];
  const sitById = new Map(situations.map((s) => [s.id, s]));

  // 过期据点局势移除
  const boards = {};
  for (const [district, cards] of Object.entries(world.据点局势 || {})) {
    const alive = (cards || []).filter((c) => !(Number.isFinite(c.expireDay) && day > c.expireDay));
    if (alive.length > 0) boards[district] = alive;
  }

  // 张力回落 + 势力战力稳态微恢复（向 100 回 POWER_RECOVER_PER_DAY 点，不越过）
  const tension = decayTension(world.tension || {}, 1);
  const power = { ...(world.势力战力 || {}) };
  for (const [faction, value] of Object.entries(power)) {
    if (value < POWER_BASELINE) power[faction] = Math.min(POWER_BASELINE, value + POWER_RECOVER_PER_DAY);
    if (power[faction] >= POWER_BASELINE) delete power[faction]; // 满血不落账
  }

  // 事件录沿 QUCUO_MAP 邻接边扩散 1 跳
  const events = (world.事件录 || []).map((ev) => {
    const known = new Set(ev.knownDistricts || []);
    const before = known.size;
    for (const d of [...known]) {
      for (const next of Object.values(QUCUO_MAP[d]?.exits || {})) known.add(next);
    }
    return known.size === before ? ev : { ...ev, knownDistricts: [...known] };
  });

  return { boards, tension, power, events, sitById };
}

// 单拍内核：只结算 pseudo.time 所在的当前时辰桶/日（幂等由节拍标记兜底）。
function stepSingleBeat(state, registry) {
  const time = Math.floor(state?.time || 0);
  const hourBucket = Math.floor(time / 2);
  const day = Math.floor(time / 24);
  const world = worldOf(state);
  const doHourly = !(Number.isFinite(world[HOUR_MARK]) && world[HOUR_MARK] >= hourBucket);
  const doDaily = !(Number.isFinite(world[DAY_MARK]) && world[DAY_MARK] >= day);
  if (!doHourly && !doDaily) return null;

  const hourly = doHourly ? stepHourlyBeat(state, registry) : null;
  const daily = doDaily ? stepDailyBeat(state, registry) : null;

  return {
    changes: {
      varTree: (prev) => {
        const pw = prev?.世界 || {};
        const w = { ...pw };
        // 先时辰节拍：编队步进 + 冲突战果落账
        if (hourly) {
          w.编队册 = hourly.squadBook;
          if (Object.keys(hourly.hpUpdates).length > 0) {
            const dyn = { ...(w.人物动态 || {}) };
            for (const [npcId, ratio] of Object.entries(hourly.hpUpdates)) {
              dyn[npcId] = { ...(dyn[npcId] || {}), hpRatio: ratio };
            }
            w.人物动态 = dyn;
          }
          if (Object.keys(hourly.powerDelta).length > 0) {
            const power = { ...(w.势力战力 || {}) };
            for (const [faction, delta] of Object.entries(hourly.powerDelta)) {
              const cur = power[faction] ?? POWER_BASELINE;
              const nextVal = Math.max(0, Math.min(POWER_BASELINE, cur + delta));
              if (nextVal >= POWER_BASELINE) delete power[faction];
              else power[faction] = nextVal;
            }
            w.势力战力 = power;
          }
          let tension = w.tension || {};
          for (const [a, b, delta] of hourly.tensionDeltas) {
            tension = adjustTension(tension, a, b, delta);
          }
          w.tension = tension;
          if (hourly.events.length > 0) {
            const prevEvents = Array.isArray(w.事件录) ? w.事件录 : [];
            const ids = new Set(prevEvents.map((e) => e?.id));
            const fresh = hourly.events.filter((e) => !ids.has(e.id));
            w.事件录 = [...prevEvents, ...fresh].slice(-EVENT_CAP);
            const boards = { ...(w.据点局势 || {}) };
            for (const ev of fresh) {
              if (!ev.addTargetSituation) continue;
              const sit = registry?.situations?.find((x) => x.id === ev.addTargetSituation);
              if (!sit) continue;
              const cards = [...(boards[ev.district] || [])];
              if (!cards.some((c) => c.id === sit.id)) {
                cards.push({ id: sit.id, sinceDay: ev.day, expireDay: ev.day + (sit.durationDays || 3), sourceEventId: ev.id });
                boards[ev.district] = cards;
              }
            }
            w.据点局势 = boards;
          }
          w[HOUR_MARK] = hourBucket;
        }
        // 后跨日节拍：在时辰战果之上做回落/恢复/扩散/过期清理
        if (daily) {
          const boards = {};
          for (const [district, cards] of Object.entries(w.据点局势 || {})) {
            const alive = (cards || []).filter((c) => !(Number.isFinite(c.expireDay) && day > c.expireDay));
            if (alive.length > 0) boards[district] = alive;
          }
          w.据点局势 = boards;
          w.tension = decayTension(w.tension || {}, 1);
          const power = {};
          for (const [faction, value] of Object.entries(w.势力战力 || {})) {
            const recovered = value < POWER_BASELINE ? Math.min(POWER_BASELINE, value + POWER_RECOVER_PER_DAY) : value;
            if (recovered < POWER_BASELINE) power[faction] = recovered;
          }
          w.势力战力 = power;
          w.事件录 = (w.事件录 || []).map((ev) => {
            const known = new Set(ev.knownDistricts || []);
            for (const d of [...known]) {
              for (const next of Object.values(QUCUO_MAP[d]?.exits || {})) known.add(next);
            }
            return { ...ev, knownDistricts: [...known] };
          });
          // 伤员稳态恢复：hpRatio 每日向满血回 0.2，回满即销账（防世界三天打死自毁的另一半）
          if (w.人物动态) {
            const dyn = {};
            for (const [npcId, rec] of Object.entries(w.人物动态)) {
              if (typeof rec?.hpRatio === "number" && rec.hpRatio < 1) {
                const recovered = Math.min(1, rec.hpRatio + 0.2);
                if (recovered < 1) dyn[npcId] = { ...rec, hpRatio: recovered };
                else if (rec.status) dyn[npcId] = { ...rec, hpRatio: 1 };
              } else {
                dyn[npcId] = rec;
              }
            }
            w.人物动态 = dyn;
          }
          w[DAY_MARK] = day;
        }
        return { ...(prev || {}), 世界: w };
      },
    },
    logs: [], // 离线推演静默落账，不刷屏（可读性出口归 WO-25F 投影）
  };
}

// 追赶窗口上限：防病态跳时（如读档跨月） churn 过久，超过则只追最近窗口
export const CATCHUP_CAP_BUCKETS = 240; // 240 时辰桶 = 20 天

// 主入口：按节拍推进。跳时（客栈住宿一跳 23 格等）逐桶追赶——中间的编队步进、
// 冲突与跨日结算一拍不吞。首跑无标记时只结当前拍（firstRun 不补罚原则）。
// 返回 applyResult 兼容 result 或 null。
export function stepLivingWorld(state, registry) {
  const time = Math.floor(state?.time || 0);
  const hourBucket = Math.floor(time / 2);
  const world = worldOf(state);
  const hasMark = Number.isFinite(world[HOUR_MARK]);
  const lastHour = hasMark ? world[HOUR_MARK] : hourBucket - 1;
  if (lastHour >= hourBucket) return null;
  const from = Math.max(lastHour + 1, hourBucket - CATCHUP_CAP_BUCKETS + 1);
  let work = state;
  let stepped = false;
  for (let h = from; h <= hourBucket; h += 1) {
    const pseudo = { ...work, time: h * 2 + 1 };
    const single = stepSingleBeat(pseudo, registry);
    if (single) {
      work = { ...pseudo, varTree: single.changes.varTree(pseudo.varTree) };
      stepped = true;
    }
  }
  if (!stepped) return null;
  const finalWorld = work.varTree?.世界 || {};
  return {
    changes: {
      // 只覆盖本模块写过的 世界 子键——同拍其他世界规则写入的键不遭殃
      varTree: (prev) => ({
        ...(prev || {}),
        世界: { ...(prev?.世界 || {}), ...finalWorld },
      }),
    },
    logs: [], // 离线推演静默落账，不刷屏（可读性出口归 WO-25F 投影）
  };
}

// 世界规则壳：deps 按时辰桶+日桶。幂等由节拍标记兜底——不靠 firstRun skip
//（读档当日未结也应补上，脉冲不是惩罚性结算）。
export const livingWorldPulseRule = {
  id: "livingWorld.pulse",
  deps: (state) => [Math.floor((state.time || 0) / 2), Math.floor((state.time || 0) / 24)],
  run(state, ctx = {}) {
    const registry = ctx.livingWorldRegistry;
    if (!registry) return null;
    return stepLivingWorld(state, registry);
  },
};
