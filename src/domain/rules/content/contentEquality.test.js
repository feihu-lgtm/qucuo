import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as quests from "../../data/quests/qucuoQuests.js";
import * as items from "../../data/items/catalog.js";
import { RESIDENT_NPCS } from "../../data/npc/residentNpcs.js";
import { INNER_MAP } from "../map/innerMap.js";
import { SNOW_LEOPARD_QUEST } from "../quests/snowLeopardQuest.js";
import { allContent, getContent } from "./registry.js";

const original = JSON.parse(readFileSync(new URL("./original-fingerprints.json", import.meta.url), "utf8"));
const current = { ...quests, ...items, RESIDENT_NPCS, INNER_MAP, SNOW_LEOPARD_QUEST };

const sha256 = data => createHash("sha256").update(JSON.stringify(data)).digest("hex");

// Count object fields recursively, excluding array indices; original data has no functions.
function totalFieldCount(data) {
  if (typeof data === "function") throw new Error("Function in content");
  if (data === null || typeof data !== "object") return 0;
  return (Array.isArray(data) ? 0 : Object.keys(data).length)
    + Object.values(data).reduce((sum, value) => sum + totalFieldCount(value), 0);
}

function fingerprint(data) {
  const ids = Array.isArray(data) ? data.map(entry => entry.id ?? entry.name) : Object.keys(data);
  return {
    entryCount: ids.length,
    ...(ids.length <= 20 ? { orderedIds: ids } : { orderedIdsSha256: sha256(ids) }),
    totalFieldCount: totalFieldCount(data),
    jsonSha256: sha256(data),
  };
}

describe("default content compatibility", () => {
  it.each(Object.keys(original.exports))("preserves %s values and every key/array position", (name) => {
    expect(fingerprint(current[name])).toEqual(original.exports[name]);
  });

  it("uses registry definitions, including the separately exported snow quest", () => {
    expect(SNOW_LEOPARD_QUEST).toBe(quests.QUCUO_QUESTS[0]);
    expect(quests.QUCUO_QUESTS).toEqual(allContent("quest"));
    for (const item of items.CATALOG) expect(item).toBe(getContent("item", item.name));
    for (const [id, district] of Object.entries(INNER_MAP)) expect(district).toBe(getContent("district", id));
    for (const [id, npcs] of Object.entries(RESIDENT_NPCS)) expect(npcs).toBe(getContent("residentGroup", id));
  });

  it.each([
    ["data/quests/qucuoQuests.js", "QUCUO_QUESTS"],
    ["data/items/catalog.js", "CATALOG_INDEX"],
    ["data/npc/residentNpcs.js", "RESIDENT_NPCS"],
    ["rules/map/innerMap.js", "INNER_MAP"],
    ["rules/quests/snowLeopardQuest.js", "SNOW_LEOPARD_QUEST"],
  ])("initializes %s in isolation without a startup import", (path, name) => {
    const url = new URL(`../../${path}`, import.meta.url).href;
    const output = execFileSync(process.execPath, ["--input-type=module", "-e",
      `import { ${name} } from ${JSON.stringify(url)}; process.stdout.write(JSON.stringify(${name}));`,
    ], { encoding: "utf8" });
    expect(fingerprint(JSON.parse(output))).toEqual(original.exports[name]);
  });
});
