import { afterEach, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSession } from "../../cli/runner.mjs";
import { createMockAi, createRecordingAi, createReplayAi } from "../engine/ports/ai.js";
import { QUCUO_QUESTS } from "../domain/quests/qucuoQuests.js";
import { gameStore } from "./gameStore.js";

let directory;
afterEach(() => { if (directory) rmSync(directory, { recursive: true, force: true }); });

it("records and replays the seeded opening leopard quest without a second unlock", async () => {
  directory = mkdtempSync(join(tmpdir(), "snow-leopard-cli-"));
  const script = readFileSync(new URL("../../tests/cli/snow-leopard-quest.txt", import.meta.url), "utf8");
  const replies = JSON.parse(readFileSync(new URL("../../tests/cli/snow-leopard-quest-replies.json", import.meta.url), "utf8"));
  const recorded = [];
  const ai = createRecordingAi(createMockAi(replies), (entry) => recorded.push(entry));
  for (const backend of [ai, createReplayAi(recorded)]) {
    const output = [];
    const session = createSession({ cwd: directory, ai: backend, out: (line) => output.push(line) });
    for (const line of script.split(/\r?\n/)) {
      expect(await session.runLine(line), output.join("\n")).toBe(0);
      if (line === ":new") {
        expect(QUCUO_QUESTS[0].id).toBe("snow_leopard_quest");
        expect(Object.keys(gameStore.getState().questProgress)[0]).toBe("snow_leopard_quest");
      }
    }
    const once = JSON.parse(readFileSync(join(directory, "snow-leopard-once.json"), "utf8"));
    const twice = JSON.parse(readFileSync(join(directory, "snow-leopard-twice.json"), "utf8"));
    expect(twice.companionState).toEqual(once.companionState);
    expect(twice.rngState).toBe(once.rngState);
    expect(twice.flags.filter((flag) => flag === "snow_leopard_invited")).toHaveLength(1);
  }
  expect(recorded).toHaveLength(4);
  expect(JSON.stringify(recorded[0].request)).toContain("snow_spirit_meat");
  expect(JSON.stringify(recorded[1].request)).toContain("snow_spirit_scratch");
});
