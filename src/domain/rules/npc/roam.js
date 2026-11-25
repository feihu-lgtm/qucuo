// 游走 NPC 的据点内走动（世界规则 npc.roam）
// ============================================================================
// 【为什么要有这个文件】
// 以前 NPC 的内层落点只在注入那一刻由"当天种子随机"一次性抽定（residentNpcRule），之后不再动；
// 按时段表走的人（兰姐：白天赌石坊、入夜回百花楼）更是只在注入时看一眼钟点。
// 玩家看到的是：人要么永远钉在原地，要么换天后"凭空出现在别处"——没有走过去的过程。
//
// 【规则】
//   1. 每个时间刻（state.time 变一次）每个会走动的人最多走**一步**，且只沿当前房间真实存在的
//      出口（INNER_MAP 的 exits）走到相邻房间——不跨房、不瞬移。
//   2. 有目的地（时段表给的落点）就沿最短路走，N 步远要 N 个刻；没目的地就以 ROAM_CHANCE 的
//      概率随机挑一个相邻出口晃过去。随机用 seededRand(time, …)，同一刻同一据点结果可复现。
//   3. 每一步都写一行公屏 sys 日志（一人一行），走 changes.room 的同一次 tick 提交。
//   4. 不动的人：驻场（房间绑定 / 驻场表 / 导入驻场）、入队与留守的伙伴、被追到某间屋的人
//      （pursuitInnerRoom）、护镖收货人、锁定内层房间的竞价者、敌对者、AI 临场生成的人。
//      不具名的人群（room.crowd）只有标签、不在 npcs 里，天然不参与，也不写日志。
//   5. 刚进据点的那一刻不走（room.name 变了）：先让玩家看到他们"原本在哪"。
//   6. 只模拟玩家所在据点：别的据点的人没有实时状态，进门时由 npc.residents 按当天名单摆放。

import { getDistrictAnchor, getInnerRoom, getPublicInnerRoomNames, getResidentRoomForNpc, hasInnerMap } from "../map/innerMap.js";
import { isCompanionUnlockedByName, unlockedCompanions } from "../companion/companion.js";
import { NPC_POOL } from "../../data/npc/npcPool.js";
import { getResidentNpcs } from "../../data/npc/residentNpcs.js";
import { ESCORT_QUESTS } from "../../data/quests/escortQuests.js";
import { questPlaceDistrict } from "../quests/questPlace.js";
import { seededRand } from "../../../utils/seededRandom.js";
import { DIRS } from "../../../utils/mudHelpers.js";

// 没有目的地的游走者每刻动身的概率。
export const ROAM_CHANCE = 0.25;

// 房间的真实出口：只留目的地确实是该据点内层房间的那几条。
function exitsOf(district, roomName) {
  return Object.entries(getInnerRoom(district, roomName)?.exits || {})
    .filter(([, to]) => getInnerRoom(district, to));
}

// 沿出口图从 from 往 to 走的**第一步**（广度优先 = 最短路）。
// passable：中途允许踏入的房间集合；终点不受限（目的地本身可以是不对外开放的房间）。
// 返回 { dir, to }；已在原地或无路可走返回 null。
export function stepToward(district, from, to, passable) {
  if (!from || !to || from === to) return null;
  const via = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const [dir, next] of exitsOf(district, cur)) {
      if (via.has(next) || (next !== to && !passable.has(next))) continue;
      via.set(next, { cur, dir });
      if (next === to) {
        let node = to;
        let step = null;
        while (via.get(node)) {
          step = { dir: via.get(node).dir, to: node };
          node = via.get(node).cur;
        }
        return step;
      }
      queue.push(next);
    }
  }
  return null;
}

// 随机晃一步：从相邻出口里挑一个允许踏入的。rng 是 0-1 随机函数。
export function randomStep(district, from, passable, rng) {
  const options = exitsOf(district, from).filter(([, to]) => passable.has(to));
  if (!options.length) return null;
  const [dir, to] = options[Math.floor(rng() * options.length)];
  return { dir, to };
}

// 公屏上写的那一行。玩家所在房间的进出换一种说法，其余统一"从A往X去了B"。
export function describeNpcMove(name, from, step, playerRoom) {
  const dir = DIRS[step.dir] || step.dir;
  if (playerRoom && from === playerRoom) return `  ${name}离开此处，往${dir}去了「${step.to}」。`;
  if (playerRoom && step.to === playerRoom) return `  ${name}从「${from}」走了进来。`;
  return `  ${name}从「${from}」往${dir}去了「${step.to}」。`;
}

// 时段表给的此刻落点：undefined = 此刻此地没安排（不动）。
function scheduledSpot(poolEntry, district, hour) {
  const seg = poolEntry.schedule.find((s) => hour >= s.slot[0] && hour < s.slot[1]);
  return seg?.weights?.[district] ? seg.lockInnerRoom : undefined;
}

export const npcRoamRule = {
  id: "npc.roam",
  deps: (state) => [state.time, state.room?.name],
  run(state, { importedRegistry, companionState = state.companionState, firstRun, previousDeps }) {
    const { room, time, flags = [], questProgress = {} } = state;
    if (firstRun || !room?.name || !hasInnerMap(room.name)) return null;
    // 只在时间往前走、且玩家没换据点的那一刻动
    if (Object.is(time, previousDeps?.[0]) || room.name !== previousDeps?.[1]) return null;

    const district = room.name;
    const anchor = getDistrictAnchor(district);
    const hour = ((time % 24) + 24) % 24;
    const passable = new Set(getPublicInnerRoomNames(district));
    const residentNames = new Set([
      ...getResidentNpcs(district).map((npc) => npc.name),
      ...(importedRegistry?.getImportedResidentNames?.() || []),
    ]);
    const partyNames = new Set(unlockedCompanions(companionState).map((c) => c.label));
    const escortTargets = new Set(ESCORT_QUESTS
      .filter((q) => questProgress[q.id]?.active && questPlaceDistrict(q.targetLocation) === district && !flags.includes(`quest_done_${q.id}`))
      .map((q) => q.targetNpc));

    const updates = new Map(); // name → { from, to?, schedule? }
    const logs = [];
    for (const npc of room.npcs || []) {
      if (!npc?.name || npc.companion || npc.stationed || npc.hostile) continue;
      if (partyNames.has(npc.name) || isCompanionUnlockedByName(companionState, npc.name)) continue;
      if (typeof npc.pursuitInnerRoom === "string") continue;
      // 只有"游走身份"的人才走：游走池、过路人、冒险者、导入角色卡
      if (!(npc.isPoolNpc || npc.randomPasser != null || npc.adventurerDay != null || npc.imported)) continue;
      if (residentNames.has(npc.name) || escortTargets.has(npc.name)) continue;

      const poolEntry = npc.isPoolNpc ? NPC_POOL.find((p) => p.name === npc.name) : null;
      const scheduled = Array.isArray(poolEntry?.schedule);
      // 房间绑定的家 = 驻场；唯独按时段表走的人（兰姐）家只是夜里的落点
      if (!scheduled && getResidentRoomForNpc(district, npc.name)) continue;

      const from = npc.innerRoom || anchor;
      let step = null;
      if (scheduled) {
        const spot = scheduledSpot(poolEntry, district, hour);
        if (spot) step = stepToward(district, from, spot, passable);
      } else if (!npc.lockInnerRoom) {
        const rng = seededRand(Math.floor(time), `roam|${district}|${npc.name}`);
        if (rng() < ROAM_CHANCE) step = randomStep(district, from, passable, rng);
      }
      // 老存档里的兰姐没带 schedule：补上，innerMap 的可见性判定认这个字段
      const needStamp = scheduled && !Array.isArray(npc.schedule);
      if (!step && !needStamp) continue;
      updates.set(npc.name, { raw: npc.innerRoom ?? null, ...(step ? { to: step.to } : {}), ...(needStamp ? { schedule: poolEntry.schedule } : {}) });
      if (step) logs.push({ t: "sys", text: describeNpcMove(npc.name, from, step, state.innerRoomName) });
    }
    if (!updates.size) return null;

    return {
      changes: {
        room: (previous) => ({
          ...previous,
          npcs: (previous.npcs || []).map((npc) => {
            const u = updates.get(npc.name);
            // 这一刻到提交之间人若已被别处改走（被追、被叫走），不覆盖
            if (!u || (npc.innerRoom ?? null) !== u.raw) return npc;
            return { ...npc, ...(u.to ? { innerRoom: u.to } : {}), ...(u.schedule ? { schedule: u.schedule } : {}) };
          }),
        }),
      },
      ...(logs.length ? { logs } : {}),
    };
  },
};
