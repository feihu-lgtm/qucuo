import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import * as quests from "../quests/qucuoQuests.js";
import * as items from "../items/catalog.js";
import { RESIDENT_NPCS } from "../npc/residentNpcs.js";
import { INNER_MAP } from "../map/innerMap.js";
import { SNOW_LEOPARD_QUEST } from "../quests/snowLeopardQuest.js";
import { all, get } from "./registry.js";

// Captured from main before extraction; the original data contains no functions.
const original = JSON.parse(readFileSync(new URL("./original-content.json", import.meta.url), "utf8"));
const current = { ...quests, ...items, RESIDENT_NPCS, INNER_MAP };

describe("default content compatibility", () => {
  it.each(Object.keys(original))("preserves %s values and every key/array position", (name) => {
    expect(current[name]).toEqual(original[name]);
    expect(JSON.stringify(current[name])).toBe(JSON.stringify(original[name]));
  });

  it("uses registry definitions, including the separately exported snow quest", () => {
    expect(SNOW_LEOPARD_QUEST).toBe(quests.QUCUO_QUESTS[0]);
    expect(quests.QUCUO_QUESTS).toEqual(all("quest"));
    for (const item of items.CATALOG) expect(item).toBe(get("item", item.name));
    for (const [id, district] of Object.entries(INNER_MAP)) expect(district).toBe(get("district", id));
    for (const [id, npcs] of Object.entries(RESIDENT_NPCS)) expect(npcs).toBe(get("residentGroup", id));
  });

  it.each([
    ["quests/qucuoQuests.js", "QUCUO_QUESTS"],
    ["items/catalog.js", "CATALOG_INDEX"],
    ["npc/residentNpcs.js", "RESIDENT_NPCS"],
    ["map/innerMap.js", "INNER_MAP"],
    ["quests/snowLeopardQuest.js", "SNOW_LEOPARD_QUEST"],
  ])("initializes %s in isolation without a startup import", (path, name) => {
    const url = new URL(`../${path}`, import.meta.url).href;
    const output = execFileSync(process.execPath, ["--input-type=module", "-e",
      `import { ${name} } from ${JSON.stringify(url)}; process.stdout.write(JSON.stringify(${name}));`,
    ], { encoding: "utf8" });
    const expected = name === "SNOW_LEOPARD_QUEST" ? original.QUCUO_QUESTS[0] : original[name];
    expect(output).toBe(JSON.stringify(expected));
  });
});
