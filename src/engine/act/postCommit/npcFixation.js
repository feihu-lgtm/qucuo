// ── 在场名单固化：幽灵过滤、战斗数据固化、新面孔/重逢登记（原 commitRound 内嵌块）──
// 路线甲纯函数化：返回 { logs, changes, dWrites } 由 commitRound 统一落盘；
// varTree 改显式入参（原先读 varTreeRef 的值）。
import { isNpcVisibleInInnerRoom } from "../../../domain/rules/map/innerMap.js";
import { detectNewFaces, markAsSeen, updateLastSeen } from "../../../domain/rules/npc/npcAwareness.js";
import { mapDescriptionToGenParams } from "../../../domain/data/npc/npcDescriptionMapping.js";
import { ensureNpcCombatData } from "../../../domain/rules/npc/npcGeneration.js";
import { getAllResidentNpcNames } from "../../../domain/data/npc/residentNpcs.js";
import { getImportedResidentNames } from "../../../domain/rules/cards/importedRegistry.js";
import { COMPANION_SLOTS } from "../../../domain/rules/companion/companionSlots.js";

export function fixateNpcs({ p, room, innerRoomName, narrativeText, varTree, time, systemAcceptedNames, luck }) {
  if (!p.room || !Array.isArray(p.room.npcs)) return null;
  // 幽灵NPC过滤：AI叙事里提到背景人物（"远处狼嚎"）或队友（雪豹跟在身边），
  // 提取层会把这些名字塞进 room.npcs。驻场NPC有固定归属据点，不该在别处被
  // AI凭空刷出来（刷出来还吃 mapDescriptionToGenParams 退化成绿袍）；队友
  // 走 companionState 独立管理，更不该变成 room.npcs 里的一个路人。
  // 入册的驻场角色同样有固定归属，一并纳入幽灵过滤——否则玩家在鱼定村
  // 入册的人，AI 可能在锦官城凭空刷出来一个同名的。
  const _residentNames = new Set([...getAllResidentNpcNames(), ...getImportedResidentNames()]);
  const _companionNames = new Set(COMPANION_SLOTS.map(s => s.label));
  const _currentNames = new Set((room.npcs || []).map(n => n.name));
  p.room.npcs = p.room.npcs.filter(n => {
    if (!n?.name) return false;
    if (_companionNames.has(n.name) || n.name.includes("雪豹")) return false;
    if (_residentNames.has(n.name) && !_currentNames.has(n.name)) return false;
    return true;
  });
  p.room.npcs = p.room.npcs.map(n => {
    const existing = room.npcs.find(o => o.name === n.name);
    if (existing?.carriedItems) {
      return { ...existing, brief: n.brief || existing.brief };
    }
    const { levelCap, personalityProfile } = mapDescriptionToGenParams(`${n.brief || ""} ${narrativeText}`);
    return ensureNpcCombatData({ ...n, personalityProfile }, { luck, levelCap });
  });
  // 把这一轮新固化出来的战斗数据按名字存一份，供后面"原地互动"分支回填。
  // 【为什么需要这一步】上面这段固化写在 p.room.npcs 这个临时对象上；而原地互动
  // （切磋/对话/查看，即没触发移动的绝大多数回合）走的分支是
  // `setRoom(r => ({ ...r, ...p.room, npcs: r.npcs }))`——npcs 取旧的 r.npcs，
  // 于是刚固化的 carriedItems/moveset/combatStats **整个被丢掉**。
  // 后果：AI 生成的路人永远没有 carriedItems，切磋赢了掉落池恒为空、一件都不掉。
  // 只有 residentNpcs 里带显式 carry 的驻场走另一条注入路径，所以玩家的体感是
  // "只有村里那个老猎户爆过东西"。
  // 不能改成信 AI 返回的名单——那是另一个已修 bug 的根因（AI 每轮重新发明在场
  // 人物，"此地的人一会好几个一会都走光"）。所以只回填数据、不动名单。
  const freshNpcData = new Map(p.room.npcs.filter(n => n?.name).map(n => [n.name, n]));

  // 复用 MVU 块之前算好的系统采纳名单（systemAcceptedNames），判据一致：
  // 只认系统真正会放进场的人 + 涌现登场者，AI 凭空多报的幽灵一律不计入。
  // 再叠一层内层房间过滤（isNpcVisibleInInnerRoom）：与左栏「此地之人」、任务栏
  // giver 判定用同一套——否则会出现"老猎户明明绑在猎户小屋，却因为在整个 room.npcs
  // 里就在村口被判成『新人物出现』"的割裂。三处必须同一份可见性判据。
  const acceptedNpcs = p.room.npcs
    .filter(n => systemAcceptedNames.has(n.name))
    .filter(n => isNpcVisibleInInnerRoom(room.name, innerRoomName, n));

  const out = {
    // freshNpcData 是处理器间传值：roomWrite/commitProposalWrites 后续还要读
    dWrites: { freshNpcData },
    changes: { varTree: (prev) => updateLastSeen(prev, acceptedNpcs.map(n => n.name), time) },
  };
  // "新人物出现"检测：只对系统真正采纳、且从未见过的面孔插入这条日志。
  const newFaces = detectNewFaces(varTree, acceptedNpcs);
  if (newFaces.length) {
    out.logs = newFaces.map(n => ({ t: "sys", text: `  ※ 新人物出现：${n.name}（点击可细看其人）` }));
    out.changes.varTree = (prev) => updateLastSeen(markAsSeen(prev, newFaces.map(n => n.name)), acceptedNpcs.map(n => n.name), time);
  }
  // 久别重逢·记忆断层：同样只记系统采纳的在场人物。
  return out;
}
