import { tryInnerMove } from "../../act/innerMove.js";
import { getInnerRoom, hasInnerMap } from "../../innerMap.js";
import { markAsSeen, updateLastSeen } from "../../npcAwareness.js";
import { DIRS, parseDir } from "../../utils/mudHelpers.js";

const DIRECTION_TOKENS = new Set([
  "n", "s", "e", "w", "u", "d", "ne", "nw", "se", "sw",
  "north", "south", "east", "west", "up", "down",
  "northeast", "northwest", "southeast", "southwest",
  "北", "南", "东", "西", "上", "下", "东北", "西北", "东南", "西南",
]);

function isDirectionToken(value) {
  const token = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^(?:向|往|朝|到)/, "")
    .replace(/(?:边|面)?走?$/, "");
  return DIRECTION_TOKENS.has(token);
}

function normalizeRequest(dirOrRoom) {
  if (dirOrRoom && typeof dirOrRoom === "object") return dirOrRoom;
  const command = String(dirOrRoom ?? "");
  const match = /^(走|去)\s*(.*)$/.exec(command.trim());
  return {
    target: match ? match[2].trim() : command.trim(),
    command,
    targetKind: match?.[1] === "去" ? "room" : match?.[1] === "走" ? "direction" : undefined,
    forceLayer: "inner",
  };
}

function resolveDirection(state, request) {
  const raw = request.direction ?? request.dir ?? request.target ?? request.room ?? "";
  const currentRoom = getInnerRoom(state.room?.name, state.innerRoomName);
  const destination = request.room ?? request.target ?? raw;
  const matchedExit = Object.entries(currentRoom?.exits || {})
    .find(([, roomName]) => roomName === destination);
  if (matchedExit) return matchedExit[0];

  if (request.direction !== undefined || request.dir !== undefined) {
    return parseDir(request.direction ?? request.dir);
  }
  if (request.room !== undefined || request.targetKind === "room") return null;
  if (request.targetKind !== "direction" && !isDirectionToken(raw)) return null;
  return parseDir(raw);
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

  return {
    changes: {
      innerRoomName: decision.innerDest,
      time: state.time + 1,
      varTree: (prev) => {
        const current = prev || {};
        const seen = decision.newFaces.length
          ? markAsSeen(current, decision.newFaces)
          : current;
        return updateLastSeen(seen, decision.arrivedNames, state.time);
      },
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
