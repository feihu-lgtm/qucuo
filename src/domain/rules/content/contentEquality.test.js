import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import * as quests from "../../data/quests/qucuoQuests.js";
import * as items from "../../data/items/catalog.js";
import { RESIDENT_NPCS } from "../../data/npc/residentNpcs.js";
import { INNER_MAP } from "../map/innerMap.js";
import { SNOW_LEOPARD_QUEST } from "../quests/snowLeopardQuest.js";
import { allContent, getContent } from "./registry.js";

const current = Object.fromEntries(
  Object.entries({ ...quests, ...items, RESIDENT_NPCS, INNER_MAP, SNOW_LEOPARD_QUEST })
    .filter(([, value]) => typeof value !== "function"),
);

// 内容迁进注册表时用哈希指纹锁过原值；迁移早已完成，内容 PR 天天加条目，
// 锁哈希只会让每单互相冲突。现在只守结构：可序列化、无函数、条目 id 不重复，
// 且各数据模块单独加载时与应用内一致。
function assertPlainData(data, path = "") {
  if (typeof data === "function") throw new Error(`Function in content at ${path}`);
  if (data === null || typeof data !== "object") return;
  for (const [k, v] of Object.entries(data)) assertPlainData(v, `${path}.${k}`);
}

describe("default content compatibility", () => {
  it.each(Object.keys(current))("%s is plain serializable data", (name) => {
    expect(() => assertPlainData(current[name], name)).not.toThrow();
    expect(JSON.parse(JSON.stringify(current[name]))).toEqual(current[name]);
  });

  it("quest ids are unique", () => {
    const ids = quests.QUCUO_QUESTS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
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
    expect(JSON.parse(output)).toEqual(JSON.parse(JSON.stringify(current[name])));
  });
});
