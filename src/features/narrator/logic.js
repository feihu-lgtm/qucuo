import { narratorVars, setNarratorVars } from "../../domain/prompt/mvu.js";
import { NNPC_STAGE } from "../../domain/narrator/narrator.js";
import { COMFORT_ACTIONS, SCENE_ARRIVE, SCENE_RESOLVE, canComfort, describeComfortReject, comfortResponse, defenseLevelOf, availableKnot, canResolve } from "../../domain/narrator/narratorQuest.js";
import { SEA_OF_MIND, canEnterSea, describeSeaGate, seaEntryHint } from "../../domain/narrator/seaOfMind.js";
import { QUCUO_MAP } from "../../domain/map/qucuoMap.js";
import { NOTE_SOURCE, VIA } from "../../domain/memory/note.js";

export function comfort(state, actionKey) {
  const v = narratorVars(state.varTree);
  const invNames = (state.inv || []).map(i => typeof i === "string" ? i : i?.name).filter(Boolean);
  const gate = canComfort(actionKey, v.comfort, invNames);
  if (!gate.ok) return { logs: [{ t: "desc", text: `  ${describeComfortReject(actionKey, gate.reason, gate)}` }] };
  const levelBefore = defenseLevelOf(v.comfort);
  const nextComfort = { ...v.comfort, [actionKey]: (v.comfort?.[actionKey] || 0) + 1 };
  const levelAfter = defenseLevelOf(nextComfort);
  const logs = [
    { t: "cmd", text: `> ${COMFORT_ACTIONS[actionKey].label}` },
    { t: "desc", text: `  ${comfortResponse(actionKey, levelBefore)}` },
  ];
  if (levelAfter < levelBefore) {
    const felt = ["她彻底放松下来了。", "她靠着你，很安静。", "她不再躲你的手了。", "她开始肯说话了。", "她抬眼看了你一下。"][levelAfter] || "";
    if (felt) logs.push({ t: "affection", text: `  ${felt}` });
  }
  const before = availableKnot(v.comfort, v.knots || []);
  const after = availableKnot(nextComfort, v.knots || []);
  if (!before && after) logs.push({ t: "sys", text: "  ⟡ 她像是有话要说。问问她。" });
  return { changes: { varTree: prev => setNarratorVars(prev, { comfort: nextComfort }) }, logs };
}

export function resolveTrauma(state) {
  const v = narratorVars(state.varTree);
  if (!canResolve(v.comfort, v.knots || [])) return { logs: [{ t: "sys", text: "  还不到说这句话的时候。" }] };
  return {
    changes: {
      varTree: prev => setNarratorVars(prev, { traumaResolved: true, questStage: 4 }),
      narrator: n => ({ ...n, stage: NNPC_STAGE.RESOLVED }),
    },
    logs: SCENE_RESOLVE,
    note: {
      text: "在心灵之海把旁白的三个心结都听完了，告诉她不必最强也有人看着她。她信了。",
      owner: [{ name: "旁白", via: VIA.FIRSTHAND }], source: NOTE_SOURCE.NARRATIVE,
    },
  };
}

export function enterSeaOfMind(state) {
  const gate = canEnterSea({ flags: state.flags, varTree: state.varTree, districtName: state.room.name, innerRoomName: state.innerRoomName });
  if (!gate.ok) return { logs: [{ t: "sys", text: `  ${describeSeaGate(gate.reason)}` }] };
  const v = narratorVars(state.varTree);
  const logs = [];
  if (!v.seaVisited) logs.push({ t: "narrator", text: seaEntryHint(gate.house.label) });
  logs.push(
    { t: "room", text: "" },
    { t: "desc", text: "  你闭上眼。再睁开时，脚下是白色的沙。太阳正在落山——永远在落山。" },
  );
  if (!v.seaVisited) logs.push(...SCENE_ARRIVE);
  return {
    changes: {
      room: { name: SEA_OF_MIND.district, desc: QUCUO_MAP[SEA_OF_MIND.district].desc, exits: [], npcs: [], items: [] },
      varTree: prev => setNarratorVars(prev, { seaVisited: true }),
      ...(state.narrator.stage !== NNPC_STAGE.RESOLVED ? { narrator: n => ({ ...n, stage: NNPC_STAGE.SPIRIT }) } : {}),
    },
    logs,
  };
}

export function leaveSeaOfMind(state, returnTo) {
  const back = returnTo || { room: "鱼定村", inner: null };
  const node = QUCUO_MAP[back.room];
  if (!node) return { logs: [{ t: "sys", text: "  回不去了……？" }] };
  return {
    changes: { room: { name: back.room, desc: node.desc, exits: Object.keys(node.exits), npcs: [], items: [] } },
    logs: [{ t: "desc", text: "  海浪声退远了。你睁开眼，还在原来那间屋子里，门关着，天光未变。" }],
  };
}

export function confessToNarrator(state) {
  if (state.narrator.affection < 100 || state.narrator.confessed) return { logs: [] };
  return {
    changes: { narrator: n => ({ ...n, confessed: true, stage: NNPC_STAGE.CHEAT }) },
    logs: [
      { t: "sys", text: "" },
      { t: "confess", text: "  你对着虚空，认真地说出了那句话。" },
      { t: "confess", text: "  一阵长久的沉默后，旁白的声音第一次带上了不属于\"引擎\"的震颤。" },
      { t: "confess", text: "  「……我，」她说，「原来我一直在等你问这句话。」" },
      { t: "sys", text: "" },
    ],
  };
}
