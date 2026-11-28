// 路遇 400 件数据的静态校验（WO-25N 前半截·纯数据）：
//   - 条目数量、编号、地点、来人、检定、稀有度的完整性
//   - when 触发谓词与 worldRegistry/evalWorld 谓词表对齐（含路遇三个扩展谓词）
//   - 奖励码引用的门派、品阶、六维、势力、局势卡真实存在
//   - 人物引用合规：角色来人势力在册、oc 人物槽格式合法、不新造具名人物
// 机制侧行为测试（抽人、检定、结算）仍在 scripts/roadEvents/roadEvents.test.js。
import { describe, expect, it } from "vitest";
import {
  ROAD_EVENTS, ROAD_EVENT_CATEGORIES, CATEGORY_KEYS, PLACE_TAGS, ALL_TAGS, SITUATION_IDS,
} from "./index.js";
import { QUCUO_MAP } from "../map/qucuoMap.js";
import { FACTIONS } from "../map/factions.js";
import { SKILL_CATALOG } from "../kungfu/qucuoKungfu.js";
import { QUALITY } from "../../rules/economy/equipment.js";
import { WANDERING_OCS } from "../../rules/npc/ocWander.js";
import { passerRolesOf } from "../npc/randomPassers.js";

// worldRegistry VALID_PREDICATES + 路遇扩展谓词（设计稿 §八/§九：statGte、rumorKnown、knownEventsHere）。
const REGISTRY_PREDICATES = new Set([
  "npcStatus", "factionTensionGte", "factionPowerLte", "factionRepGte",
  "districtOwner", "flag", "questDone", "season", "situationActive", "worldState",
]);
const ROAD_EXTRA_PREDICATES = new Set(["statGte", "rumorKnown", "knownEventsHere"]);

function walkPredicates(node, visit) {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const child of node) walkPredicates(child, visit);
    return;
  }
  if (typeof node === "string") {
    visit({ type: "worldState", id: node });
    return;
  }
  if (typeof node !== "object") return;
  if (typeof node.type === "string") {
    visit(node);
    return;
  }
  for (const key of ["all", "any", "not"]) {
    if (node[key]) walkPredicates(node[key], visit);
  }
}

const PASSER_FACTIONS = new Set([...FACTIONS.map((f) => f.name), "散人"]);
const FACTION_NAMES = new Set(FACTIONS.map((f) => f.name));
const SCHOOLS = new Set([...Object.keys(SKILL_CATALOG), "any"]);
const SIX_STATS = ["根骨", "悟性", "体魄", "魅力", "智谋", "身法", "气运"];
const REWARD_RE = /^(silver:[+-]\d+|hp:[+-]\d+|item:[^:|]+:(白|绿|蓝|紫|橙|红|roll(?:\+1)?)|skill:[^:|]+:(白|绿|蓝|紫|橙|红|roll):(?:成长|独门)|stat:[^+|]+\+1|exp:\+\d+|pot:\+\d+|rep:[^+|]+[+-]\d+|aff:[+-]\d+|ally|mate|beast:[^:|]+:(?:坐骑|兽伴)|cond:[^:|]+:\d+|clue|pact|scene|tension:[^:|]+\/[^:|]+[+-]\d+|situation:[+-][\w]+|trigger:[\w]+(?::[\w]+)?)$/;

const rewardCodesOf = (e) => [e.win, e.lose, e.alt].join("|").split("|").filter(Boolean);

describe("路遇事件数据入库校验", () => {
  it("20 类各 20 件共 400 件，编号连续唯一，字段齐备", () => {
    expect(CATEGORY_KEYS).toHaveLength(20);
    expect(ROAD_EVENTS).toHaveLength(400);
    const ids = new Set();
    for (const e of ROAD_EVENTS) {
      expect(ids.has(e.id), e.id).toBe(false);
      ids.add(e.id);
      expect(e.id).toMatch(/^[A-T]\d{2}$/);
      expect(e.cat).toBe(e.id[0]);
      expect(typeof e.name).toBe("string");
      expect(e.name.length).toBeGreaterThan(0);
      expect(typeof e.seed).toBe("string");
      expect(e.seed.length).toBeGreaterThan(10);
      expect(Array.isArray(e.where)).toBe(true);
    }
    for (const k of CATEGORY_KEYS) {
      expect(ROAD_EVENTS.filter((e) => e.cat === k).map((e) => e.id), k).toEqual(
        Array.from({ length: 20 }, (_, i) => `${k}${String(i + 1).padStart(2, "0")}`),
      );
    }
  });

  it("事件地点都是真实地图节点或已登记地形标签", () => {
    for (const node of Object.keys(QUCUO_MAP)) {
      if (!["心灵之海", "第三新东京市"].includes(node)) expect(PLACE_TAGS[node], node).toBeTruthy();
    }
    for (const e of ROAD_EVENTS) {
      for (const w of e.where) {
        expect(Boolean(PLACE_TAGS[w]) || ALL_TAGS.includes(w), `${e.id} ${w}`).toBe(true);
      }
    }
  });

  it("when 触发谓词全部对齐 worldRegistry 谓词表或路遇扩展谓词，势力引用真实存在", () => {
    for (const e of ROAD_EVENTS) {
      walkPredicates(e.when, (pred) => {
        expect(
          REGISTRY_PREDICATES.has(pred.type) || ROAD_EXTRA_PREDICATES.has(pred.type),
          `${e.id} 未知谓词 ${pred.type}`,
        ).toBe(true);
        if (typeof pred.faction === "string") {
          expect(FACTION_NAMES.has(pred.faction), `${e.id} 未知势力 ${pred.faction}`).toBe(true);
        }
        if (pred.type === "situationActive" && pred.id) {
          expect(SITUATION_IDS.includes(pred.id), `${e.id} 未知局势卡 ${pred.id}`).toBe(true);
        }
        if (["factionTensionGte", "factionPowerLte", "factionRepGte"].includes(pred.type)) {
          expect(typeof pred.value, `${e.id} ${pred.type}`).toBe("number");
        }
        if (pred.type === "statGte") {
          expect(SIX_STATS.includes(pred.stat), `${e.id} statGte ${pred.stat}`).toBe(true);
          expect(typeof pred.value, `${e.id} statGte value`).toBe("number");
        }
      });
    }
  });

  it("人物引用合规：角色来人势力在册且过路人库有角色池，oc 人物槽取自游走冒险者池格式", () => {
    for (const e of ROAD_EVENTS) {
      const parts = e.cast.split(":");
      if (e.cast === "auto" || e.cast === "传闻") continue;
      if (parts[0] === "oc") {
        // oc:性别|任[:亲密][:就近势力]——只允许抽池子，不许点名新造人物
        expect(["男", "女", "任"].includes(parts[1]), `${e.id} ${e.cast}`).toBe(true);
        for (const extra of parts.slice(2)) {
          if (extra === "亲密") continue;
          expect(FACTION_NAMES.has(extra), `${e.id} oc 就近势力 ${extra}`).toBe(true);
        }
        expect(WANDERING_OCS.length, "游走冒险者池非空").toBeGreaterThan(0);
        continue;
      }
      // 势力:身份:性别:年纪——势力必须在册，过路人姓名库得有该势力的角色池
      expect(parts.length, `${e.id} cast 段数`).toBe(4);
      expect(PASSER_FACTIONS.has(parts[0]), `${e.id} 未知势力 ${parts[0]}`).toBe(true);
      expect(["男", "女"].includes(parts[2]), `${e.id} 性别`).toBe(true);
      expect(passerRolesOf(parts[0]).length, `${e.id} ${parts[0]} 角色池`).toBeGreaterThan(0);
    }
  });

  it("奖励码逐条可解析，引用的门派、品阶、六维、势力、局势卡、检定属性真实存在", () => {
    for (const e of ROAD_EVENTS) {
      if (e.check) expect(SIX_STATS.includes(e.check), e.id).toBe(true);
      expect(e.dc >= 4 && e.dc <= 10, e.id).toBe(true);
      expect([1, 2, 3].includes(e.tier), e.id).toBe(true);
      expect(["", "昼", "夜"].includes(e.time), e.id).toBe(true);
      for (const code of rewardCodesOf(e)) {
        expect(REWARD_RE.test(code), `${e.id} 无法解析的奖励码「${code}」`).toBe(true);
        if (code.startsWith("skill:")) {
          expect(SCHOOLS.has(code.split(":")[1]), `${e.id} 未知门派 ${code}`).toBe(true);
        }
        if (code.startsWith("stat:")) {
          expect(SIX_STATS.includes(code.slice(5, -2)), `${e.id} 未知六维 ${code}`).toBe(true);
        }
        if (code.startsWith("rep:")) {
          const m = code.match(/^rep:(.+?)[+-]\d+$/);
          expect(FACTION_NAMES.has(m[1]), `${e.id} 未知势力 ${m[1]}`).toBe(true);
        }
        if (code.startsWith("tension:")) {
          const m = code.match(/^tension:(.+?)\/(.+?)[+-]\d+$/);
          expect(FACTION_NAMES.has(m[1]), `${e.id} 未知势力 ${m[1]}`).toBe(true);
          expect(FACTION_NAMES.has(m[2]), `${e.id} 未知势力 ${m[2]}`).toBe(true);
        }
        if (code.startsWith("situation:")) {
          expect(SITUATION_IDS.includes(code.slice(11)), `${e.id} 未知局势卡 ${code}`).toBe(true);
        }
        if (code.startsWith("item:")) {
          const q = code.split(":")[2];
          expect(QUALITY.includes(q) || q.startsWith("roll"), `${e.id} 品阶 ${q}`).toBe(true);
        }
      }
    }
  });

  it("长期奖励事件自动只遇一次；稀有度与奖励档位相符", () => {
    for (const e of ROAD_EVENTS) {
      if (/(^|\|)(stat:|skill:|beast:|ally(\||$)|mate(\||$))/.test(e.win)) {
        expect(e.once, e.id).toBe(true);
      }
    }
  });

  it("类别表 20 类齐全，各有地头标签、三个可行之事与手写提示词", () => {
    for (const k of CATEGORY_KEYS) {
      const cat = ROAD_EVENT_CATEGORIES[k];
      expect(cat, k).toBeTruthy();
      expect(typeof cat.name, `${k} name`).toBe("string");
      expect(Array.isArray(cat.where) && cat.where.length > 0, `${k} where`).toBe(true);
      for (const w of cat.where) expect(ALL_TAGS.includes(w), `${k} 类别地头 ${w}`).toBe(true);
      for (const key of ["main", "alt", "leave"]) {
        expect(typeof cat.options?.[key] === "string" && cat.options[key].length > 0, `${k} options.${key}`).toBe(true);
      }
      expect(typeof cat.prompt === "string" && cat.prompt.length > 50, `${k} prompt`).toBe(true);
    }
  });
});
