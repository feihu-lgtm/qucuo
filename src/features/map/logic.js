import { tryInnerMove } from "../../act/innerMove.js";
import { getInnerRoom, hasInnerMap } from "../../innerMap.js";
import { markAsSeen, updateLastSeen } from "../../npcAwareness.js";
import { DIRS, parseDir } from "../../utils/mudHelpers.js";

function normalizeRequest(dirOrRoom) {
  if (dirOrRoom && typeof dirOrRoom === "object") return dirOrRoom;
  const command = String(dirOrRoom ?? "");
  return {
    target: command.replace(/^(?:走|去)\s*/, "").trim(),
    command,
    forceLayer: "inner",
  };
}

function resolveDirection(state, request) {
  const raw = request.direction ?? request.dir ?? request.target ?? request.room ?? "";
  const parsed = parseDir(raw);
  if (parsed) return parsed;

  const currentRoom = getInnerRoom(state.room?.name, state.innerRoomName);
  const destination = request.room ?? request.target ?? raw;
  return Object.entries(currentRoom?.exits || {})
    .find(([, roomName]) => roomName === destination)?.[0] || null;
}

function commandText(request, direction) {
  if (request.command) return request.command;
  const value = request.target ?? request.room ?? request.direction ?? request.dir ?? "";
  return value || (direction ? `往${DIRS[direction] || direction}走` : "内层移动");
}

export function innerMove(state, dirOrRoom) {
  const request = normalizeRequest(dirOrRoom);
  const forceLayer = Object.hasOwn(request, "forceLayer") ? request.forceLayer : "inner";
  const direction = resolveDirection(state, request);
  const command = commandText(request, direction);

  if (!hasInnerMap(state.room?.name) || !state.innerRoomName) {
    if (direction) {
      tryInnerMove({
        _trace: request._trace,
        isTalk: false,
        movingDir: direction,
        forceLayer,
        room: state.room,
        innerRoomName: state.innerRoomName,
        flags: state.flags,
        varTree: state.varTree || {},
        questProgress: state.questProgress,
        inv: state.inv,
        char: state.char,
      });
    }
    return null;
  }

  if (!direction) {
    if (!forceLayer || forceLayer === "outer") return null;
    return {
      logs: [
        { t: "cmd", text: `> ${command}` },
        { t: "sys", text: "  内里这个方向没有去处。" },
      ],
    };
  }

  const decision = tryInnerMove({
    _trace: request._trace,
    isTalk: false,
    movingDir: direction,
    forceLayer,
    room: state.room,
    innerRoomName: state.innerRoomName,
    flags: state.flags,
    varTree: state.varTree || {},
    questProgress: state.questProgress,
    inv: state.inv,
    char: state.char,
  });
  if (!decision) return null;

  if (decision.kind === "blocked") {
    return {
      logs: [
        { t: "cmd", text: `> ${command}` },
        { t: "sys", text: `  ${decision.lockedMsg || "内里这个方向没有去处。"}` },
      ],
    };
  }

  let varTree = state.varTree || {};
  if (decision.newFaces.length) varTree = markAsSeen(varTree, decision.newFaces);
  varTree = updateLastSeen(varTree, decision.arrivedNames, state.time);

  return {
    changes: {
      innerRoomName: decision.innerDest,
      time: state.time + 1,
      varTree,
    },
    logs: [
      { t: "cmd", text: `> ${command}` },
      { t: "room", text: "" },
      { t: "room", text: `    ${state.room.name}·${decision.innerDest}` },
      { t: "room", text: "" },
      ...decision.arrivalLines,
      ...decision.newFaces.map((name) => ({ t: "sys", text: `  ※ 新人物出现：${name}（点击可细看其人）` })),
    ],
  };
}
