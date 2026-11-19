import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runScript } from "../../cli/runner.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const scriptsDir = resolve(projectRoot, "tests/cli");
const scriptFiles = readdirSync(scriptsDir).filter((file) => file.endsWith(".txt")).sort();

let tempDir;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "qucuo-cli-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
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
});
