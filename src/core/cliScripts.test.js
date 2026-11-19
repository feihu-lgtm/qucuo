import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exportSave } from "../saves.js";
import { loadSquares, serializeSquares } from "../mapSquares.js";
import { createSession, runScript } from "../../cli/runner.mjs";
import { getRngState, random, setSeed } from "./rng.js";
import { createMockAi, createRecordingAi, createReplayAi } from "../engine/ports/ai.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const scriptsDir = resolve(projectRoot, "tests/cli");
const scriptFiles = readdirSync(scriptsDir)
  .filter((file) => file.endsWith(".txt") && ![
    "ai-turn-rollback.txt",
    "failed-inspection-pending-turn.txt",
    "outer-arrival.txt",
    "uncached-arrival-failure.txt",
  ].includes(file))
  .sort();

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
    const repliesFile = `${file.slice(0, -4)}-replies.json`;
    const ai = existsSync(join(scriptsDir, repliesFile))
      ? createMockAi(JSON.parse(readFileSync(join(scriptsDir, repliesFile), "utf8")))
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

  it("moves between cached outer squares and restores the room after save/load", async () => {
    const output = [];
    const session = createSession({ out: (text) => output.push(text), cwd: tempDir });

    let failures = 0;
    const fixture = readFileSync(join(scriptsDir, "outer-arrival.txt"), "utf8");
    for (const line of fixture.split(/\r?\n/)) {
      failures += await session.runLine(line);
    }

    expect(failures, output.join("\n")).toBe(0);
    expect(session.store.getState().room.name).toBe("鱼定村");
    expect(session.roomMap).toEqual({
      大草甸: { npcs: [], items: [] },
      鱼定村: { npcs: [], items: [] },
    });
    expect(serializeSquares().鱼定村).toMatchObject({ day: 0, desc: "鱼定村缓存" });
    expect(session.store.getState().innerRoomName).toBe("歇马居");
    expect(session.store.getState().log.filter((entry) => entry.t === "cmd" && entry.text === "> 走 北")).toHaveLength(1);
  });

  it("prints initialization guidance instead of throwing when movement has no room", async () => {
    const output = [];
    const session = createSession({ out: (text) => output.push(text), cwd: tempDir });
    await session.runLine(":set room=null");

    expect(await session.runLine("走 东")).toBe(1);
    expect(output.join("\n")).toContain("尚未开始游戏，请先执行 :new 或 :load 初始化游戏。");
  });

  it("keeps an uncached square claimable after the CLI turn fails", async () => {
    const output = [];
    const failures = await runScript(
      readFileSync(join(scriptsDir, "uncached-arrival-failure.txt"), "utf8"),
      {
        out: (text) => output.push(text),
        cwd: tempDir,
        ai: createMockAi(["{not json}"]),
      },
    );
    const saved = JSON.parse(readFileSync(join(tempDir, "uncached-failure.json"), "utf8"));

    expect(failures).toBe(1);
    expect(output.join("\n")).toContain("AI reply format is invalid");
    expect(saved.room.name).toBe("鱼定村");
    expect(saved.squares.雅江).toMatchObject({
      item: { name: "雪山当归" },
      itemTaken: false,
      burned: false,
    });
  });

  it("sends a pigeon letter and processes its arrival after time advances", async () => {
    const output = [];
    const session = createSession({ out: (text) => output.push(text), cwd: tempDir });
    const fixture = readFileSync(join(scriptsDir, "pigeon-arrival.txt"), "utf8");
    let failures = 0;
    for (const line of fixture.split(/\r?\n/)) {
      failures += await session.runLine(line);
    }

    expect(failures, output.join("\n")).toBe(0);
    expect(session.store.getState().char.pigeons).toBe(0);
    expect(session.pigeonArrivals).toEqual([
      expect.objectContaining({
        id: "letter_send_商人_6",
        npcName: "商人",
        arriveTime: 8,
      }),
    ]);
  });

  it("runs world rules after time advances, room entry, and save/load deterministically", async () => {
    const fixture = readFileSync(join(scriptsDir, "world-rules.txt"), "utf8");
    const runFixture = async () => {
      const output = [];
      const session = createSession({
        out: (text) => output.push(text),
        cwd: tempDir,
        seed: 42,
      });
      let failures = 0;
      for (const line of fixture.split(/\r?\n/)) failures += await session.runLine(line);
      const saved = JSON.parse(readFileSync(join(tempDir, "world-rules.json"), "utf8"));
      return {
        failures,
        output,
        residents: session.store.getState().room.npcs.map((npc) => npc.name),
        savedResidents: saved.room.npcs.map((npc) => npc.name),
      };
    };

    const first = await runFixture();
    loadSquares({});
    const second = await runFixture();

    expect(first.failures, first.output.join("\n")).toBe(0);
    expect(second.failures, second.output.join("\n")).toBe(0);
    expect(first.residents).toEqual(first.savedResidents);
    expect(second.residents).toEqual(second.savedResidents);
    expect(second.residents).toEqual(first.residents);
    expect(first.residents.length).toBeGreaterThan(0);
    expect(first.residents).toContain("才旦");
  });

  it("loads legacy in-flight pigeon letters from a save", async () => {
    const session = createSession({ out: () => {}, cwd: tempDir });
    const legacyLetter = {
      id: "legacy-letter",
      npcName: "商人",
      sentContent: "请回信",
      arriveTime: 2,
      npcLoc: "鱼定村",
    };
    await session.runLine(":new");
    await session.runLine(`:set varTree.世界.飞鸽待回=${JSON.stringify([legacyLetter])}`);
    await session.runLine(":set time=2");
    await session.runLine(":save legacy-pigeon.json");
    await session.runLine(":new");
    await session.runLine(":load legacy-pigeon.json");

    expect(session.store.getState().varTree.世界.飞鸽待回).toEqual([legacyLetter]);
    expect(session.pigeonArrivals).toEqual([legacyLetter]);
  });

  it("runs a script with sibling replies using the default mock AI", () => {
    const output = execFileSync(process.execPath, [
      resolve(projectRoot, "cli/qucuo.mjs"),
      "--script",
      "tests/cli/ai-turn.txt",
    ], { cwd: projectRoot, encoding: "utf8" });

    expect(output).toContain("石阶旁的草叶轻轻摇动。");
  });

  it("includes the selected NPC in a CLI conversation prompt", async () => {
    const output = [];
    const recorded = [];
    const ai = createRecordingAi(
      createMockAi(JSON.parse(readFileSync(join(scriptsDir, "npc-talk-target-replies.json"), "utf8"))),
      (entry) => recorded.push(entry),
    );
    const failures = await runScript(readFileSync(join(scriptsDir, "npc-talk-target.txt"), "utf8"), {
      out: (text) => output.push(text),
      cwd: tempDir,
      ai,
    });

    expect(failures, output.join("\n")).toBe(0);
    expect(JSON.stringify(recorded.map(({ request }) => request)))
      .toContain("[交互目标] 玩家选定了「商人」作为本轮唯一的互动对象");
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

  it("does not reuse a failed inspection status for the next local command", async () => {
    const output = [];
    const failures = await runScript(
      readFileSync(join(scriptsDir, "failed-inspection-pending-turn.txt"), "utf8"),
      {
        out: (text) => output.push(text),
        cwd: tempDir,
        ai: createMockAi(JSON.parse(readFileSync(join(scriptsDir, "failed-inspection-pending-turn-replies.json"), "utf8"))),
      },
    );

    expect(failures).toBe(1);
    expect(output.join("\n")).toContain("✓ time");
  });
});
