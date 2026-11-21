import { AFFECTION_RULES } from "../state/fields.js";

export const APPEASE_EXTRACTION_SPEC = {
  system: "你是游戏状态提取器，专门判断当前尝试是否缓和了NPC的怒气。只输出规则允许的怒气解除与有限好感度变化，不得修改其他状态。",
  user: (narrative, state, settleOpts) => {
    const npcName = settleOpts?.settleNpc || "目标角色";
    const anger = state.varTree?.角色?.[npcName]?.生气状态;
    return `${npcName}仍处于生气状态（原因：${anger?.reason || "未记录"}，剩余${anger?.turnsLeft ?? "?"}回合）。玩家本轮进行了当前这次缓和尝试。请结合叙事与此前尝试的方式，判断这一次是否真正让对方消气；不能仅因玩家尝试了某种行为就判定成功。

叙事内容：
${narrative}

仅当本次确实成功时，允许输出 _.set('角色.${npcName}.生气解除', true)，并可选输出 _.add('角色.${npcName}.好感度', N)，其中 N 为 ${AFFECTION_RULES.appease.join("~")} 的整数。若未成功或无法确定，不输出任何 MVU 指令。严禁输出其他路径、字段、delta 或变更。
成功示例：{"mvu":"_.set('角色.${npcName}.生气解除', true);\\n_.add('角色.${npcName}.好感度', 3);"}
失败示例：{}`;
  },
};
