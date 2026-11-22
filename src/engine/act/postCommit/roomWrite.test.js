// 地名标题「— 地名 —」：类型必须是 room、要排在本轮正文之前（e8f6f57 误写成 "d.room" 的回归）
// 路线甲纯函数化：处理器只返回结果描述，落盘一律经 applyPostResult。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { emitRoomHeader, roomHeaderName, writeRoom } from "./roomWrite.js";
import { applyPostResult } from "./applyPostResult.js";
import { QUCUO_MAP } from "../../../domain/data/map/qucuoMap.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXED = Object.keys(QUCUO_MAP)[0];

function ctx(over = {}) {
  const logs = [];
  return {
    logs,
    d: {
      addLog: (l) => logs.push(...l),
      ...over,
    },
    in: {
      isTalk: false,
      lockedDestName: null,
      room: { name: "野外某处" },
      p: { room: null },
      ...over,
    },
  };
}

describe("emitRoomHeader", () => {
  it("returns three room entries for a locked destination", () => {
    const { d, logs } = ctx();
    applyPostResult(d, emitRoomHeader({ isTalk: false, lockedDestName: "喇嘛庙", p: { room: null }, room: { name: "野外某处" } }));
    expect(logs).toEqual([{ t: "room", text: "" }, { t: "room", text: "    喇嘛庙" }, { t: "room", text: "" }]);
  });

  it("uses the AI room name only off the fixed map and only when it changed", () => {
    const base = { isTalk: false, lockedDestName: null };
    expect(roomHeaderName({ ...base, p: { room: { name: "熊曲山谷" } }, room: { name: "野外某处" } })).toBe("熊曲山谷");
    expect(roomHeaderName({ ...base, p: { room: { name: "野外某处" } }, room: { name: "野外某处" } })).toBeNull();
    expect(roomHeaderName({ ...base, p: { room: { name: "别处" } }, room: { name: FIXED } })).toBeNull();
  });

  it("returns nothing on talk turns", () => {
    expect(emitRoomHeader({ isTalk: true, lockedDestName: "喇嘛庙", p: { room: null }, room: { name: "野外某处" } })).toBeNull();
  });

  it("writeRoom itself returns no logs", () => {
    const out = writeRoom({
      isTalk: false, lockedDestName: null, p: { room: { name: "熊曲山谷" } },
      room: { name: "野外某处", npcs: [] }, roomMap: {}, outerDepart: null,
      mapData: {}, pendDir: null, freshNpcData: undefined,
    }, { traceStep: () => {} });
    expect(out.logs).toBeUndefined();
    expect(out.insertLogs).toBeUndefined();
  });

  it("insertLogs lands after the cmd echo even when prose was logged first", () => {
    // 双调用模式：runTurn 在 commitRound 之前就把正文 addLog 了——标题必须插入，
    // 追加只会落在正文后面（Devin Review 抓到的排序 bug 回归）。
    const { d, logs } = ctx({
      setLog: (fn) => { const next = fn(logs); logs.length = 0; logs.push(...next); },
    });
    logs.push({ t: "cmd", text: "> 北" }, { t: "desc", text: "  旁白正文" });
    applyPostResult(d, emitRoomHeader({ isTalk: false, lockedDestName: "喇嘛庙", p: { room: null }, room: { name: "野外某处" } }));
    const headerIdx = logs.findIndex((l) => l.t === "room" && l.text.includes("喇嘛庙"));
    expect(headerIdx).toBeGreaterThan(0);
    expect(headerIdx).toBeLessThan(logs.findIndex((l) => l.text.includes("旁白正文")));
  });

  it("without setLog, insertLogs falls back to append", () => {
    const { d, logs } = ctx();
    logs.push({ t: "cmd", text: "> 北" });
    applyPostResult(d, emitRoomHeader({ isTalk: false, lockedDestName: "喇嘛庙", p: { room: null }, room: { name: "野外某处" } }));
    expect(logs[logs.length - 1].t).toBe("room");
  });

  it("commitRound emits the header before the narrative", () => {
    const src = readFileSync(join(HERE, "..", "commitRound.js"), "utf-8");
    const header = src.indexOf("emitRoomHeader(");
    const narrative = src.indexOf("emitNarrative(");
    expect(header).toBeGreaterThan(-1);
    expect(header).toBeLessThan(narrative);
  });

  it("no log entry type is spelled with a d. prefix anywhere in the act pipeline", () => {
    const src = readFileSync(join(HERE, "roomWrite.js"), "utf-8");
    expect(src).not.toMatch(/t:\s*"d\./);
  });
});

describe("writeRoom 首次到访不把出发房间的人带过来", () => {
  it("AI 写某人跟来，系统不采纳；新出现的路人照常保留", () => {
    const out = writeRoom({
      isTalk: false, lockedDestName: FIXED, roomMap: {}, outerDepart: null, mapData: {}, pendDir: null, freshNpcData: new Map(),
      room: { name: "出发地", npcs: [{ name: "老孙" }] },
      p: { room: { name: FIXED, npcs: [{ name: "老孙" }, { name: "路人甲" }] } },
    }, { traceStep: () => {} });
    expect(out.changes.room.npcs.map((n) => n.name)).toEqual(["路人甲"]);
  });
});

describe("writeRoom 原地互动只改写本房间的地上物", () => {
  it("AI 报的地上物名单不会抹掉别的内层房间的东西", () => {
    const district = Object.keys(QUCUO_MAP).find((name) => name === "顶峰");
    const out = writeRoom({
      isTalk: false, lockedDestName: null, roomMap: {}, outerDepart: null, mapData: {}, pendDir: null, freshNpcData: new Map(),
      room: { name: district, npcs: [] }, innerRoomName: "峰道入口",
      p: { room: { desc: "风雪", items: [{ name: "冻硬的旧经幡" }] } },
    }, { traceStep: () => {} });
    const next = out.changes.room({ name: district, npcs: [], items: [{ name: "霜天月", innerRoom: "雪山崖底" }] });
    expect(next.items.map((item) => item.name)).toEqual(["霜天月", "冻硬的旧经幡"]);
    expect(next.items[1].innerRoom).toBe("峰道入口");
  });
});

