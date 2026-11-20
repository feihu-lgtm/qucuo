import { isNpcVisibleInInnerRoom } from "../map/innerMap.js";
import { QUEST_TYPE } from "./questTypes.js";

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

export const SNOW_LEOPARD_QUEST = {
  id: SNOW_QUEST_ID, type: QUEST_TYPE.COLLECT, title: "收复雪豹", giver: null,
  description: "鱼定村有头无主的雪豹，长长久久卧在村口那块青石上，不亲近谁，也不归谁所有，只静静等着一个它自己认准的人。它只认有灵之人；七样灵性占得五样，才肯随你踏遍山川。",
  rewardText: "雪豹以额抵掌，从此山长水远，与你同行。",
  stages: [
    { id: "s1", title: "证明与山川有缘", description: "先莫急着招手。割肉喂它，留心它为何坐立不安，治好前爪旧伤；或为鱼定村出力，练得体魄七分、魅力七分，打赢一个恶人。七样灵性占得五样，青石上的金瞳自会认你。", completionFlag: SNOW_TRUSTED },
    { id: "s2", title: "伸手相邀", description: "雪豹不再背过身去，粗长尾巴轻轻拂着你的脚踝。伸出手，邀它入队；它若将额头抵入掌心，这份山川之缘便算定了。", completionFlag: SNOW_INVITED },
  ],
};

export function snowLeopardPresent(state) {
  return !!state.room?.npcs?.some((npc) => npc.name === "雪豹" && isNpcVisibleInInnerRoom(state.room.name, state.innerRoomName, npc));
}

export function filterSnowModelFlags(flags = [], state) {
  const allowed = snowQuestActive(state) && snowLeopardPresent(state);
  return flags.filter((flag) => typeof flag === "string" && (
    !flag.startsWith("snow_") || (allowed && ["snow_spirit_meat", "snow_spirit_scratch"].includes(flag))
  ));
}

export function snowLeopardNote(state) {
  if (!snowQuestActive(state) || !snowLeopardPresent(state)) return "";
  const flags = state.flags || [];
  if (state.settleKind === "gift" && state.settleNpc === "雪豹") return '\n[收复雪豹·赠礼] 只判断这次礼物是否为肉：是肉才在delta.flags_add中加入snow_spirit_meat；非肉则拒吃并讲个短笑话。该赠礼结算的flags_add只允许snow_spirit_meat，不得加入挠痒、信任或其他旗标；物品已由系统扣除，不得重复处理。';
  return `\n[收复雪豹] 雪豹无主，只接受有灵之人，七灵得五才可信任，邀请入队与信任由系统结算，不得由AI发flag。玩家赠送或自由叙述喂食雪豹时，由你判断是否为肉：是肉才在delta.flags_add加入snow_spirit_meat；非肉则拒吃，写一个短笑话，它只吃肉。${!flags.includes("snow_spirit_scratch") ? "与雪豹说话或在附近时，写它坐立不安、像母鸡一样蹲着，原来身上发痒；玩家实际替它挠痒时，才在delta.flags_add加入snow_spirit_scratch。鱼定村村民及旁白被问及雪豹时，可暗示它想让人挠痒。" : ""}${!flags.includes("snow_spirit_medicine") ? "它前爪有陈年旧伤，走动时微跛；送药可治，由系统结算。" : "前爪旧伤已愈，不再跛行。"}本任务AI只可添加snow_spirit_meat、snow_spirit_scratch，其他灵性与阶段旗标一概由系统判定。`;
}

export function snowLeopardHint(state) {
  if (!snowQuestActive(state) || !state.cmd?.includes("雪豹") || state.flags?.includes("snow_spirit_scratch")) return "";
  return "\n[雪豹线索] 玩家问起雪豹，旁白可随口点破：那无主的家伙坐立不安、像母鸡一样蹲着，不是摆架子，是想让人替它挠痒。";
}
