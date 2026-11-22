import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { QUCUO_QUESTS } from "../../data/quests/qucuoQuests.js";
import { RESIDENT_NPCS } from "../../data/npc/residentNpcs.js";
import { NPC_POOL } from "../../data/npc/npcPool.js";

// 战斗档位只认 0~5（白绿蓝紫橙红）；写超了属性会按红档、招式却落回白档。
const inRange = (value) => Number.isInteger(value) && value >= 0 && value <= 5;

function collectLevelCaps(node, path, out) {
  if (Array.isArray(node)) node.forEach((child, index) => collectLevelCaps(child, `${path}[${index}]`, out));
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "levelCap") out.push({ path: `${path}.levelCap`, value });
      else collectLevelCaps(value, `${path}.${key}`, out);
    }
  }
  return out;
}

const SRC = join(import.meta.dirname, "../../..");
function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(js|jsx)$/.test(name) && !/\.test\.jsx?$/.test(name) ? [full] : [];
  });
}

describe("战斗档位 levelCap 只能是 0~5", () => {
  it("任务战斗、驻地人物、游走池里的 levelCap 都在 0~5", () => {
    const caps = [
      ...collectLevelCaps(QUCUO_QUESTS, "quests", []),
      ...collectLevelCaps(RESIDENT_NPCS, "residents", []),
      ...collectLevelCaps(NPC_POOL, "npcPool", []),
    ];
    expect(caps.length).toBeGreaterThan(50);
    expect(caps.filter((cap) => !inRange(cap.value))).toEqual([]);
  });

  it("源码里写死的 levelCap 字面量都在 0~5", () => {
    const bad = sourceFiles(SRC).flatMap((file) => [...readFileSync(file, "utf8").matchAll(/levelCap:\s*(\d+)/g)]
      .filter((match) => !inRange(Number(match[1])))
      .map((match) => `${relative(SRC, file)}: ${match[0]}`));
    expect(bad).toEqual([]);
  });
});
