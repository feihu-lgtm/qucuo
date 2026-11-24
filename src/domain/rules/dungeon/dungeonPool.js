// OC 入宫挂接（设计_地宫内层地图.md §A-2「OC 冒险者三种身份」）
// 游荡同房触发 snatch 25-35% / 守死路宝箱 / 藏隐藏房可雇佣，
// 按各宫 adventurerFactions 加权抽池，seeded 可重放；纯函数无 IO。

import { DUNGEON_DISTRICTS_ALL } from "../../data/dungeon/districts.js";
import { ADVENTURER_POOL } from "../../data/dungeon/adventurers.js";
import { ADVENTURER_POOL_IP } from "../../data/dungeon/adventurersIP.js";
import { seededRand } from "../../../utils/seededRandom.js";

const FULL_POOL = [...ADVENTURER_POOL, ...ADVENTURER_POOL_IP];

// 双向包含匹配：district 写"天山"，池子写"天山派"也算命中
const factionHit = (adv, factions) =>
  factions.some((f) => adv.faction.includes(f) || f.includes(adv.faction));

// 身份 roll 权重：游荡 50% / 守宝 30% / 隐藏房雇佣 20%
const rollIdentity = (r) => (r < 0.5 ? "roamer" : r < 0.8 ? "treasureGuard" : "hiddenHireable");

// 身份 → 落位房间要求（由生成器消费：treasureGuard 进 isTreasure 房并写
// residentNpcName；hiddenHireable 进 unlockCondition 隐藏房）
const ROOM_ROLE = {
  roamer: "any",
  treasureGuard: "isTreasure",
  hiddenHireable: "hidden",
};

/**
 * 按宫抽 n 名冒险者挂身份。
 * @param {string} districtKey DUNGEON_DISTRICTS_ALL 键
 * @param {number} n 抽取人数
 * @param {() => number} rng 外部传入的 seeded rng（如 seededRand 返回值）
 * @returns {Array<{adventurer, identity, roomRole}>} 不重复
 */
export function pickDungeonAdventurers(districtKey, n, rng) {
  const factions = DUNGEON_DISTRICTS_ALL[districtKey]?.adventurerFactions || [];
  const weighted = FULL_POOL.map((adv) => ({ adv, w: factionHit(adv, factions) ? 3 : 1 }));
  const picked = [];
  const pool = weighted.slice();
  while (picked.length < n && pool.length) {
    const total = pool.reduce((s, x) => s + x.w, 0);
    let roll = rng() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) { roll -= pool[idx].w; if (roll <= 0) break; }
    idx = Math.min(idx, pool.length - 1);
    const adv = pool.splice(idx, 1)[0].adv;
    const identity = rollIdentity(rng());
    picked.push({ adventurer: adv, identity, roomRole: ROOM_ROLE[identity] });
  }
  return picked;
}

/**
 * 生成一次遭遇的确定性骨架（narrative 留白给 AI 润色）。
 * @returns {{npcRef, triggerLines, options: Array<{label,check,dc,effect}>}}
 */
export function genAdventurerEncounter(adventurer, identity, seed) {
  const rng = seededRand(0, `advEnc|${seed}|${adventurer.id}|${identity}`);
  const base = { npcRef: adventurer.id };
  if (identity === "roamer") {
    const snatch = 0.25 + Math.floor(rng() * 11) / 100; // 25-35%
    return {
      ...base,
      triggerLines: [`${adventurer.name}抱着兵刃斜倚在门洞里，目光在你行囊上打了个转。`],
      options: [
        { label: "拔刀相向", check: null, dc: null, effect: { battle: true } },
        { label: "拱手让路，快步离开", check: "身法", dc: 45, effect: { snatch } },
        { label: "主动搭话攀交情", check: "口才", dc: 55, effect: { snatch: 0, affinity: 5 } },
      ],
    };
  }
  if (identity === "treasureGuard") {
    return {
      ...base,
      triggerLines: [`${adventurer.name}横刀守在一口描金匣前，听见脚步声头也不回。`],
      options: [
        { label: "亮兵刃硬夺宝匣", check: null, dc: null, effect: { battle: true, treasure: true } },
        { label: "屏息绕到侧后偷袭", check: "隐蔽", dc: 55, effect: { firstStrike: true } },
        { label: "不作无谓之争，退走", check: null, dc: null, effect: { retreat: true } },
      ],
    };
  }
  // hiddenHireable：藏隐藏房，unlockCondition 满足才现身；招募走对话层
  return {
    ...base,
    triggerLines: [`阴影里先传来一声轻笑，${adventurer.name}抱着包袱从暗格后探出身来。`],
    options: [
      { label: "以江湖规矩相邀同行", check: "口才", dc: 55, effect: { recruitHook: true } },
      { label: "话不投机先下手为强", check: null, dc: null, effect: { battle: true } },
      { label: "点头致意，各走各路", check: null, dc: null, effect: { farewell: true } },
    ],
  };
}
