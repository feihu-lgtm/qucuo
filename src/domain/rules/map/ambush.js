// 势力伏击：合稿「不共戴天」档（声誉 ≤ -60）的敌对势力会在大地图随机截杀玩家。
// 移动到据点时按合稿条件判定一次——命中即强制开战（forcedDuelNpc 通道，
// 切磋结算照常写战报/掉落）。叛出本派扣 -60 后自然落入此通道（如叛出唐门 → 暗杀组）。
// 只登记合稿写了的伏击方；别家照此表加条目即可，不用动机制。
// 注意：defectedFlag 必须在文件顶层求值之后才可用，所以登记表在 import 之后。
import { factionRepOf } from "../economy/factionRep.js";
import { defectedFlag } from "../character/factionEntry.js";
import { ensureNpcCombatData } from "../npc/npcGeneration.js";
import { seededRand } from "../../../utils/seededRandom.js";

export const AMBUSH_SQUADS = [
  {
    faction: "唐门",
    // 合稿·唐门：叛出/逐出扣 -60，声誉跌破 -60 后「派出暗杀组在大地图随机伏击」。
    member: {
      name: "唐门暗弩手",
      levelCap: 3,
      brief: "唐门暗杀组，玄衣蒙面，袖藏连珠毒弩，奉命清理门户。",
      faction: "唐门",
      tag: "tangmen_assassin",
    },
    approach: "一支淬毒的弩矢擦着耳畔钉进土里——玄衣人自暗处掠出，唐门的暗杀组寻到了你！",
    chance: 0.35,
    // 叛出本派者按合稿就该被追杀——叛出只把声誉重置到 -40（不到 -60 线），
    // 拿叛出旗另开一道门，不改 DEFECT_REP 既定数值。
    traitorFlag: defectedFlag("唐门"),
  },
];

// 纯判定便于测试：rng 可注入；命中返回伏击成员 NPC 或 null。
export function pickAmbusher(state, rng = seededRand(Math.floor((state.time || 0) / 24), state.room?.name || "")) {
  for (const squad of AMBUSH_SQUADS) {
    const hostile = factionRepOf(state.varTree, squad.faction) <= -60
      || (squad.traitorFlag && (state.flags || []).includes(squad.traitorFlag));
    if (!hostile) continue;
    // 伏击者不进 room.npcs，开打前先把 combat 数据补齐（moveset/战力/随身物），
    // 不然决斗屏拿空招式集，回合全被挡。
    if (rng() < squad.chance) return { npc: ensureNpcCombatData({ ...squad.member }), text: squad.approach };
  }
  return null;
}

export const factionAmbushRule = {
  id: "map.faction-ambush",
  deps: (state) => [state.room?.name],
  run(state) {
    if (!state.room?.name) return null;
    const hit = pickAmbusher(state);
    if (!hit) return null;
    return {
      logs: [{ t: "err", text: `  ${hit.text}` }],
      forcedDuelNpc: hit.npc,
    };
  },
};
