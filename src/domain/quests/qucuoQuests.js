import "../../content/index.js";
import { allContent, contentEntries } from "../content/registry.js";
// 曲措乡剧情任务定义
// 这里是手写的任务数据，跟角色小传绑在一起维护，翻译自
// docs/曲措乡_总纲_v3.md 第二章/第五章。每个 stage 的 description 保留
// 源文档里具体的台词、动作、物件细节——AI 靠这段文字生成玩家看到的正文，
// 一句空洞的情节摘要（"分别说服两位父亲"）会让AI写出没有灵魂的通用文本，
// 所以宁可写长，也要把「」里的原话和关键动作留住。
// stage.onReach 是系统真正执行的奖励（加物品/改好感度/加银两/记flag），
// rewardText 只是完成时展示给玩家看的一句收尾描述，两者分工不同。

export const QUCUO_QUESTS = allContent("quest");

// 学技能任务对应关系：完成上面那个任务后，玩家在满足好感度条件时
// 能从老猎户那里学到的具体技能。技能内容直接复用 npcGeneration.js
// 里已有的技能池，不需要另造一套。
export const NPC_TEACHABLE_SKILLS = Object.fromEntries(contentEntries("teachableSkill"));

export function findQuestById(id) {
  return QUCUO_QUESTS.find(q => q.id === id);
}

export function findQuestByGiver(npcName) {
  return QUCUO_QUESTS.find(q => q.giver === npcName);
}
