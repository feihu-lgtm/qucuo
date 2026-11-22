// 任务可达性：逐条检查每个任务每一步的人、物、flag、门槛在游戏里真能凑齐，
// 防止「人不在那间房」「物品无处可得」「flag 没人写」「门槛超过上限」把任务卡死。
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { QUCUO_QUESTS } from "../../data/quests/qucuoQuests.js";
import { RESIDENT_NPCS } from "../../data/npc/residentNpcs.js";
import { NPC_POOL } from "../../data/npc/npcPool.js";
import { QUCUO_SHOPS } from "../../data/shops/qucuoShops.js";
import { ITEM_DISTRIBUTION } from "../../data/items/distribution.js";
import { GROUND_ITEMS_INNER } from "../map/groundItems.js";
import { QUCUO_PRESET } from "../../data/presets/qucuo.js";
import { getDistrictAnchor, getInnerRoom, INNER_MAP, getResidentRoomForNpc, hasInnerMap } from "../map/innerMap.js";

const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const nameOf = (it) => (typeof it === "string" ? it : it?.name);
const SRC = path.resolve(__dirname, "../../..");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(e.name) && !/\.test\.jsx?$/.test(e.name)) out.push(p);
  }
  return out;
}
// 规则代码里出现的字符串字面量：拜入、切磋、送礼、建筑等由代码写入的 flag / 发放的物品。
// 只扫规则代码，不扫内容数据与物品定义，免得「读 flag 的地方」被当成写入方。
const LOGIC_DIRS = ["domain/rules/", "features/", "engine/", "app/"];
const codeLiterals = new Set();
for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file).split(path.sep).join("/");
  if (!LOGIC_DIRS.some((d) => rel.startsWith(d))) continue;
  for (const m of fs.readFileSync(file, "utf8").matchAll(/["'`]([^"'`\n${}]{1,40})["'`]/g)) codeLiterals.add(m[1]);
}

const stagesOf = (q) => q.stages || [];
const rewardsOf = (stage) => [stage.onReach, ...Object.values(stage.onReach?.byFlag || {})].filter(Boolean);
const choicesOf = (stage) => stage.choices || [];

// —— 人物落点：名字 → [{ 据点, 房间 }]（驻场人、房间绑定、游走池分时段落点、开局村口的人）——
const homes = new Map();
const addHome = (name, district, room) => homes.set(name, [...(homes.get(name) || []), { district, room }]);
const homeRoom = (district, npc) => (hasInnerMap(district)
  ? getResidentRoomForNpc(district, npc.name) || npc.innerRoom || npc.lockInnerRoom || getDistrictAnchor(district) : null);
for (const [district, data] of Object.entries(INNER_MAP)) {
  for (const [room, r] of Object.entries(data.rooms || {})) if (r.residentNpcName) addHome(r.residentNpcName, district, room);
}
for (const [district, npcs] of Object.entries(RESIDENT_NPCS)) for (const npc of npcs || []) addHome(npc.name, district, homeRoom(district, npc));
for (const npc of NPC_POOL) {
  for (const seg of npc.schedule || [{ weights: npc.routineWeights || {}, lockInnerRoom: npc.lockInnerRoom }]) {
    for (const district of Object.keys(seg.weights || {})) addHome(npc.name, district, seg.lockInnerRoom || homeRoom(district, npc));
  }
}
for (const npc of QUCUO_PRESET.room.npcs || []) addHome(npc.name, QUCUO_PRESET.room.name, homeRoom(QUCUO_PRESET.room.name, npc));
const personExists = (name) => homes.has(name);

// —— 物品来源 ——
const itemSources = new Set(codeLiterals);
for (const q of QUCUO_QUESTS) for (const s of stagesOf(q)) {
  for (const r of rewardsOf(s)) for (const it of r.items || []) itemSources.add(nameOf(it));
  if (s.collect?.item) itemSources.add(s.collect.item);
}
for (const npcs of Object.values(RESIDENT_NPCS)) for (const npc of npcs || []) for (const it of npc.carry || []) itemSources.add(nameOf(it));
for (const shop of Object.values(QUCUO_SHOPS)) for (const it of shop.items || []) itemSources.add(nameOf(it));
for (const items of Object.values(GROUND_ITEMS_INNER)) for (const it of items || []) itemSources.add(nameOf(it));
for (const it of QUCUO_PRESET.room.items || []) itemSources.add(nameOf(it));
Object.keys(ITEM_DISTRIBUTION).forEach((n) => itemSources.add(n));
// 交付按名字互相包含匹配（交「老孙饭馆的糌粑」算交了「糌粑」）
const deliverable = (n) => [...itemSources].some((src) => src && (src.includes(n) || n.includes(src)));
for (const npc of [...NPC_POOL, ...(QUCUO_PRESET.room.npcs || [])]) for (const it of npc.carry || []) itemSources.add(nameOf(it));

// —— flag 写入 ——
const flagWriters = new Set(codeLiterals);
for (const q of QUCUO_QUESTS) for (const s of stagesOf(q)) {
  list(s.completionFlag).forEach((f) => flagWriters.add(f));
  choicesOf(s).forEach((c) => c.flag && flagWriters.add(c.flag));
  for (const r of rewardsOf(s)) list(r.flags).forEach((f) => flagWriters.add(f));
}

const REP_MAX = 100;
const PRESTIGE_MAX = 100;
const FAVOR_MAX = 100;

function problemsOf(q) {
  const out = [];
  const tag = (i, msg) => out.push(`${q.id}${i == null ? "" : `#${i + 1}`}：${msg}`);
  const repGate = (i, gate) => Object.entries(gate || {}).forEach(([f, v]) => v > REP_MAX && tag(i, `${f}声誉门槛 ${v} 超过上限 ${REP_MAX}`));
  const favGate = (i, gate) => Object.entries(gate || {}).forEach(([n, v]) => {
    if (v > FAVOR_MAX) tag(i, `${n}好感门槛 ${v} 超过上限 ${FAVOR_MAX}`);
    if (!personExists(n)) tag(i, `好感门槛的人物「${n}」不存在`);
  });
  const needFlags = (i, flags) => list(flags).forEach((f) => !flagWriters.has(f) && tag(i, `要求的 flag「${f}」没有任何任务或规则写入`));
  const needItems = (i, items) => list(items).forEach((n) => !itemSources.has(n) && tag(i, `要求的物品「${n}」没有来源`));

  repGate(null, q.requiresFactionRep);
  favGate(null, q.requiresFavor); favGate(null, q.requiresFavorability);
  if (q.requiresPrestige > PRESTIGE_MAX) tag(null, `威望门槛 ${q.requiresPrestige} 超过上限`);
  needFlags(null, q.requiresFlags); needFlags(null, q.requiresFlagsAny);
  list(q.requiresKnownNpc).concat(list(q.requiresKnownNpcAny)).forEach((n) => !personExists(n) && tag(null, `要求结识的「${n}」不存在`));
  if (q.giver && !personExists(q.giver)) tag(null, `发布人「${q.giver}」不存在`);

  stagesOf(q).forEach((s, i) => {
    const rl = s.requireLocation;
    if (rl?.district && hasInnerMap(rl.district) && rl.inner && !getInnerRoom(rl.district, rl.inner)) tag(i, `地点「${rl.district}·${rl.inner}」不存在`);
    // 本地任务：没写 giver: null 的步骤要求发布人在这间房
    if (q.localOnly && q.giver && s.giver !== null && rl?.inner) {
      const at = homes.get(q.giver) || [];
      if (!at.some((h) => h.district === rl.district && h.room === rl.inner)) tag(i, `要求${q.giver}在「${rl.district}·${rl.inner}」，但他/她住在${at.map((h) => `${h.district}·${h.room}`).join("、") || "别处"}`);
    }
    if (typeof s.giver === "string" && !personExists(s.giver)) tag(i, `本步人物「${s.giver}」不存在`);
    if (s.deliver) { if (!deliverable(s.deliver.item)) tag(i, `交付的物品「${s.deliver.item}」没有来源`); if (!personExists(s.deliver.to)) tag(i, `交付对象「${s.deliver.to}」不存在`); }
    needItems(i, s.requiresItems);
    for (const r of rewardsOf(s)) needItems(i, r.consumeItems);
    choicesOf(s).forEach((c) => {
      repGate(i, c.requiresFactionRep);
      favGate(i, c.requiresFavor);
      needFlags(i, c.requiresFlag); needFlags(i, c.requiresFlagAny); needFlags(i, c.requiresFlags);
      needItems(i, c.requiresItems);
    });
  });
  return out;
}

const questIds = new Set(QUCUO_QUESTS.map((q) => q.id));
// 内层房间门锁（unlockCondition）：开门要的 flag 有人写、物品有来源、任务存在、声誉/好感门槛不超上限
function lockProblems(cond, where) {
  if (!cond) return [];
  const t = cond.type;
  if (t === "all") return (cond.of || []).flatMap((c) => lockProblems(c, where));
  // 任一即开：只要有一把钥匙拿得到就不算卡死（另几把可以是还没落地的后续任务）
  if (t === "any") {
    const each = (cond.of || []).map((c) => lockProblems(c, where));
    return each.some((p) => !p.length) ? [] : each.flat();
  }
  if (t === "flag") return flagWriters.has(cond.flag) ? [] : [`${where}：开门 flag「${cond.flag}」没有任何任务或规则写入`];
  if (t === "anyFlag") return (cond.flags || []).some((f) => flagWriters.has(f)) ? [] : [`${where}：开门 flag「${(cond.flags || []).join("」「")}」都没人写入`];
  if (t === "questCompleted" || t === "questStarted") return questIds.has(cond.questId) ? [] : [`${where}：开门任务「${cond.questId}」不存在`];
  if (t === "item") return itemSources.has(cond.itemName) ? [] : [`${where}：开门物品「${cond.itemName}」没有来源`];
  if (t === "factionRep" || t === "rep") return cond.min > REP_MAX ? [`${where}：开门${cond.faction}声誉 ${cond.min} 超过上限 ${REP_MAX}`] : [];
  if (t === "favor") return cond.min > FAVOR_MAX ? [`${where}：开门${cond.npc}好感 ${cond.min} 超过上限 ${FAVOR_MAX}`] : [];
  return [];
}
function locksIn(node, where, out = []) {
  if (!node || typeof node !== "object") return out;
  for (const [k, v] of Object.entries(node)) {
    if (k === "unlockCondition") out.push(...lockProblems(v, where));
    else if (typeof v === "object") locksIn(v, where, out);
  }
  return out;
}

describe("任务可达性", () => {
  it("内层房间的门锁都开得了", () => {
    const problems = Object.entries(INNER_MAP).flatMap(([district, data]) =>
      Object.entries(data.rooms || {}).flatMap(([room, r]) => locksIn(r, `${district}·${room}`)));
    expect(problems).toEqual([]);
  });

  it("每个任务每一步要求的人、物、flag 都有着落，门槛不超过上限", () => {
    const problems = QUCUO_QUESTS.flatMap(problemsOf);
    expect(problems).toEqual([]);
  });

  it("检查本身能抓出四类卡死", () => {
    const bad = {
      id: "probe", localOnly: true, giver: "姬无双", requiresFactionRep: { 百花门: 140 },
      stages: [
        { id: "s1", completionFlag: "probe_1", requireLocation: { district: "天龙营", inner: "风沙客帐" } },
        { id: "s2", completionFlag: "probe_2", requiresItems: ["并不存在的信物"],
          choices: [{ flag: "probe_2", label: "x", requiresFlag: ["从来没人写的flag"] }] },
      ],
    };
    expect(problemsOf(bad)).toEqual([
      "probe：百花门声誉门槛 140 超过上限 100",
      expect.stringContaining("probe#1：要求姬无双在「天龙营·风沙客帐」"),
      "probe#2：要求的物品「并不存在的信物」没有来源",
      "probe#2：要求的 flag「从来没人写的flag」没有任何任务或规则写入",
    ]);
    expect(problemsOf({ ...bad, requiresFactionRep: {}, stages: [{ ...bad.stages[0], giver: null }] })).toEqual([]);
  });
});
