import { NOTE_SOURCE, VIA } from "../../memory/note.js";
import { NNPC_STAGE } from "../../narrator.js";
import { SEA_OF_MIND, buildXuannuScene, shouldTriggerXuannu } from "../../seaOfMind.js";
import { SCENE_PORTAL_OPEN, SCENE_RETURN, SCENE_TOKYO, SCENE_VILLA } from "../../narratorQuest.js";
import { QUCUO_MAP } from "../../qucuoMap.js";
import { SAFE_HOUSES } from "../../safeHouse.js";
import { narratorVars, setNarratorVars } from "../../mvu.js";
import { unlockAsuka } from "../../companion.js";

export const xuannuTriggerRule = {
  id: "narrator.xuannu-trigger",
  deps: (state) => [state.narrator?.affection, state.varTree, state.char?.name],
  run(state) {
    const varTree = state.varTree || {};
    if (!shouldTriggerXuannu({
      affection: state.narrator?.affection,
      varTree,
      knownNames: varTree.世界?.已认识人物 || [],
    })) return null;
    return {
      changes: {
        varTree: (previous) => setNarratorVars(previous, {
          metXuannu: true,
          seaUnlocked: true,
          questStage: 1,
        }),
        flags: (previous) => previous.includes(SEA_OF_MIND.flag)
          ? previous
          : [...previous, SEA_OF_MIND.flag],
      },
      logs: buildXuannuScene(state.char?.name || "你"),
      note: {
        text: `雪山派后山温泉，玄女说旁白"不是这里的人""她在等"，让我找个自己的地方去她心里看看。`,
        owner: [{ name: "玄女", via: VIA.FIRSTHAND }, { name: "旁白", via: VIA.FIRSTHAND }],
        source: NOTE_SOURCE.NARRATIVE,
      },
    };
  },
};

export const villaArrivalRule = {
  id: "narrator.villa-arrival",
  deps: (state) => [state.room?.name, state.innerRoomName, state.narrator?.stage],
  run(state) {
    if (state.room?.name !== SEA_OF_MIND.district || state.innerRoomName !== "白色别墅") return null;
    const vars = narratorVars(state.varTree);
    if (vars.villaEntered || state.narrator?.stage === NNPC_STAGE.RESOLVED) return null;
    return {
      changes: {
        varTree: (previous) => setNarratorVars(previous, { villaEntered: true, questStage: 2 }),
        narrator: (previous) => ({ ...previous, stage: NNPC_STAGE.SEA_CRASHED }),
      },
      logs: SCENE_VILLA,
      note: {
        text: "在心灵之海的白色别墅里，旁白看见墙上那幅红色巨人的画，全都想起来了，蜷在沙发角落不让人看。",
        owner: [{ name: "旁白", via: VIA.FIRSTHAND }],
        source: NOTE_SOURCE.NARRATIVE,
      },
    };
  },
};

export const portalOpenedRule = {
  id: "narrator.portal-opened",
  deps: (state) => [state.room?.name, state.narrator?.stage],
  run(state) {
    if (state.room?.name !== SEA_OF_MIND.district) return null;
    const vars = narratorVars(state.varTree);
    if (!vars.traumaResolved || vars.portalOpened) return null;
    return {
      changes: {
        varTree: (previous) => setNarratorVars(previous, { portalOpened: true, questStage: 5 }),
        flags: (previous) => previous.includes("传送门已开") ? previous : [...previous, "传送门已开"],
      },
      logs: SCENE_PORTAL_OPEN,
    };
  },
};

export const scheduleTokyoReturnRule = {
  id: "narrator.tokyo-return",
  deps: (state) => [state.room?.name],
  run(state, { cancelTokyoReturn, scheduleTokyoReturn, getSeaReturn } = {}) {
    cancelTokyoReturn?.();
    if (state.room?.name !== "第三新东京市") return null;
    if (narratorVars(state.varTree).tokyoVisited) return null;
    const back = getSeaReturn?.() || { room: "鱼定村", inner: "溪边小屋" };
    const label = SAFE_HOUSES.find((house) => house.room === back.inner)?.label || back.inner || back.room;
    scheduleTokyoReturn?.({ back, label });
    return {
      changes: {
        varTree: (previous) => setNarratorVars(previous, { tokyoVisited: true, questStage: 6 }),
      },
      logs: SCENE_TOKYO,
    };
  },
};

export function finishTokyoReturn(back, label) {
  const node = QUCUO_MAP[back.room];
  const changes = {
    companionState: (previous) => unlockAsuka(previous),
    varTree: (previous) => setNarratorVars(previous, { asukaFree: true, questStage: 7 }),
  };
  if (node) {
    changes.room = {
      name: back.room,
      desc: node.desc,
      exits: Object.keys(node.exits),
      npcs: [],
      items: [],
    };
  }
  return {
    result: {
      changes,
      logs: SCENE_RETURN(label),
      note: {
        text: "跟明日香一起去看了第三新东京市，那儿有人在住。回来之后她就跟着我了。",
        owner: [{ name: "明日香", via: VIA.FIRSTHAND }],
        source: NOTE_SOURCE.NARRATIVE,
      },
    },
    ...(node ? { innerRoomName: back.inner } : {}),
  };
}
