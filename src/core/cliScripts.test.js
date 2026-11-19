import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exportSave } from "../saves.js";
import { loadSquares, serializeSquares } from "../mapSquares.js";
import { createSession, runScript } from "../../cli/runner.mjs";
import { getRngState, random, setSeed } from "./rng.js";
import { createMockAi, createReplayAi } from "../engine/ports/ai.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const scriptsDir = resolve(projectRoot, "tests/cli");
const scriptFiles = readdirSync(scriptsDir).filter((file) => file.endsWith(".txt") && file !== "ai-turn-rollback.txt").sort();

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
    const ai = file === "ai-turn.txt"
      ? createMockAi(JSON.parse(readFileSync(join(scriptsDir, "ai-turn-replies.json"), "utf8")))
      : { chat: async () => ({ text: '{"output":["测试结算完成"]}' }) };
    const failures = await runScript(readFileSync(join(scriptsDir, file), "utf8"), {
      out: (text) => output.push(text),
      cwd: tempDir,
      ai,
    });

    expect(failures, output.join("\n")).toBe(0);
    if (file === "ai-turn.txt") {
      expect(output.join("\n")).toContain("石阶旁的草叶轻轻摇动。");
      const replayOutput = [];
      const entries = readFileSync(join(scriptsDir, "ai-turn-replay.jsonl"), "utf8")
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
      const replayFailures = await runScript(readFileSync(join(scriptsDir, file), "utf8"), {
        out: (text) => replayOutput.push(text),
        cwd: tempDir,
        ai: createReplayAi(entries),
      });
      expect(replayFailures, replayOutput.join("\n")).toBe(0);
      expect(replayOutput.join("\n")).toContain("石阶旁的草叶轻轻摇动。");
    }
  });

  it("runs a script with sibling replies using the default mock AI", () => {
    const output = execFileSync(process.execPath, [
      resolve(projectRoot, "cli/qucuo.mjs"),
      "--script",
      "tests/cli/ai-turn.txt",
    ], { cwd: projectRoot, encoding: "utf8" });

    expect(output).toContain("石阶旁的草叶轻轻摇动。");
  });

  it("restores :state and the seeded RNG sequence after a malformed CLI turn", async () => {
    const output = [];
    const script = readFileSync(join(scriptsDir, "ai-turn-rollback.txt"), "utf8");
    const failures = await runScript(script, {
      out: (text) => output.push(text),
      cwd: tempDir,
      ai: createMockAi(JSON.parse(readFileSync(join(scriptsDir, "ai-turn-rollback-replies.json"), "utf8"))),
    });
    const states = output.filter((line) => line.startsWith("room.name:"));

    expect(failures).toBe(1);
    expect(states).toHaveLength(2);
    expect(states[0]).toBe(states[1]);
    const actual = Array.from({ length: 5 }, () => random());
    setSeed(123);
    expect(actual).toEqual(Array.from({ length: 5 }, () => random()));
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

  it("resumes the saved random sequence even when an NPC needs backfilling", async () => {
    const session = createSession({ out: () => {}, cwd: tempDir, seed: 42 });
    await session.runLine(":new");
    random();
    const checkpoint = getRngState();
    await session.runLine(":save seeded.json");
    const expected = Array.from({ length: 5 }, () => random());

    const path = join(tempDir, "seeded.json");
    const snapshot = JSON.parse(readFileSync(path, "utf8"));
    expect(snapshot.rngState).toBe(checkpoint);
    delete snapshot.room.npcs[0].special;
    writeFileSync(path, JSON.stringify(snapshot), "utf8");

    await session.runLine(":seed 7");
    await session.runLine(":load seeded.json");
    expect(session.store.getState().room.npcs[0].special).toBeDefined();
    expect(getRngState()).toBe(checkpoint);
    expect(Array.from({ length: 5 }, () => random())).toEqual(expected);
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

  it("loads a legacy snapshot without squares or RNG state", async () => {
    const session = createSession({ out: () => {}, cwd: tempDir, seed: 42 });
    await session.runLine(":new");
    await session.runLine(":save current.json");
    const legacySnapshot = JSON.parse(readFileSync(join(tempDir, "current.json"), "utf8"));
    delete legacySnapshot.squares;
    delete legacySnapshot.rngState;
    legacySnapshot.time = 9;
    writeFileSync(join(tempDir, "legacy.json"), JSON.stringify(legacySnapshot), "utf8");
    loadSquares({ stale: { day: 1, desc: "stale square" } });

    await session.runLine(":load legacy.json");

    expect(session.store.getState().time).toBe(9);
    expect(serializeSquares()).toEqual({});
    expect(getRngState()).toBe(42);
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

  it("restores the round snapshot when the AI reply is malformed", async () => {
    const output = [];
    const session = createSession({
      out: (text) => output.push(text),
      cwd: tempDir,
      ai: createMockAi(["{not json}"]),
    });
    await session.runLine(":new");
    const before = structuredClone(session.store.getState());

    expect(await session.runLine("探索石阶")).toBe(1);
    expect(session.store.getState()).toEqual(before);
    expect(output.at(-1)).toContain("AI reply format is invalid");
  });
});
