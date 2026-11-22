import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

const run = (...args) => spawnSync(process.execPath, ["cli/npc-conflict.mjs", ...args], { encoding: "utf8" });

it("replays a conflict offline and reports both factions' baseline tension", () => {
  const args = ["--side-a", "resident_basang", "--side-b", "resident_gesangdunzhu", "--seed", "42"];
  const first = run(...args);
  expect(first.status, first.stderr).toBe(0);
  expect(JSON.parse(first.stdout)).toMatchObject({
    seed: 42, factions: [["黑风寨"], ["鱼定土司府"]], tension: 60,
  });
  expect(run(...args).stdout).toBe(first.stdout);
});

it("rejects missing seeds and unknown participants", () => {
  expect(run().status).toBe(1);
  const unknown = run("--seed", "42", "--side-a", "unknown", "--side-b", "resident_basang");
  expect(unknown.status).toBe(1);
  expect(unknown.stderr).toContain("没有这个内置 NPC");
});
