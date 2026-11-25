// ── NPC 涌现·第二阶段：传闻人物实体化（原 commitRound 内嵌块）──
// 路线甲纯函数化：返回 { changes: { varTree, room } } 由 commitRound 统一落盘。
import { mapDescriptionToGenParams } from "../../../domain/data/npc/npcDescriptionMapping.js";
import { ensureNpcCombatData } from "../../../domain/rules/npc/npcGeneration.js";
import { npcTradeOf } from "../../../domain/rules/npc/npcTrade.js";
import { materializeNpc } from "../../../domain/rules/npc/roomNpcs.js";
import { clearRumor } from "../../../domain/rules/npc/npcEmergence.js";
import { hasInnerMap } from "../../../domain/rules/map/innerMap.js";

export function materializeEmergence({ p, luck, innerRoomName, npcState }) {
  if (!p.emergedNpcDescription || !p.emergedNpcName) return null;
  const { levelCap, personalityProfile } = mapDescriptionToGenParams(p.emergedNpcDescription);
  return {
    changes: {
      varTree: (prev) => clearRumor(prev, p.emergedNpcName),
      room: (r) => {
        // p.room.npcs 只并最小形状的 name/brief——fixateNpcs 已把该条目固化上
        // 「brief+整段正文」推导的战斗数据，而 ensureNpcCombatData 对已有数据直接
        // 跳过不重算，整份并入会让正文里形容别人的词（"掌门""学徒"）错定此人战力。
        const proposed = p.room?.npcs?.find(n => n?.name === p.emergedNpcName);
        const fixed = ensureNpcCombatData({
          // 合并次序：r.npcs 同名者（重逢）最优先，其次最小形状的 brief/carry——
          // carry 是单调用提取层「所见即所得」的可见装备声明（不是战斗数值），
          // ensureNpcCombatData 用它初始化 carriedItems；丢弃会让可偷/可掉落的
          // 东西与叙事描述对不上。skills/combatStats 等推导数据仍不并。
          ...(proposed ? {
            ...(proposed.brief ? { brief: proposed.brief } : {}),
            ...(proposed.carry !== undefined ? { carry: proposed.carry } : {}),
          } : {}),
          ...(r.npcs.find(n => n.name === p.emergedNpcName) || {}),
          // upsert 路径下原名单里没有此人，名字必须显式带上；id 用确定性派生——
          // 交易回调按 n.id === npc.id 寻址，两个 undefined 相等会串改旁人随身物
          name: p.emergedNpcName,
          id: `emerged_${p.emergedNpcName}`,
          personalityProfile,
          // 叙事里登场的人就站在玩家此刻所在的内层房间，不再默认落到锚点
          ...(hasInnerMap(r.name) && innerRoomName ? { innerRoom: innerRoomName } : {}),
        }, { luck, levelCap, trade: npcTradeOf(npcState, { name: p.emergedNpcName }) });
        // materializeNpc 只替换不新增：固定地图原地互动时 writeRoom 只认 r.npcs 名单、
        // 不信 p.room.npcs 的成员增减，所以登场者不存在时必须追加，否则永远进不了屋。
        const npcs = r.npcs.some((n) => n?.name === p.emergedNpcName)
          ? materializeNpc(r.npcs, p.emergedNpcName, fixed)
          : [...r.npcs, fixed];
        return { ...r, npcs };
      },
    },
  };
}
