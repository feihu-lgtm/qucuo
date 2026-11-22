// 地名标题「— 地名 —」：类型必须是 room、要排在本轮正文之前（e8f6f57 误写成 "d.room" 的回归）
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { emitRoomHeader, roomHeaderName, writeRoom } from "./roomWrite.js";
import { QUCUO_MAP } from "../../../domain/data/map/qucuoMap.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXED = Object.keys(QUCUO_MAP)[0];

function ctx(over = {}) {
  const logs = [];
  return {
    logs,
    d: {
      isTalk: false,
      lockedDestName: null,
      room: { name: "野外某处" },
      p: { room: null },
      addLog: (l) => logs.push(...l),
      ...over,
    },
  };
}

describe("emitRoomHeader", () => {
  it("writes three room entries for a locked destination", () => {
    const { d, logs } = ctx({ lockedDestName: "喇嘛庙" });
    emitRoomHeader(d);
    expect(logs).toEqual([{ t: "room", text: "" }, { t: "room", text: "    喇嘛庙" }, { t: "room", text: "" }]);
  });

  it("uses the AI room name only off the fixed map and only when it changed", () => {
    expect(roomHeaderName(ctx({ p: { room: { name: "熊曲山谷" } } }).d)).toBe("熊曲山谷");
    expect(roomHeaderName(ctx({ p: { room: { name: "野外某处" } } }).d)).toBeNull();
    expect(roomHeaderName(ctx({ room: { name: FIXED }, p: { room: { name: "别处" } } }).d)).toBeNull();
  });

  it("writes nothing on talk turns", () => {
    const { d, logs } = ctx({ isTalk: true, lockedDestName: "喇嘛庙" });
    emitRoomHeader(d);
    expect(logs).toEqual([]);
  });

  it("writeRoom itself no longer adds header logs", () => {
    const { d, logs } = ctx({ p: { room: { name: "熊曲山谷" } }, setRoom: () => {}, roomMapRef: { current: {} }, pendDirRef: { current: null }, mapData: {}, setMapData: () => {} });
    writeRoom(d, { traceStep: () => {} });
    expect(logs).toEqual([]);
  });

  it("commitRound emits the header before the narrative", () => {
    const src = readFileSync(join(HERE, "..", "commitRound.js"), "utf-8");
    const header = src.indexOf("emitRoomHeader(d);");
    const narrative = src.indexOf("emitNarrative(d);");
    expect(header).toBeGreaterThan(-1);
    expect(header).toBeLessThan(narrative);
  });

  it("no log entry type is spelled with a d. prefix anywhere in the act pipeline", () => {
    const src = readFileSync(join(HERE, "roomWrite.js"), "utf-8");
    expect(src).not.toMatch(/t:\s*"d\./);
  });
});
