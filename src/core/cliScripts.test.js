import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exportSave } from "../saves.js";
import { loadSquares, serializeSquares } from "../mapSquares.js";
import { createSession, runScript } from "../../cli/runner.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const scriptsDir = resolve(projectRoot, "tests/cli");
const scriptFiles = readdirSync(scriptsDir).filter((file) => file.endsWith(".txt")).sort();

let tempDir;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "qucuo-cli-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  loadSquares({});
});

describe("CLI scripts", () => {
  it.each(scriptFiles)("%s", async (file) => {
    const output = [];
    const failures = await runScript(readFileSync(join(scriptsDir, file), "utf8"), {
      out: (text) => output.push(text),
      cwd: tempDir,
    });

    expect(failures, output.join("\n")).toBe(0);
  });

  it("round-trips a non-current district roomMap entry with its NPC and ground item", async () => {
    const session = createSession({ out: () => {}, cwd: tempDir });
    const roomEntry = {
      npcs: [{ id: "npc_old_hunter", name: "老猎户" }],
      items: [{ id: "ground_amulet", name: "落地玉佩" }],
    };
    await session.runLine(":new");
    session.roomMap = { 曲措乡: roomEntry };
    await session.runLine(":save original.json");
    await session.runLine(":new");
    await session.runLine(":load original.json");
    await session.runLine(":save round-trip.json");

    const snapshot = JSON.parse(readFileSync(join(tempDir, "round-trip.json"), "utf8"));
    expect(session.store.getState().room.name).toBe("鱼定村");
    expect(snapshot.roomMap).toEqual({ 曲措乡: roomEntry });
  });

  it("loads browser-export-wrapped saves", async () => {
    const session = createSession({ out: () => {}, cwd: tempDir });
    await session.runLine(":new");
    await session.runLine(":set time=23");
    await session.runLine(":save snapshot.json");
    const snapshot = JSON.parse(readFileSync(join(tempDir, "snapshot.json"), "utf8"));
    writeFileSync(join(tempDir, "browser-export.json"), exportSave(snapshot, "浏览器导出"), "utf8");

    await session.runLine(":new");
    await session.runLine(":load browser-export.json");

    expect(session.store.getState().time).toBe(23);
  });

  it("clears loaded squares when starting a new game", async () => {
    const session = createSession({ out: () => {}, cwd: tempDir });
    const savedSquares = { 鱼定村: { day: 2, desc: "saved square" } };
    await session.runLine(":new");
    loadSquares(savedSquares);
    await session.runLine(":save squares.json");
    loadSquares({});
    await session.runLine(":load squares.json");
    expect(serializeSquares()).toEqual(savedSquares);

    await session.runLine(":new");

    expect(serializeSquares()).toEqual({});
  });

  it("clears prior squares when loading a legacy snapshot without squares", async () => {
    const session = createSession({ out: () => {}, cwd: tempDir });
    await session.runLine(":new");
    await session.runLine(":save current.json");
    const legacySnapshot = JSON.parse(readFileSync(join(tempDir, "current.json"), "utf8"));
    delete legacySnapshot.squares;
    writeFileSync(join(tempDir, "legacy.json"), JSON.stringify(legacySnapshot), "utf8");
    loadSquares({ stale: { day: 1, desc: "stale square" } });

    await session.runLine(":load legacy.json");

    expect(serializeSquares()).toEqual({});
  });

  it("does not import caches from rejected saves", async () => {
    const session = createSession({ out: () => {}, cwd: tempDir });
    await session.runLine(":new");
    await session.runLine(":save current.json");
    const rejectedSnapshot = JSON.parse(readFileSync(join(tempDir, "current.json"), "utf8"));
    rejectedSnapshot.char = { hp: [1, 1] };
    rejectedSnapshot.roomMap = {
      雅江: {
        npcs: [{ id: "rejected_npc", name: "拒收人物" }],
        items: [{ id: "rejected_item", name: "拒收物品" }],
      },
    };
    rejectedSnapshot.squares = { 雅江: { day: 1, desc: "拒收格子" } };
    writeFileSync(join(tempDir, "rejected.json"), JSON.stringify(rejectedSnapshot), "utf8");

    await session.runLine(":load rejected.json");
    await session.runLine(":save after-rejection.json");

    const snapshot = JSON.parse(readFileSync(join(tempDir, "after-rejection.json"), "utf8"));
    expect(snapshot.roomMap).toEqual({});
    expect(snapshot.squares).toEqual({});
  });
});
