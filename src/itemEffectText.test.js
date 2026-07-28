import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { EFFECT_CN, effectBrief, statLabel, moveStatLabel, moveEffectBrief } from "./itemEffectText.js";
import { CATALOG } from "./items/catalog.js";

// 【群友实测反馈】"现在所有武器防具都不加吗""只加了攻防呀""红名武器防具应该加7维"
// 两个独立问题：
//   ① 数据：红档 12 把武器只有 1 把带 sixDim，4 件红档护甲 0 件带——effect 倒是全带。
//   ② 显示：右栏装备行只有 (紫·攻35)，特效与七维一个字都不显示；
//      而 effectBrief 的词典在 ForgeScreen/JadeShopScreen 各写一份、
//      **红档那批最强的特效恰恰都不在词典里**（immuneControl/rebirthOnce/forceCrit…），
//      所以就算显示了也是空的。玩家自然得出"只加了攻防"的结论。

const EQUIP = ["weapon", "armor"];
const byTier = (q) => CATALOG.filter(e => e.quality === q && EQUIP.includes(e.category));

describe("数据：高档武器护甲必须带七维", () => {
  it("红档武器护甲 100% 带 sixDim", () => {
    const missing = byTier("红").filter(e => !e.sixDim).map(e => e.name);
    expect(missing, `以下红档装备没有七维加成：${missing.join("、")}`).toEqual([]);
  });

  it("红档的七维总点数在 2~5 之间（别一件顶满）", () => {
    for (const e of byTier("红")) {
      const total = Object.values(e.sixDim).reduce((a, b) => a + b, 0);
      expect(total, `${e.name} 七维总点 ${total}`).toBeGreaterThanOrEqual(2);
      expect(total, `${e.name} 七维总点 ${total}`).toBeLessThanOrEqual(5);
    }
  });

  it("覆盖率随品阶递增（越高档越该有）", () => {
    const rate = (q) => { const a = byTier(q); return a.length ? a.filter(e => e.sixDim).length / a.length : 0; };
    expect(rate("红")).toBeGreaterThanOrEqual(rate("橙"));
    expect(rate("橙")).toBeGreaterThanOrEqual(rate("蓝"));
    expect(rate("红")).toBe(1);
  });

  it("七维键名必须是那七个之一（防拼错字段静默失效）", () => {
    const OK = new Set(["根骨", "悟性", "体魄", "魅力", "智谋", "身法", "气运"]);
    for (const e of CATALOG) {
      for (const k of Object.keys(e.sixDim || {})) {
        expect(OK.has(k), `${e.name} 的 sixDim 里有个不认识的键「${k}」`).toBe(true);
      }
    }
  });
});

describe("词典：红档那批特效必须说得出人话", () => {
  it("红档装备的每个 effect 键都在词典里", () => {
    const unknown = new Set();
    const PARAMS = new Set(["applyMarkChance", "applyMarkOnHit", "statusChance", "confuseChance"]);
    for (const e of CATALOG.filter(x => ["红", "橙"].includes(x.quality))) {
      for (const k of Object.keys(e.effect || {})) {
        if (!PARAMS.has(k) && !EFFECT_CN[k]) unknown.add(k);
      }
    }
    expect([...unknown], `这些特效显示不出人话，玩家会以为装备没效果：${[...unknown].join(", ")}`).toEqual([]);
  });

  it("effectBrief 把特效与七维拼成一行", () => {
    const s = effectBrief({ immuneControl: true, rebirthOnce: true }, { 根骨: 3, 体魄: 2 });
    expect(s).toContain("免控");
    expect(s).toContain("濒死复起一次");
    expect(s).toContain("根骨+3");
  });

  it("参数键不单独成词（不会出现「附内伤印、附内伤印几率」）", () => {
    expect(effectBrief({ applyMark: { name: "x" }, applyMarkChance: 0.3 }, null)).toBe("附内伤印");
  });

  it("什么都没有时返回空串（调用方据此决定不渲染那一行）", () => {
    expect(effectBrief(null, null)).toBe("");
    expect(effectBrief({}, {})).toBe("");
  });
});

describe("数值标签", () => {
  it("武器给攻、护甲给防；饰品不再显示那个不接任何机制的裸小数", () => {
    expect(statLabel({ atk: 35 })).toBe("攻35");
    expect(statLabel({ def: 20 })).toBe("防20");
    expect(statLabel({ bonus: 1.5 })).toBe(""); // bonus 字段已从全项目删除，残留数据也不显示
    expect(statLabel(null)).toBe("");
    expect(statLabel("字符串杂物")).toBe("");
  });

  it("招式显示倍率与耗气（倍率而非绝对伤害——绝对值要乘外功/装备/对手根骨）", () => {
    expect(moveStatLabel({ baseDamageMultiplier: 1.3, energyCost: 4 })).toBe("×1.3 耗4");
    expect(moveStatLabel({ baseDamageMultiplier: 1, energyCost: 0 })).toBe("×1 不耗气");
    expect(moveStatLabel({ hpRestore: 0.25, energyCost: 5 })).toContain("回血25%");
    expect(moveStatLabel(null)).toBe("");
  });

  it("招式特效复用同一份词典", () => {
    expect(moveEffectBrief({ forceFirst: true, ignoreDefense: true })).toBe("必先手、无视防御");
    expect(moveEffectBrief({ forceFirst: false })).toBe("");
  });
});

describe("词典只留一份（此前三处各写一份、都不全）", () => {
  it("ForgeScreen 与 JadeShopScreen 改用公共词典，不再自带副本", () => {
    for (const f of ["src/buildings/ForgeScreen.jsx", "src/buildings/JadeShopScreen.jsx"]) {
      const src = readFileSync(f, "utf-8");
      expect(src, `${f} 仍自带 effectBrief 副本`).not.toMatch(/function effectBrief\(/);
      expect(src).toMatch(/from "\.\.\/itemEffectText\.js"/);
    }
  });
});

// ── 合并之后：唯一一张表，三种粒度 ─────────────────────────────────────────
// 合并前项目里有四份「标志位→人话」：ForgeScreen、JadeShopScreen 各一份（早已收编）、
// itemEffectText 的短词字典、以及 quickBattle/moveExplainer 的详细规则。
// 同一个 forceFirst，切磋里是整句、右栏只有俩字，两处分别维护，加特效漏一处就是空白。
// 现在只剩 MOVE_RULES 一张表，label/text 两种粒度从同一条规则出。
import { MOVE_RULES, explainMove, moveTypeGist, moveOneLiner, passiveBonusBrief } from "./itemEffectText.js";

describe("唯一规则表", () => {
  it("EFFECT_CN 完全由 MOVE_RULES 派生——不存在第二份手写词典", () => {
    expect(Object.keys(EFFECT_CN).length).toBe(MOVE_RULES.length);
    for (const r of MOVE_RULES) expect(EFFECT_CN[r.key], `规则 ${r.key} 没进反查表`).toBe(r.label);
  });

  it("每条规则都同时给得出短词与整句（两种粒度同源）", () => {
    for (const r of MOVE_RULES) {
      expect(r.label, `${r.key} 缺短词`).toBeTruthy();
      expect(typeof r.when, `${r.key} 缺命中条件`).toBe("function");
    }
  });

  it("规则 key 不重复（重复会让反查表悄悄少一条）", () => {
    const keys = MOVE_RULES.map(r => r.key);
    expect([...new Set(keys)].length).toBe(keys.length);
  });

  it("同一个招式，短词与详情说的是同一批效果", () => {
    const mv = { type: "攻击", baseDamageMultiplier: 1.3, forceFirst: true, ignoreDefenseRatio: 0.3, lowHpBonus: 0.2 };
    const brief = moveEffectBrief(mv);
    for (const w of ["必先手", "破防", "残血增伤"]) expect(brief).toContain(w);
    expect(explainMove(mv).length).toBeGreaterThanOrEqual(4); // 含倍率那条
  });

  it("代价类规则带 warn，UI 才好标红", () => {
    const warns = MOVE_RULES.filter(r => r.warn).map(r => r.key);
    expect(warns).toContain("onCounterFailEnergyPenalty");
    expect(warns).toContain("onCounterFailDefenseNullified");
  });

  it("脏输入一律不抛错（规则读值出错要跳过，不能连坐整行）", () => {
    for (const bad of [null, undefined, {}, { applyMark: null }, { selfSacrifice: {} }, { enemyCostPenalty: {} }]) {
      expect(() => explainMove(bad)).not.toThrow();
      expect(() => moveEffectBrief(bad)).not.toThrow();
      expect(() => effectBrief(bad, null)).not.toThrow();
    }
  });

  it("被动加成也收在这里（图鉴曾自己拼一遍）", () => {
    expect(passiveBonusBrief({ maxHp: 20, speedBonus: 2 })).toBe("气血上限+20、身法+2");
    expect(passiveBonusBrief(null)).toBe("");
  });

  it("三种武学来源派生的招式走同一张表", () => {
    // 武馆(倍率+特效) / 制式(纯回气) / 特殊(原型带印记)——三种形状都吐得出人话
    expect(moveEffectBrief({ type: "攻击", baseDamageMultiplier: 1.2, forceFirst: true })).toBe("必先手");
    expect(moveEffectBrief({ type: "状态", energyRestore: 8 })).toContain("回气");
    expect(moveEffectBrief({ type: "状态", applyMark: { name: "内伤", max: 5 } })).toContain("附内伤印");
    expect(moveTypeGist({ type: "攻击" })).toBeTruthy();
    expect(moveOneLiner({ type: "状态", energyRestore: 8 })).toContain("8");
  });
});
