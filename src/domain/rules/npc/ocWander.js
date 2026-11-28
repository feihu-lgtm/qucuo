// OC 冒险者跨据点游走（世界规则 npc.ocWander）——驻足锁与范围游走（大肥鱼跑路案）
// ============================================================================
// 【为什么要有这个文件】
// 旧制：OC 冒险者每天按日种子全图重掷落点（getWorldAdventurers/ocWanderersAt），
// 子夜一过人在玩家眼前凭空蒸发，没有离场叙事、没交代去向（鱼丽 t260 还在鱼定土司，
// 日签一换就没了）。用户钦定：「所有人，如果是游走的，那就随机走来走去，自己有自己
// 的范围，或者冒险者纯随机/有特定喜好，但总归一点，在和自己在一个内层房间的时候是固定的」。
//
// 【规则】
//   1. 每个无固定落脚据点（homeDistrict）的 OC 冒险者有一本持久位置册：
//      varTree.世界.游走册[name] = { at: 据点, inner: 内层房间|null, since: time }。
//      落盘后不再按日重掷——子夜更替不会让人蒸发。
//   2. 范围游走：势力就近的在自己的派系据点集合内走动（鱼丽→鱼定土司府权重落点），
//      无处落脚的散人纯随机全图走；wanderPrefs.districts 数据字段可显式钦定范围。
//      喜好偏向：档案带吃喝性情的（嘴馋/爱酒）偏向有饭馆酒楼茶棚的据点，权重 ×3。
//   3. 移动：每个时辰刻每人 5% 概率动身，seeded 可复现；目的地在范围内加权抽，
//      到达后在内层公共房间落座（一并落盘）。
//   4. 铁律钉死：与玩家在同一内层房间（无内层地图的据点=同据点）时绝不动身；
//      驻足锁（W-ROAM 十回合交互锁）未过期同样不动。
//   5. 离场/到场叙事：离开或进入玩家所在据点时上公屏短句并交代去向
//      （「XX收拾行囊，往『雅江』去了。」）。
//   6. 玩家视野内的房内位置以 room.npcs 实际为准回写册子——npc.roam 在据点内
//      挪过的人，册子跟着走，钉死判定才不会拿旧座次误事。
//   7. 日抛 randomPasser 合成龙套不受此限——他们本来就是过客（用户原话豁免）。

import { ADVENTURER_POOL } from "../../data/dungeon/adventurers.js";
import { ADVENTURER_POOL_IP } from "../../data/dungeon/adventurersIP.js";
import { NODE_PASSERS, ocNearFaction } from "../../data/npc/randomPassers.js";
import { getAllResidentNpcNames } from "../../data/npc/residentNpcs.js";
import { QUCUO_MAP } from "../../data/map/qucuoMap.js";
import { getBuildingsForLocation } from "../../data/buildings/qucuoBuildings.js";
import { getDistrictAnchor, getPublicInnerRoomNames, hasInnerMap } from "../map/innerMap.js";
import { isCompanionUnlockedByName } from "../companion/companion.js";
import { seededRand } from "../../../utils/seededRandom.js";

const EXCLUDED_DISTRICTS = new Set(["心灵之海", "第三新东京市", "白塔", "山洞", "顶峰"]);

// 每个时辰刻每名游走 OC 动身跨据点的概率：均值约二十个时辰挪一次窝
export const OC_MOVE_CHANCE = 0.05;

// 吃喝性情的档案识别：这类人对有饭馆酒楼茶棚的据点格外偏爱
const FOODIE_RE = /吃|馋|酒|饭|肉|饕|食/;
const EATERY_RE = /楼|客栈|食|酒|茶|饭|厨|锅庄/;

// 全部游走 OC：两池合册，有固定落脚据点（homeDistrict）的不在游走之列；
// 挂名常驻身份的（姬无双/樊未离——驻场表里的永久居民）也不是游走者，
// 否则驻所之外还会刷出第二个游走身（Review 实证：姬无双在大草甸分身）。
const RESIDENT_NAMES = new Set(getAllResidentNpcNames());
export const WANDERING_OCS = Object.freeze(
  [...ADVENTURER_POOL, ...ADVENTURER_POOL_IP].filter((adv) => !adv.homeDistrict && !RESIDENT_NAMES.has(adv.name)),
);

const ACTIVE_DISTRICTS = Object.freeze(
  Object.keys(QUCUO_MAP).filter((name) => !EXCLUDED_DISTRICTS.has(name) && NODE_PASSERS[name]),
);

// 据点有没有吃喝落脚处（饭馆/酒楼/茶棚/客栈）
function districtHasEatery(district) {
  return (getBuildingsForLocation(district) || []).some((b) => EATERY_RE.test(b?.name || b?.label || ""));
}

// 这名冒险者的活动范围（据点集合）：派系就近落点，无处落脚的纯随机全图
export function wanderRangeOf(adv) {
  if (Array.isArray(adv?.wanderPrefs?.districts) && adv.wanderPrefs.districts.length) {
    const chosen = adv.wanderPrefs.districts.filter((d) => ACTIVE_DISTRICTS.includes(d));
    if (chosen.length) return chosen;
  }
  const near = ocNearFaction(adv);
  const ranged = ACTIVE_DISTRICTS.filter((d) => NODE_PASSERS[d].factions.some(([f]) => f === near));
  return ranged.length ? ranged : [...ACTIVE_DISTRICTS];
}

// 目的地权重：吃货偏爱有吃喝处的据点（×3），其余一律平等
export function wanderWeightOf(adv, district) {
  const foodie = FOODIE_RE.test(`${adv?.brief || ""} ${adv?.personality || ""}`);
  if (foodie && districtHasEatery(district)) return 3;
  return 1;
}

// 在据点内层公共房间里挑一间落座；无内层地图的据点返回 null（外层活动）
export function pickInnerRoomFor(district, rng) {
  if (!hasInnerMap(district)) return null;
  const rooms = getPublicInnerRoomNames(district);
  if (!rooms.length) return null;
  return rooms[Math.floor(rng() * rooms.length) % rooms.length];
}

// 有效位置册 = 持久册 ∪ 种子兜底初始化（没落盘的人按旧日种子口径给一个确定起点，
// 与存档新旧无关——新存档第一拍世界规则就会把这些起点正式落盘）。
export function positionsWithFallback(registry, time = 0) {
  const out = {};
  for (const adv of WANDERING_OCS) {
    const saved = registry?.[adv.name];
    if (saved?.at) {
      out[adv.name] = saved;
      continue;
    }
    // 起点就在自己的活动范围内加权抽（吃货偏爱吃喝处）——不在范围的乱点开局
    // 与「各人有自己的范围」相悖，旧日种子全图乱掷口径一并废止。
    // 种子零号恒定：兜底位置与时间无关，没落盘前也不会因子夜改主意。
    const rng = seededRand(0, `world_adv_${adv.id}`);
    const range = wanderRangeOf(adv);
    const weights = range.map((d) => wanderWeightOf(adv, d));
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = rng() * total;
    let at = range[range.length - 1];
    for (let i = 0; i < range.length; i++) {
      roll -= weights[i];
      if (roll < 0) { at = range[i]; break; }
    }
    const innerRng = seededRand(0, `ocWanderInner|${adv.name}|${at}`);
    out[adv.name] = { at, inner: pickInnerRoomFor(at, innerRng), since: 0 };
  }
  return out;
}

// 加权抽一个目的地（排除当前所在据点；范围只剩一处时不挪窝）
function pickDestination(adv, fromAt, rng) {
  const range = wanderRangeOf(adv).filter((d) => d !== fromAt);
  if (!range.length) return null;
  const weights = range.map((d) => wanderWeightOf(adv, d));
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < range.length; i++) {
    r -= weights[i];
    if (r < 0) return range[i];
  }
  return range[range.length - 1];
}

export const ocWanderRule = {
  id: "npc.ocWander",
  deps: (state) => [state.time],
  run(state, { companionState = state.companionState, roomMap = {}, firstRun, previousDeps }) {
    const { time, room } = state;
    if (firstRun || time == null) return null;
    if (Object.is(time, previousDeps?.[0])) return null;

    const district = room?.name;
    const playerSpot = state.innerRoomName || (district ? getDistrictAnchor(district) : null);
    const locks = state.varTree?.世界?.驻足锁 || {};
    const registry = state.varTree?.世界?.游走册 || {};
    const positions = positionsWithFallback(registry, time);
    const presentByName = new Map((room?.npcs || []).map((npc) => [npc.name, npc]));

    const next = {};
    const logs = [];
    let changed = false;

    for (const adv of WANDERING_OCS) {
      let entry = positions[adv.name];

      // 玩家在册者若被 npc.roam 在据点内挪过房，以实际房间回写册子
      const present = presentByName.get(adv.name);
      if (present && entry.at === district && (present.innerRoom || null) !== (entry.inner || null)) {
        entry = { ...entry, inner: present.innerRoom || null };
        changed = true;
      }
      // 随身物快照入册：偷/卖/扔痕迹随人走——Reviewer 实证挪窝后新据点重建副本
      // 装备重置，同一件固定物能被重复扒。快照来源优先在场活副本，其次原地缓存。
      const carrier = present || (roomMap?.[entry.at]?.npcs || []).find((npc) => npc?.name === adv.name);
      if (carrier?.carriedItems?.length) {
        const snapshot = carrier.carriedItems.map((item) => ({ ...item }));
        if (JSON.stringify(snapshot) !== JSON.stringify(entry.carrySnapshot || null)) {
          entry = { ...entry, carrySnapshot: snapshot };
          changed = true;
        }
      }
      // 没落盘过的起点正式落盘
      if (!registry[adv.name]?.at) changed = true;

      // 钉死判定：驻足锁未过期，或与玩家同据点同场景（内层房间一致；
      // 无内层地图的据点同房即同据点）。入队/留守同伴冻结，不再满世界跑。
      const sceneOf = (e) => (e.at === district ? (e.inner || getDistrictAnchor(e.at) || null) : null);
      const pinnedByPlayer = Boolean(district) && entry.at === district && sceneOf(entry) === playerSpot;
      const pinnedByLock = (locks[adv.name] ?? -1) > time;
      const frozen = isCompanionUnlockedByName(companionState, adv.name);

      if (!pinnedByPlayer && !pinnedByLock && !frozen) {
        const rng = seededRand(time, `ocWanderStep|${adv.name}`);
        if (rng() < OC_MOVE_CHANCE) {
          const dest = pickDestination(adv, entry.at, rng);
          if (dest) {
            const wasHere = entry.at === district;
            const innerRng = seededRand(time, `ocWanderInner|${adv.name}`);
            const inner = pickInnerRoomFor(dest, innerRng);
            if (wasHere) {
              logs.push({ t: "sys", text: `  ${adv.name}收拾行囊，往「${dest}」去了。` });
            } else if (dest === district) {
              logs.push({ t: "sys", text: `  ${adv.name}打外乡远路而来，在此地落脚。` });
            }
            entry = { at: dest, inner, since: time };
            changed = true;
          }
        }
      }
      next[adv.name] = entry;
    }

    // 册子瘦身：池子里已经没有的名字（改名/下架）不留在账上
    for (const name of Object.keys(registry)) {
      if (!WANDERING_OCS.some((adv) => adv.name === name)) changed = true;
    }

    if (!changed) return null;
    return {
      changes: {
        varTree: (prev) => ({
          ...prev,
          世界: { ...(prev?.世界 || {}), 游走册: next },
        }),
      },
      ...(logs.length ? { logs } : {}),
    };
  },
};
