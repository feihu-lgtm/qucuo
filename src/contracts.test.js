import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { MOVE_ARCHETYPES } from "./combat/moveArchetypes.js";
import { MOVE_ARCHETYPE_IDS, MOVE_SLOTS, SLOT_DEFAULT_ARCHETYPE, TIER_NEIGONG, FALLBACK_MILESTONES } from "./cards/scanPrompts.js";
import { getTierPower } from "./npcGeneration.js";
import { PLANNABLE_DISTRICTS } from "./cards/placementPlan.js";
import { QUCUO_MAP } from "./qucuoMap.js";
import { DEFAULT_PORTRAITS, PORTRAIT_BY_FILE, resolveCardPortrait } from "./portraits.js";
import { PLACEMENT_MODES } from "./cards/importedRegistry.js";

// 跨文件契约对账
// ============================================================================
// 【为什么集中在一处】项目里有五十来条注释写着「必须与 X 一致」「两边同增同减」
// 「改一处漏三处」。这些约束是真的——违反了会坏——但它们全靠人记得，没有任何
// 机器强制。已经栽过的每一次都是同一个形状：某一头改了，另一头没跟上，不报错、
// 不崩溃，只是那个功能悄悄失效（白名单剥字段五次、立绘路径指错目录、
// onImportWorld 静默短路）。
//
// 这份文件把能机器校验的契约逐条写成断言。判准取「违反了会真的坏」那一侧，
// 不追求两边字面相等——比如可选原型清单是 MOVE_ARCHETYPES 的子集就够，
// 反向缺失只是设计选择，不该被守卫拦住。
const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(HERE, ...p), "utf-8");

describe("招式原型：清单里的每一项都必须真的存在", () => {
  // scanPrompts 那条注释写的是「必须与 MOVE_ARCHETYPES 键一致」，但实际是 7 vs 9
  // （MOVE_ARCHETYPES 另有 施毒 与 回气）。回气被 sanitizeMoves 特殊处理、是固定
  // 槽位不是可选原型；施毒则是没给入册角色开放。真正会坏的方向只有一个：清单里
  // 出现 MOVE_ARCHETYPES 没有的名字 → resolveArchetype 返回 null → 招式退化成
  // 空对象。所以按子集断言。
  it("MOVE_ARCHETYPE_IDS 全都在 MOVE_ARCHETYPES 里", () => {
    const known = new Set(Object.keys(MOVE_ARCHETYPES));
    const bad = MOVE_ARCHETYPE_IDS.filter(id => !known.has(id));
    expect(bad, `这些原型 resolveArchetype 查不到，招式会退化成空对象：${bad.join("、")}`).toEqual([]);
  });

  it("每个槽位的默认原型也必须存在", () => {
    const known = new Set(Object.keys(MOVE_ARCHETYPES));
    const bad = Object.entries(SLOT_DEFAULT_ARCHETYPE).filter(([, v]) => !known.has(v));
    expect(bad.map(x => x.join("→")), "槽位默认原型不存在，退化时会拿到空招式").toEqual([]);
  });

  it("四个必备槽位都有默认原型（缺一个，那个槽退化时无从可退）", () => {
    for (const slot of MOVE_SLOTS) {
      expect(SLOT_DEFAULT_ARCHETYPE[slot], `槽位「${slot}」没有默认原型`).toBeTruthy();
    }
  });
});

describe("品阶 → 内外功基准两处必须同口径", () => {
  // scanPrompts.TIER_NEIGONG 与 npcGeneration.getTierPower 各存一份。不同步的话，
  // 入册界面显示的基准值与运行时实际算出来的不是一个数，玩家改过又改不明白
  it("TIER_NEIGONG 与 getTierPower 逐档相等", () => {
    const fromEngine = [0, 1, 2, 3, 4, 5].map(c => getTierPower(c).neigong);
    expect(TIER_NEIGONG).toEqual(fromEngine);
  });
});

describe("好感里程碑阈值：只有被查询的那两档才会解锁", () => {
  it("FALLBACK_MILESTONES 的阈值都在 characterMilestones 实际查询的档位里", () => {
    // characterMilestones 的 getAvailableMilestone 里写死 const thresholds = [60, 30]
    const src = read("characterMilestones.js");
    const m = src.match(/const thresholds = \[([^\]]+)\]/);
    expect(m, "没找到 thresholds，指纹可能变了，请同步这条对账").toBeTruthy();
    const queried = new Set(m[1].split(",").map(x => Number(x.trim())));
    const bad = FALLBACK_MILESTONES.map(x => x.threshold).filter(t => !queried.has(t));
    expect(bad, `这些阈值永远不会被解锁（查询侧只认 ${[...queried].join("/")}）：${bad.join("、")}`).toEqual([]);
  });
});

describe("可规划据点必须来自真实地图", () => {
  it("PLANNABLE_DISTRICTS 等于 QUCUO_MAP 去掉两个非常规节点", () => {
    const expected = Object.keys(QUCUO_MAP).filter(d => d !== "心灵之海" && d !== "第三新东京市");
    expect(PLANNABLE_DISTRICTS).toEqual(expected);
  });

  it("ReviewNpc 的 DISTRICTS 用同一套过滤条件", () => {
    // 两处各写一遍 filter，条件必须一致，否则 AI 能选的与玩家能选的不是同一批
    const src = read("cards", "ReviewNpc.jsx");
    expect(src).toContain('d !== "心灵之海" && d !== "第三新东京市"');
  });
});

describe("立绘两张索引表必须一一对应", () => {
  // 上一轮为存量数据（英文文件名）加了 PORTRAIT_BY_FILE。它与 DEFAULT_PORTRAITS
  // 指向同一批 import，少一张就有一批旧数据解析不出来
  it("条数相等且指向同一批资源", () => {
    expect(Object.keys(PORTRAIT_BY_FILE).length).toBe(Object.keys(DEFAULT_PORTRAITS).length);
    const byName = new Set(Object.values(DEFAULT_PORTRAITS));
    const byFile = new Set(Object.values(PORTRAIT_BY_FILE));
    expect([...byFile].filter(v => !byName.has(v)), "有文件名指向了 DEFAULT_PORTRAITS 之外的资源").toEqual([]);
  });

  it("两种键都能解析出来（角色名与英文文件名）", () => {
    for (const name of Object.keys(DEFAULT_PORTRAITS)) {
      expect(resolveCardPortrait(name), `角色名 ${name} 解析不出立绘`).toBeTruthy();
    }
    for (const file of Object.keys(PORTRAIT_BY_FILE)) {
      expect(resolveCardPortrait(file), `文件名 ${file} 解析不出立绘`).toBeTruthy();
    }
  });
});

describe("落脚三态：数据层与界面标签必须同键", () => {
  it("PLACEMENT_MODES 每一项都有界面标签与说明", () => {
    const src = read("cards", "ReviewNpc.jsx");
    for (const mode of PLACEMENT_MODES) {
      expect(src.includes(`${mode}:`), `PLACEMENT_LABEL/HINT 缺 ${mode}——界面上会显示 undefined`).toBe(true);
    }
  });
});

describe("代码引用的 stones 素材必须真的存在", () => {
  // 【为什么这条最值钱】立绘那次就是：十个英文文件名指向 public/portraits/，
  // 而那批图在 src/assets/portraits/ 下，十张全 404；配上 onError 隐藏破图，
  // 表现成"这一节是空的"。开场图与本地音乐也各栽过一次同类。
  // 引用了不存在的文件，构建不报错、测试不报错，只是那个位置永远空着。
  const PUB = join(HERE, "..", "public", "stones");
  const files = [];
  (function walk(dir, base = "") {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p, base + n + "/");
      else files.push(base + n);
    }
  })(PUB);
  const have = new Set(files);

  const srcFiles = [];
  (function walk(dir) {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { if (n !== "assets") walk(p); }
      else if (/\.jsx?$/.test(n) && !n.includes(".test.")) srcFiles.push(p);
    }
  })(HERE);

  it("每一处 stones 素材引用都能在 public/stones 下找到", () => {
    const missing = [];
    for (const f of srcFiles) {
      const code = readFileSync(f, "utf-8");
      // S("ui/bar_wood.webp") / UI("coin.webp") / FRAME("frame_lux.webp") 等
      for (const m of code.matchAll(/\b(S|UI|FRAME|MAPUI|CARD)\(\s*["']([^"'${}]+\.webp)["']\s*\)/g)) {
        const helper = m[1], rel = m[2];
        const prefix = { S: "", UI: "ui/", FRAME: "frames/", MAPUI: "mapui/", CARD: "cards/" }[helper];
        const key = rel.includes("/") ? rel : prefix + rel;
        if (!have.has(key)) missing.push(`${f.replace(HERE, "src")} → ${key}`);
      }
      // stones/ 字面量拼接：`${BASE}stones/ui/xxx.webp`
      for (const m of code.matchAll(/stones\/([A-Za-z0-9_/]+\.webp)/g)) {
        if (!have.has(m[1])) missing.push(`${f.replace(HERE, "src")} → stones/${m[1]}`);
      }
    }
    expect([...new Set(missing)],
      `以下素材被代码引用但 public/stones 下没有——构建与测试都不会报错，只是那个位置永远空着：\n  `
      + [...new Set(missing)].join("\n  ")).toEqual([]);
  });

  it("素材库规模没有意外缩水（防误删整目录）", () => {
    expect(files.length).toBeGreaterThanOrEqual(89);
  });
});

describe("public 下被硬编码引用的目录必须存在", () => {
  // bidders/full 与 portraits/ 两处：QuickBattleScreen 拼 bidders/full/中文名.webp，
  // portraits.js 的注释里区分了 public/portraits 与 src/assets/portraits
  it("bidders/full 存在且非空（快速战斗立绘）", () => {
    const d = join(HERE, "..", "public", "bidders", "full");
    expect(existsSync(d), "public/bidders/full 不存在——快速战斗的立绘会全部 404").toBe(true);
    expect(readdirSync(d).length).toBeGreaterThan(0);
  });

  it("十张内置立绘在 src/assets/portraits 下（不是 public/portraits）", () => {
    const d = join(HERE, "assets", "portraits");
    const got = readdirSync(d).filter(n => n.endsWith(".webp"));
    expect(got.length).toBe(Object.keys(DEFAULT_PORTRAITS).length);
    // 反过来钉一条：public/portraits 下不该有这十张同名文件，否则又会有人去拼那条路径
    const pub = join(HERE, "..", "public", "portraits");
    if (existsSync(pub)) {
      const dup = readdirSync(pub).filter(n => got.includes(n));
      expect(dup, "public/portraits 下出现了与内置立绘同名的文件，路径来源会再次分裂").toEqual([]);
    }
  });
});
