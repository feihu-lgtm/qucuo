import { parseArgs } from "node:util";
import { setSeed } from "../src/utils/rng.js";
import { getNpcFaction } from "../src/domain/data/factions/npcFactions.js";
import { NPC_POOL } from "../src/domain/data/npc/npcPool.js";
import { RESIDENT_NPCS } from "../src/domain/data/npc/residentNpcs.js";
import { resolveNpcConflict } from "../src/domain/rules/conflict/npcAutoBattle.js";
import { getTension } from "../src/domain/rules/conflict/tension.js";
import { buildRoomNpcWithCombat } from "../src/domain/rules/npc/rules.js";

const content = new Map([...Object.values(RESIDENT_NPCS).flat(), ...NPC_POOL].map((npc) => [npc.id, npc]));

function buildSide(ids) {
  const entries = ids?.split(",") ?? [];
  if (entries.length < 1 || entries.length > 2) throw new Error("每方须指定 1 到 2 个 NPC ID，用逗号分隔");
  return entries.map((id) => {
    const npc = content.get(id);
    if (!npc) throw new Error(`没有这个内置 NPC：${id}`);
    return buildRoomNpcWithCombat(npc);
  });
}

try {
  const { values } = parseArgs({
    options: {
      "side-a": { type: "string" },
      "side-b": { type: "string" },
      seed: { type: "string" },
      lethal: { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log("用法：node cli/npc-conflict.mjs --side-a resident_basang --side-b resident_gesangdunzhu --seed 42 [--lethal]");
  } else {
    const seed = Number(values.seed);
    if (!/^\d+$/.test(values.seed ?? "") || seed !== (seed >>> 0)) {
      throw new Error("--seed 须为 32 位无符号整数");
    }
    setSeed(seed);
    const sideA = buildSide(values["side-a"]);
    const sideB = buildSide(values["side-b"]);
    const factions = [sideA, sideB].map((side) => [...new Set(side.map(getNpcFaction))]);
    const tension = factions.every((side) => side.length === 1)
      ? getTension(undefined, factions[0][0], factions[1][0])
      : null;
    const result = resolveNpcConflict({ sideA, sideB, seed, lethal: values.lethal ? "minions" : "none" });
    console.log(JSON.stringify({ seed, factions, tension, ...result }, null, 2));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
