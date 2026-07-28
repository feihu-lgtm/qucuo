import { describe, it, expect } from "vitest";
import { computePassiveBonus, effectiveMaxHp, SKILL_CATALOG, SKILL_TYPE } from "./kungfu/qucuoKungfu.js";
import { effectiveSpecial } from "./equipment.js";
import { EFFECT_CN } from "./itemEffectText.js";

// 【这份测试守的是刚刚接上的那条线】
// computePassiveBonus 此前全项目没有任何调用点——文件头写着"MudRPG 里调用后叠加到
// char"，MudRPG 里却没有这一行。结果 15 门武学里 9 门带 passiveBonus 的全是死数据
// （青城玄门气气血+20、梯云纵身法+2、独孤九剑身法+2…），只在图鉴里显示得挺好看。
// 现在两条出口接上了：maxHp → effectiveMaxHp（战斗入场血量/面板/回血封顶），
// speedBonus → effectiveSpecial 的「身法」（resolveTurn 同类型对撞比身法定先手）。
// 这条线一旦再被拆断，测试就该红。

const mk = (name, passiveBonus) => ({ id: name, name, passiveBonus, level: 1, stage: "入门" });

describe("computePassiveBonus 汇总", () => {
  it("多门武学的同类加成累加", () => {
    const b = computePassiveBonus([mk("甲", { maxHp: 20 }), mk("乙", { maxHp: 15 }), mk("丙", { speedBonus: 2 })]);
    expect(b.maxHp).toBe(35);
    expect(b.speedBonus).toBe(2);
  });

  it("没有 passiveBonus 的武学不影响结果", () => {
    const b = computePassiveBonus([mk("纯招式", null), { name: "无字段" }, mk("有", { maxHp: 10 })]);
    expect(b.maxHp).toBe(10);
    expect(b.speedBonus).toBe(0);
  });

  it("脏输入不抛错也不产生 NaN", () => {
    for (const bad of [null, undefined, "abc", 42, [null, undefined, {}]]) {
      const b = computePassiveBonus(bad);
      expect(Number.isFinite(b.maxHp)).toBe(true);
      expect(Number.isFinite(b.speedBonus)).toBe(true);
    }
    const b = computePassiveBonus([mk("脏", { maxHp: "很多", speedBonus: null })]);
    expect(b.maxHp).toBe(0);
    expect(b.speedBonus).toBe(0);
  });
});

describe("effectiveMaxHp：内功被动叠进气血上限", () => {
  it("紫阳神功（+35）真的抬高上限", () => {
    const ziyang = SKILL_CATALOG.青城.find(s => s.name === "紫阳神功");
    expect(ziyang.passiveBonus.maxHp).toBe(35);
    expect(effectiveMaxHp(100, [ziyang])).toBe(135);
  });

  it("不带武学时等于原值（老存档/新号行为不变）", () => {
    expect(effectiveMaxHp(100, [])).toBe(100);
    expect(effectiveMaxHp(100, null)).toBe(100);
  });

  it("是派生值，不写回 hp[1]——同一个 base 反复调用结果稳定", () => {
    const sk = [mk("甲", { maxHp: 20 })];
    expect(effectiveMaxHp(100, sk)).toBe(120);
    expect(effectiveMaxHp(100, sk)).toBe(120); // 不会累积成 140
  });

  it("卸掉武学后上限自动减回去（写回存档就做不到这点）", () => {
    const sk = [mk("甲", { maxHp: 20 })];
    expect(effectiveMaxHp(100, sk)).toBe(120);
    expect(effectiveMaxHp(100, [])).toBe(100);
  });
});

describe("effectiveSpecial：轻功被动叠进身法", () => {
  it("梯云纵（身法+2）真的进了七维", () => {
    const ti = SKILL_CATALOG.青城.find(s => s.name === "梯云纵");
    expect(ti.passiveBonus.speedBonus).toBe(2);
    expect(effectiveSpecial({ 身法: 5 }, [], [ti]).身法).toBe(7);
  });

  it("清风步 + 梯云纵 累加（绿档入门 + 蓝档进阶）", () => {
    const q = SKILL_CATALOG.青城.find(s => s.name === "清风步");
    const t = SKILL_CATALOG.青城.find(s => s.name === "梯云纵");
    expect(effectiveSpecial({ 身法: 5 }, [], [q, t]).身法).toBe(8);
  });

  it("不传 skills 时行为与从前完全一致（老调用点不受影响）", () => {
    expect(effectiveSpecial({ 身法: 5 }, [])).toEqual({ 身法: 5 });
    expect(effectiveSpecial({ 身法: 5 }, [], undefined).身法).toBe(5);
  });

  it("装备 sixDim 与武学 speedBonus 同时生效、互不覆盖", () => {
    const inv = [{ id: "w", name: "测试剑", category: "weapon", equipped: true, sixDim: { 身法: 1, 悟性: 2 } }];
    const t = SKILL_CATALOG.青城.find(s => s.name === "梯云纵");
    const out = effectiveSpecial({ 身法: 5, 悟性: 5 }, inv, [t]);
    expect(out.身法).toBe(8); // 5 + 装备1 + 轻功2
    expect(out.悟性).toBe(7); // 装备只给悟性
  });

  it("基础值缺省按 5 起算（与 equipment.js 既有约定一致）", () => {
    const t = SKILL_CATALOG.青城.find(s => s.name === "梯云纵");
    expect(effectiveSpecial({}, [], [t]).身法).toBe(7);
  });
});

describe("青城武学目录扩充后的自洽", () => {
  const qc = SKILL_CATALOG.青城;

  it("九门齐备，剑法三阶都在", () => {
    const names = qc.map(s => s.name);
    for (const n of ["青城剑法", "松风剑法", "一字电剑", "紫阳神功", "青灵功", "清风步", "梯云纵"]) {
      expect(names, `青城缺了「${n}」`).toContain(n);
    }
  });

  it("剑法三阶品质递进（青城剑法 白 → 松风 绿 → 一字电剑 橙）", () => {
    const R = { 白: 0, 绿: 1, 蓝: 2, 紫: 3, 橙: 4, 红: 5 };
    const q = n => R[qc.find(s => s.name === n).quality];
    expect(q("青城剑法")).toBeLessThan(q("松风剑法"));
    expect(q("松风剑法")).toBeLessThan(q("一字电剑"));
  });

  it("一字电剑走 forceFirst（快如闪电落到现成标志位上，不是纯描述）", () => {
    expect(qc.find(s => s.name === "一字电剑").forceFirst).toBe(true);
  });

  it("不外卖的两门 price 为 0（梯云纵藏经阁、一字电剑练功堂秘传）", () => {
    expect(qc.find(s => s.name === "梯云纵").price).toBe(0);
    expect(qc.find(s => s.name === "一字电剑").price).toBe(0);
  });

  it("每门武学的 type 都是合法的三类之一", () => {
    const ok = new Set(Object.values(SKILL_TYPE));
    for (const [set, arr] of Object.entries(SKILL_CATALOG)) {
      for (const s of arr) expect(ok.has(s.type), `${set}·${s.name} 的 type「${s.type}」非法`).toBe(true);
    }
  });

  it("全目录的 passiveBonus 只用已接线的两个字段（防再出现死字段）", () => {
    const WIRED = new Set(["maxHp", "speedBonus"]);
    const bad = [];
    for (const [set, arr] of Object.entries(SKILL_CATALOG)) {
      for (const s of arr) {
        for (const k of Object.keys(s.passiveBonus || {})) {
          if (!WIRED.has(k)) bad.push(`${set}·${s.name} → ${k}`);
        }
      }
    }
    expect(bad, `passiveBonus 里出现了没有接线的字段（写了也不生效）：\n  ${bad.join("\n  ")}`).toEqual([]);
  });
});

// ── 武学的特效词条必须一路走到招式上、并且显示得出来 ──────────────────────
// 【被「所有武学破防什么什么的词条都实装了吗，右栏能显示吗」问出来的】
// deriveMoveFromSkill 原来只造 id/name/type/quality/energyCost + 一个倍率，
// 武学条目上写的 forceFirst / 破防 / 附异状那些标志位**一个都不往招式上抄**。
// 后果：整个武学体系派生出来的招除了类型和倍率之外完全一样；一字电剑写着
// 「无视身法强行先手」，打起来跟普通一剑毫无区别；右栏的 moveEffectBrief 也
// 永远是空的——显示线路本来就是通的，只是数据从没送到。
import { deriveMoveFromSkill, SKILL_EFFECT_KEYS } from "./npcGeneration.js";
import { moveEffectBrief } from "./itemEffectText.js";
import { MOVE_TYPE } from "./combat/moveTypes.js";

const moveSkills = () => Object.entries(SKILL_CATALOG)
  .flatMap(([set, arr]) => arr.filter(s => s.type === SKILL_TYPE.MOVE).map(s => ({ ...s, set })));

describe("武学特效：从条目 → 招式 → 界面，三段都要通", () => {
  it("武学身上的特效标志位会被抄到派生招式上", () => {
    for (const sk of moveSkills()) {
      const mv = deriveMoveFromSkill({ ...sk, stage: "大成" });
      for (const k of SKILL_EFFECT_KEYS) {
        if (sk[k] === undefined) continue;
        expect(mv[k], `${sk.set}·${sk.name} 的 ${k} 没被带到招式上`).toEqual(sk[k]);
      }
    }
  });

  it("一字电剑的「快如闪电」落在 forceFirst 上，并且真的传下去了", () => {
    const sk = moveSkills().find(s => s.name === "一字电剑");
    expect(sk.forceFirst).toBe(true);
    expect(deriveMoveFromSkill({ ...sk, stage: "大成" }).forceFirst).toBe(true);
  });

  it("每门带特效的武学，右栏那行都显示得出人话（翻不出来就是空白）", () => {
    const blank = [];
    for (const sk of moveSkills()) {
      const hasFx = SKILL_EFFECT_KEYS.some(k => sk[k] !== undefined);
      if (!hasFx) continue;
      const mv = deriveMoveFromSkill({ ...sk, stage: "大成" });
      if (!moveEffectBrief(mv)) blank.push(`${sk.set}·${sk.name}`);
    }
    expect(blank, `以下武学带了特效，但右栏那行会是空白：\n  ${blank.join("、")}`).toEqual([]);
  });

  it("招式类武学的 moveType 必须是三个上阵槽之一（否则买了也永远上不了阵）", () => {
    const slots = new Set(Object.values(MOVE_TYPE));
    const orphan = moveSkills().filter(s => !slots.has(s.moveType)).map(s => `${s.set}·${s.name}(${s.moveType})`);
    expect(orphan, `这些武学的 moveType 不在攻击/防御/状态三槽里，deriveMovesetFromSkills 永远匹配不到：\n  ${orphan.join("、")}`).toEqual([]);
  });

  it("SKILL_EFFECT_KEYS 白名单里的键都能被词典翻成人话（三处同源）", () => {
    const PARAM = new Set(["applyMarkChance", "applyMarkOnHit", "statusChance", "confuseChance"]);
    const bad = SKILL_EFFECT_KEYS.filter(k => !PARAM.has(k) && !EFFECT_CN[k]);
    expect(bad, `白名单允许抄这些键，但词典里没有词条，抄过去也显示不出来：${bad.join("、")}`).toEqual([]);
  });
});
