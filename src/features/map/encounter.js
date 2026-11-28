import { ITEM_CATEGORY, makeItem, rollQuality } from "../../domain/rules/economy/equipment.js";
import { rollEncounter } from "../../domain/rules/map/encounter.js";
import { rollRoadEvent, ROAD_EVENT_SHARE } from "../../domain/rules/livingWorld/roadEvents.js";
import { makeItemSmart } from "../../domain/data/items/catalog.js";
import { detectCollectPickup, allCollected } from "../../domain/rules/quests/collect.js";
import { getCurrentStage } from "../../domain/rules/quests/questEngine.js";
import { QUCUO_QUESTS } from "../../domain/data/quests/qucuoQuests.js";
import { getGroundItems } from "../../domain/rules/map/groundScope.js";

const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

export function rollMovementEvents({
  isTalk,
  movingDir,
  lockedDestName,
  targetedRumor,
  luck = 5,
  random = Math.random,
  isTaken,
  state = null,
}) {
  let pickupJudgment = null;
  if (!isTalk && movingDir && random() < 0.35) {
    const quality = rollQuality(luck);
    const category = [
      ITEM_CATEGORY.WEAPON,
      ITEM_CATEGORY.ARMOR,
      ITEM_CATEGORY.ACCESSORY,
      ITEM_CATEGORY.MISC,
    ][Math.floor(random() * 4)];
    pickupJudgment = { quality, category };
  }

  let encounterToDescribe = null;
  let roadRoll = null;
  if (!isTalk && movingDir && lockedDestName && !targetedRumor) {
    encounterToDescribe = rollEncounter(lockedDestName, luck, { isTaken });
    // WO-25O：命中过路人遭遇后按 ROAD_EVENT_SHARE 分流换路遇事件；
    // 路遇池空（冷却/谓词不搭）落回原势力过路人。势力伏击在别处判，此处不碰。
    if (encounterToDescribe && state && random() < ROAD_EVENT_SHARE) {
      const rolled = rollRoadEvent(state, lockedDestName, { rng: random, luck });
      if (rolled) {
        roadRoll = rolled;
        encounterToDescribe = null;
      }
    }
  }
  return { pickupJudgment, encounterToDescribe, roadRoll };
}

export function judgeCollect({ isTalk, cmd, room, innerRoomName, questProgress, inv }) {
  if (isTalk) return null;
  const hit = detectCollectPickup(cmd, room.name, getGroundItems({ room, innerRoomName }), {
    questProgress, quests: QUCUO_QUESTS, getCurrentStage, inv,
  });
  if (!hit) return null;
  const cEntry = (Array.isArray(hit.stage.collect) ? hit.stage.collect : [hit.stage.collect])
    .find((collect) => collect.item === hit.item) || {};
  const gained = makeGameItem({
    name: hit.item,
    category: "misc",
    quality: cEntry.quality || "白",
    desc: cEntry.hint || "",
  });
  const done = allCollected(hit.stage, [...inv, gained]);
  const note = `\n[系统裁决：玩家已采得「${hit.item}」，系统已将其收入背包。请在 output 里自然叙述采集/挖取的过程与手感（贴合本地域），但**不要**在 delta.items_add 里再加这件物品（否则会重复），也不要写"没找到""采不到"。${done ? `此物一到手，《${hit.quest.title}》本阶段所需已齐。` : `本阶段还需其余材料，可点出还差什么。`}]`;
  return { item: hit.item, gained, note };
}
