import { isNpcVisibleInInnerRoom } from "../map/innerMap.js";
import "../content/loadDefaultContent.js";
import { getContent } from "../content/registry.js";

export const SNOW_QUEST_ID = "snow_leopard_quest";
export const SNOW_TRUSTED = "snow_leopard_trusted";
export const SNOW_INVITED = "snow_leopard_invited";
export const SNOW_SPIRITS = [
  ["meat", "吃好了"], ["scratch", "挠痒痒"], ["village", "对村里有恩"],
  ["strength", "力气够大"], ["duel", "打了坏人"], ["charm", "交际够高"],
  ["medicine", "治好雪豹的病"],
].map(([key, label]) => ({ key, label, flag: `snow_spirit_${key}` }));
export const snowSpiritCount = (flags = []) => SNOW_SPIRITS.filter(({ flag }) => flags.includes(flag)).length;
export const snowQuestActive = (state) => state.questProgress?.[SNOW_QUEST_ID]?.status === "active";

export const SNOW_LEOPARD_QUEST = getContent("quest", SNOW_QUEST_ID);

export function snowLeopardPresent(state) {
  return !!state.room?.npcs?.some((npc) => npc.name === "雪豹" && isNpcVisibleInInnerRoom(state.room.name, state.innerRoomName, npc));
}

export function filterSnowModelFlags(flags = [], state) {
  // WO-16C-snow：全部 snow 旗标（meat/scratch/medicine/trusted/灵性）均由系统
  // 确定性结算——模型输出一律剥除，不再存在"允许 AI 补旗"的窗口，杜绝双通道。
  void state;
  return flags.filter((flag) => typeof flag === "string" && !flag.startsWith("snow_"));
}

export function snowLeopardNote(state) {
  if (!snowQuestActive(state) || !snowLeopardPresent(state)) return "";
  const flags = state.flags || [];
  if (state.settleKind === "gift" && state.settleNpc === "雪豹") return '\n[收复雪豹·赠礼] 礼物是否为肉、是否接受、灵性旗标已由系统结算完毕（肉食才会记 snow_spirit_meat）。你只写它吃下或拒吃的反应——非肉它拒吃，可讲个短笑话。禁写任何 snow 旗标、禁重复扣除或返还物品。';
  return `\n[收复雪豹] 雪豹无主，只接受有灵之人，七灵得五才可信任。喂食/挠痒/送药/信任/入队全部由系统确定性结算并发旗标，AI 一律不得写任何 snow 旗标、不得扣减或产出物品。${!flags.includes("snow_spirit_scratch") ? "与雪豹说话或在附近时，写它坐立不安、像母鸡一样蹲着，原来身上发痒；鱼定村村民及旁白被问及雪豹时，可暗示它想让人挠痒。玩家实际替它挠痒时系统自会落账，你只管顺势叙述。" : ""}${!flags.includes("snow_spirit_medicine") ? "它前爪有陈年旧伤，走动时微跛；送药可治，由系统结算。" : "前爪旧伤已愈，不再跛行。"}`;
}

export function snowLeopardHint(state) {
  if (!snowQuestActive(state) || !state.cmd?.includes("雪豹") || state.flags?.includes("snow_spirit_scratch")) return "";
  return "\n[雪豹线索] 玩家问起雪豹，旁白可随口点破：那无主的家伙坐立不安、像母鸡一样蹲着，不是摆架子，是想让人替它挠痒。";
}
