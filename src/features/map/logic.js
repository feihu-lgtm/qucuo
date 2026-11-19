import { tryInnerMove } from "../../engine/act/innerMove.js";
import { makeItem, QUALITY } from "../../domain/economy/equipment.js";
import { getInnerRoom, hasInnerMap } from "../../domain/map/innerMap.js";
import { makeItemSmart } from "../../domain/items/catalog.js";
import { detectNewFaces, markAsSeen, updateLastSeen } from "../../domain/npc/npcAwareness.js";
import { ensureNpcCombatData } from "../../domain/npc/npcGeneration.js";
import { findPath, getMapNode, isNodeUnlocked } from "../../domain/map/qucuoMap.js";
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

function commandLogs(request, command) {
  return request.includeCommand === false ? [] : [{ t: "cmd", text: `> ${command}` }];
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
        ...commandLogs(request, command),
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
        ...commandLogs(request, command),
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
      ...commandLogs(request, command),
      { t: "room", text: "" },
      { t: "room", text: `    ${state.room.name}·${decision.innerDest}` },
      { t: "room", text: "" },
      ...decision.arrivalLines,
      ...decision.newFaces.map((name) => ({ t: "sys", text: `  ※ 新人物出现：${name}（点击可细看其人）` })),
    ],
  };
}

function makeGameItem(spec) {
  return makeItemSmart(spec, makeItem);
}

function completedQuestIds(questProgress) {
  return new Set(Object.entries(questProgress || {})
    .filter(([, progress]) => progress?.status === "completed" || progress?.done)
    .map(([id]) => id));
}

export function planAutoTravel(state, destName) {
  const unlocked = { completedQuests: completedQuestIds(state.questProgress), flags: state.flags || [] };
  if (!isNodeUnlocked(destName, unlocked)) return { locked: true, path: null };
  const allowed = new Set(Object.keys(state.mapData || {}).filter((name) => isNodeUnlocked(name, unlocked)));
  return { locked: false, path: findPath(state.room?.name, destName, allowed) };
}

function readArrivalSquare(square, day) {
  if (!square || square.day !== day) {
    return { desc: null, findLine: "", item: null, encounter: null };
  }
  return {
    desc: square.desc,
    findLine: square.findLine || "",
    item: square.item && !square.itemTaken && !square.burned ? square.item : null,
    encounter: square.encounter && !square.encounterMet && !square.burned ? square.encounter : null,
  };
}

export function outerArrival(state, { direction, destName, roomMap, squares, command = "" } = {}) {
  if (!destName) return null;
  const destNode = getMapNode(destName);
  if (!destNode) return null;

  const unlockContext = { completedQuests: completedQuestIds(state.questProgress), flags: state.flags || [] };
  if (!isNodeUnlocked(destName, unlockContext)) return null;

  const squareOps = [{ op: "burn", key: destName }];
  const cached = roomMap?.[destName];
  if (!cached) return { cached: false, squareOps };

  const day = Math.floor(state.time / 24);
  const square = readArrivalSquare(squares?.[destName], day);
  const arrivalDesc = square.desc || destNode.desc;
  const gridNpcs = [...(cached.npcs || [])];
  const logs = [
    { t: "room", text: "" },
    { t: "room", text: `    ${destName}` },
    { t: "room", text: "" },
    { t: "desc", text: `  ${arrivalDesc}` },
  ];
  const gainedItem = square.item ? makeGameItem(square.item) : null;
  if (gainedItem) {
    logs.push({
      t: "item",
      text: `  ${square.findLine ? `${square.findLine}  ` : ""}✓ 你拾得「${square.item.name}」，收入行囊。`,
    });
  }

  if (square.encounter) {
    const encounter = square.encounter;
    gridNpcs.push(ensureNpcCombatData({
      name: encounter.name,
      id: encounter.id,
      brief: encounter.brief,
      levelCap: Math.max(0, QUALITY.indexOf(encounter.tier || "白")),
    }, { luck: state.char?.special?.气运 ?? 5 }));
    if (encounter.line) logs.push({ t: "desc", text: `  ${encounter.line}` });
  }

  const newFaces = detectNewFaces(state.varTree || {}, gridNpcs).map((npc) => npc.name);
  logs.push(...newFaces.map((name) => ({
    t: "sys",
    text: `  ※ 新人物出现：${name}（点击可细看其人）`,
  })));

  const changes = {
    room: {
      name: destName,
      desc: arrivalDesc,
      exits: Object.keys(destNode.exits),
      npcs: gridNpcs,
      items: [...(cached.items || [])],
    },
    time: (previous) => previous + 1,
    convo: [
      ...(state.convo || []),
      { role: "user", content: command },
      { role: "assistant", content: arrivalDesc.slice(0, 500) },
    ],
    varTree: (previous) => {
      const latest = previous || {};
      const withNewFaces = newFaces.length ? markAsSeen(latest, newFaces) : latest;
      return updateLastSeen(withNewFaces, gridNpcs.map((npc) => npc.name), state.time);
    },
  };
  if (gainedItem) changes.inv = (previous) => [...(previous || []), gainedItem];
  if (!state.mapData?.[destName]) {
    changes.mapData = (previous) => {
      const latest = previous || {};
      return latest[destName] ? latest : {
        ...latest,
        [destName]: { x: destNode.x, y: destNode.y },
      };
    };
  }
  squareOps[0] = { op: "consume", key: destName, day };

  return {
    cached: true,
    changes,
    logs,
    squareOps,
    traceInfo: {
      direction,
      hasSquareDesc: !!square.desc,
      item: square.item,
      encounter: square.encounter,
    },
  };
}
