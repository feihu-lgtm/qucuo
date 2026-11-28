// WO-25K · 同屋微互动异步白描补写（life.vignette）。
// 与 roamReactionBackfill 同渠道：世界规则先把极简占位行带 fillKey 落公屏（保底），
// 这里异步 withAI("life.vignette") 拿回 70-120 字白描，原位替换占位行。
// 护栏（图纸规格）：isGameEpochStale 读档护栏 + 换房作废锁；绝不写 convo、不改 varTree。
import { gameStore, getGameEpoch, isGameEpochStale, gameActions } from "../../store/gameStore.js";
import { createWebAi } from "../../engine/ports/ai.js";
import { withAI } from "../../engine/ports/withAI.js";
import { hasApiKey } from "../../engine/ports/storyteller.js";
import { replaceWhenIdle } from "../../engine/ports/backfill.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { resolveLifeSlice } from "../../domain/rules/livingWorld/npcGoals.js";
import { signatureOf } from "../../domain/data/livingWorld/buildingAffordances.js";
import { BUILDING_TYPE_LABEL } from "../../domain/data/buildings/buildingType.js";
import { SOLAR_TERMS, SHICHEN, dayNightLabel } from "../../domain/rules/clapboard/diegeticState.js";
import { sessionUiStore } from "../../store/sessionUiStore.js";
import "../calls/registerAllPrompts.js";

const webAi = createWebAi();

function anchorBuildingOf(state) {
  const district = state.room?.name;
  if (!district || typeof state.innerRoomName !== "string") return null;
  const bid = getBuildingIdForInnerRoom(district, state.innerRoomName);
  if (!bid) return null;
  return (getBuildingsForLocation(district) || []).find((b) => b.id === bid) || null;
}

// 人物切片喂料：复用 WO-25J 生活切片（同建筑锚定），取癖好/银囊/心境/正在做。
function sliceBitsOf(state, name, buildings, anchor) {
  const npc = (state.room?.npcs || []).find((n) => n?.name === name) || {};
  const slice = resolveLifeSlice({
    npc, varTree: state.varTree, time: state.time, buildings, anchorBuilding: anchor,
  });
  return {
    name,
    brief: npc?.brief || "",
    quirks: slice?.quirks?.join("、") || "",
    purse: slice?.purse || "",
    mood: slice?.mood || "",
    activityDetail: slice?.detail || "",
  };
}

export function lifeVignetteBackfill(vignette, {
  key,
  triggerRoomName,
  triggerInnerRoomName,
  getState = () => gameStore.getState(),
  setLog = gameActions.setLog,
  canAsk = hasApiKey,
  getApiCfg = () => sessionUiStore.getState().apiCfg,
  ask = null, // 测试注入桩；(ctx) => Promise<{text}>
} = {}) {
  if (!vignette?.aName || !vignette?.bName || !key) return false;
  const epoch = getGameEpoch();
  const isStale = () => isGameEpochStale(epoch);
  const roomGone = () => {
    const cur = getState();
    return (cur.room?.name || "") !== triggerRoomName || (cur.innerRoomName ?? null) !== (triggerInnerRoomName ?? null);
  };
  const stale = () => isStale() || roomGone();

  const state = getState();
  const district = triggerRoomName;
  const buildings = getBuildingsForLocation(district) || [];
  const anchor = anchorBuildingOf(state);
  const time = state.time || 0;
  const hour = ((Math.floor(time) % 24) + 24) % 24;
  const day = Math.floor(time / 24) + 1;
  const placeLabel = triggerInnerRoomName && triggerInnerRoomName !== triggerRoomName
    ? `${triggerRoomName}·${triggerInnerRoomName}` : triggerRoomName;
  const ctx = {
    placeLabel,
    buildingTypeLabel: anchor ? (BUILDING_TYPE_LABEL[anchor.type] || "") : "",
    venueVibe: "",
    shichen: SHICHEN[Math.min(11, Math.floor(hour / 2))],
    dayNight: dayNightLabel(hour),
    solarTerm: SOLAR_TERMS[Math.floor(Math.max(0, day - 1) / 15) % 24],
    venueSignatureDetail: anchor ? signatureOf(anchor) : "",
    npcA: sliceBitsOf(state, vignette.aName, buildings, anchor),
    npcB: sliceBitsOf(state, vignette.bName, buildings, anchor),
    pairRelationTag: vignette.relationTag || "",
    deterministicOutcome: vignette.outcome || "",
    playerPresenceHint: "在旁处做自己的事",
    cfg: getApiCfg(),
  };

  (async () => {
    try {
      if (stale() || !canAsk()) return false;
      const { text } = ask
        ? await ask(ctx)
        : await withAI("life.vignette", ctx, {
          ai: webAi,
          apiCfg: ctx.cfg,
          modelOptions: { disableThinking: true },
        });
      if (stale()) return false;
      const line = String(text || "").trim();
      if (!line) return false;
      // 与 roam 同款信息降级护栏：白描若连一位当事者名字都没写，宁可保留占位行。
      if (!line.includes(vignette.aName) && !line.includes(vignette.bName)) return false;
      return await replaceWhenIdle(key, line, { setLog, isStale: stale });
    } catch {
      return false;
    }
  })();
  return true;
}
