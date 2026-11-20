import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runScript } from "../../cli/runner.mjs";

const fixture = join(dirname(fileURLToPath(import.meta.url)), "carriage-roster.txt");
let tempDir;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "qucuo-cli-carriage-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("CLI carriage room cache", () => {
  it("restores the preset merchant and caches the departing room", async () => {
    const output = [];
    const failures = await runScript(readFileSync(fixture, "utf8"), {
      out: (text) => output.push(text),
      cwd: tempDir,
    });
    const saved = JSON.parse(readFileSync(join(tempDir, "carriage-roster.json"), "utf8"));
    const npcNames = (npcs) => (npcs || []).map((npc) => npc.name);

    expect(failures, output.join("\n")).toBe(0);
    expect(saved.room.name).toBe("鱼定村");
    expect(npcNames(saved.room.npcs)).toContain("杂货商人");
    expect(npcNames(saved.roomMap.鱼定村.npcs)).toContain("杂货商人");
    expect(saved.roomMap.雅江).toEqual({
      items: expect.any(Array),
      npcs: expect.any(Array),
    });
  });
});
