import { detectCollectPickup, allCollected } from "../quests/collect.js";
import { getCurrentStage } from "../quests/questEngine.js";
import { QUCUO_QUESTS } from "../quests/qucuoQuests.js";
import { makeItemSmart } from "../items/catalog.js";
import { makeItem } from "../equipment.js";

const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

// 采集裁决·判定段（纯判定，不写状态）：玩家表达采集意图、且所采之物此刻真在地上
// （系统先前已注入）时，给出裁决结果——「采没采到」不交给 AI 决定。
// 返回 null 或 { item, gained, note }：act 负责把 gained 入背包、从地上抹去、
// 写 collectGrantedRef 与日志，并把 note 拼进本轮 prompt。
export function judgeCollect({ isTalk, cmd, room, questProgress, inv }) {
  if (isTalk) return null;
  const hit = detectCollectPickup(cmd, room.name, room.items, {
    questProgress, quests: QUCUO_QUESTS, getCurrentStage, inv,
  });
  if (!hit) return null;
  const cEntry = (Array.isArray(hit.stage.collect) ? hit.stage.collect : [hit.stage.collect])
    .find(c => c.item === hit.item) || {};
  const gained = makeGameItem({ name: hit.item, category: "misc", quality: cEntry.quality || "白", desc: cEntry.hint || "" });
  // 是否采齐（用投影后的背包判断，避免读到旧 state）
  const done = allCollected(hit.stage, [...inv, gained]);
  const note = `\n[系统裁决：玩家已采得「${hit.item}」，系统已将其收入背包。请在 output 里自然叙述采集/挖取的过程与手感（贴合本地域），但**不要**在 delta.items_add 里再加这件物品（否则会重复），也不要写"没找到""采不到"。${done ? `此物一到手，《${hit.quest.title}》本阶段所需已齐。` : `本阶段还需其余材料，可点出还差什么。`}]`;
  return { item: hit.item, gained, note };
}
