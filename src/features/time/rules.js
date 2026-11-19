import { random } from "../../core/rng.js";
import { tickAngryState } from "../../combat/stealSystem.js";
import { makeItem } from "../../equipment.js";
import { makeItemSmart } from "../../items/catalog.js";
import { cleanExpiredBuffs } from "../../utils/buffSystem.js";

const QUALITIES = ["白", "绿", "蓝", "紫", "橙", "红"];
const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

function parseForgeOrder(flag) {
  const parts = flag.split("_");
  const luck = Number(parts[3]) || 5;
  let quality = QUALITIES[Math.min(4, Math.floor(luck / 2.5))];
  let spec = null;
  if (parts[4] && parts[4] !== "-") {
    try {
      spec = JSON.parse(decodeURIComponent(parts[4]));
    } catch {
      spec = null;
    }
  }

  let name;
  let category;
  let effect;
  let sixDim;
  let isJade = false;
  if (spec?.name) {
    name = spec.name;
    category = ["weapon", "armor", "accessory"].includes(spec.category) ? spec.category : "weapon";
    effect = spec.effect && typeof spec.effect === "object" && Object.keys(spec.effect).length
      ? spec.effect
      : undefined;
    sixDim = spec.sixDim && typeof spec.sixDim === "object" && Object.keys(spec.sixDim).length
      ? spec.sixDim
      : undefined;
    if (spec.jade && spec.qualityCap) {
      isJade = true;
      const capIdx = QUALITIES.indexOf(spec.qualityCap);
      if (capIdx >= 0 && capIdx < QUALITIES.indexOf(quality)) quality = spec.qualityCap;
    }
  } else {
    let material = "";
    if (parts[4] && parts[4] !== "-") {
      try {
        material = decodeURIComponent(parts[4]);
      } catch {
        material = parts[4];
      }
    }
    name = material ? `${material}剑` : "定制长剑";
    category = "weapon";
  }

  if (QUALITIES.indexOf(quality) < 2) {
    effect = undefined;
    sixDim = undefined;
  }
  const item = makeGameItem({ name, category, quality, ...(effect ? { effect } : {}), ...(sixDim ? { sixDim } : {}) });
  return {
    item: {
      ...item,
      id: `forge_${parts[2]}_${random().toString(36).slice(2, 6)}`,
      equipped: false,
    },
    deliveredName: { text: `${name}（${quality}）`, jade: isJade },
  };
}

export const timeAdvanceRule = {
  id: "time.advance",
  deps: (state) => [state.time, state.room?.npcs],
  run(state, { firstRun, previousDeps }) {
    if (firstRun || Object.is(state.time, previousDeps?.[0])) return null;

    const time = state.time;
    const currentFlags = state.flags || [];
    const filteredFlags = cleanExpiredBuffs(currentFlags, time);
    const cleanedFlags = filteredFlags.length === currentFlags.length ? currentFlags : filteredFlags;
    const matured = cleanedFlags.filter((flag) => {
      if (!flag.startsWith("forge_pending_")) return false;
      const orderedAt = Number(flag.split("_")[2]);
      return Number.isFinite(orderedAt) && time - orderedAt >= 24;
    });
    const maturedSet = new Set(matured);
    const nextFlags = matured.length
      ? cleanedFlags.filter((flag) => !maturedSet.has(flag))
      : cleanedFlags;
    const changes = {};
    const logs = [];

    if (nextFlags !== currentFlags) {
      changes.flags = (previous) => {
        const filtered = cleanExpiredBuffs(previous, time);
        const latest = filtered.length === previous.length ? previous : filtered;
        return matured.length ? latest.filter((flag) => !maturedSet.has(flag)) : latest;
      };
    }

    if (matured.length) {
      const items = [];
      const deliveredNames = [];
      for (const flag of matured) {
        const { item, deliveredName } = parseForgeOrder(flag);
        items.push(item);
        deliveredNames.push(deliveredName);
      }
      const anyJade = deliveredNames.some((entry) => entry.jade);
      const names = deliveredNames.map((entry) => entry.text).join("」「");
      changes.inv = (previous) => [...(previous || []), ...items];
      logs.push({
        t: "item",
        text: anyJade
          ? `  💎 金玉行的伙计寻来，将雕琢好的「${names}」奉到你手上，已收入行囊。`
          : `  🔨 铁匠铺的伙计寻来，将打造好的「${names}」送到你手上，已收入行囊。`,
      });
    }

    const angerUpdates = [];
    let forcedDuelNpc;
    for (const [name, attrs] of Object.entries(state.varTree?.角色 || {})) {
      if (!attrs.生气状态?.active) continue;
      const anger = tickAngryState(attrs.生气状态);
      angerUpdates.push([name, anger]);
      if (!anger.escalated) continue;
      logs.push({ t: "err", text: `  ${name}积怒难平，终于按捺不住，径直朝你逼了过来——这场恶斗，躲不掉了！` });
      const npc = (state.room?.npcs || []).find((entry) => entry.name === name);
      if (npc) forcedDuelNpc = npc;
    }

    if (angerUpdates.length) {
      changes.varTree = (previous) => {
        const characters = { ...(previous?.角色 || {}) };
        for (const [name, anger] of angerUpdates) {
          characters[name] = { ...(characters[name] || {}), 生气状态: anger };
        }
        return { ...previous, 角色: characters };
      };
    }

    if (!Object.keys(changes).length && !logs.length) return null;
    return {
      changes,
      logs,
      ...(forcedDuelNpc ? { forcedDuelNpc } : {}),
    };
  },
};
