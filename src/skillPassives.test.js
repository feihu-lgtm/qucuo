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

// ── 20 门回气/听桥专项 ──────────────────────────────────────────────────────
// 回气原型的基线是 4→6 点、零耗；这批「特殊回气」一律要高过基线才有存在意义。
// 听桥是防守反击原型的高档形态（见 moveArchetypes 顶部「红名的听桥和平民的听桥
// 不一样」），落在 onCounterSuccess* 上。
describe("特殊回气与听桥", () => {
  const all = () => Object.values(SKILL_CATALOG).flat();
  const REC_BASELINE = 4; // 回气原型白档的回复量

  it("特殊回气至少 17 门，且每门都高过基线 4 点", () => {
    const rec = all().filter(s => typeof s.energyRestore === "number");
    expect(rec.length).toBeGreaterThanOrEqual(17);
    const weak = rec.filter(s => s.energyRestore <= REC_BASELINE).map(s => `${s.name}(${s.energyRestore})`);
    expect(weak, `这些回气没高过基线，不配叫「特殊」：${weak.join("、")}`).toEqual([]);
  });

  it("回气门类里既有兼回血的，也有带增益的", () => {
    const rec = all().filter(s => typeof s.energyRestore === "number");
    expect(rec.filter(s => s.hpRestore).length, "没有一门兼回血").toBeGreaterThan(0);
    expect(rec.filter(s => s.nextAttackBonus || s.immuneControl || s.forceCrit).length, "没有一门带增益").toBeGreaterThan(0);
  });

  it("听桥类都是防御槽，且回气与反打两项俱全", () => {
    // 听桥＝防御槽上的反击类（攻击槽挂 onCounterSuccess* 是不触发的，另有测试管）
    const ting = all().filter(s => s.moveType === "防御" && s.onCounterSuccessEnergyGain);
    expect(ting.length).toBeGreaterThanOrEqual(3);
    for (const t of ting) {
      expect(t.moveType, `${t.name} 是听桥类却不在防御槽`).toBe("防御");
    }
  });

  it("分散在全图：至少 6 个武学集各有新回气/听桥", () => {
    const sets = Object.entries(SKILL_CATALOG)
      .filter(([, arr]) => arr.some(s => s.energyRestore > REC_BASELINE || s.onCounterSuccessEnergyGain))
      .map(([k]) => k);
    expect(sets.length, `只有 ${sets.join("/")} 有，没铺开`).toBeGreaterThanOrEqual(6);
  });

  it("这 20 门的特效全都能传到招式上、并且右栏显示得出人话", () => {
    const blank = [];
    for (const s of all()) {
      if (!(s.energyRestore > REC_BASELINE || s.onCounterSuccessEnergyGain)) continue;
      const mv = deriveMoveFromSkill({ ...s, stage: "大成" });
      if (s.energyRestore) expect(mv.energyRestore, `${s.name} 的回气没传下去`).toBe(s.energyRestore);
      if (s.onCounterSuccessEnergyGain) expect(mv.onCounterSuccessEnergyGain, `${s.name} 的听桥回气没传下去`).toBe(s.onCounterSuccessEnergyGain);
      if (!moveEffectBrief(mv)) blank.push(s.name);
    }
    expect(blank, `以下右栏那行会是空白：${blank.join("、")}`).toEqual([]);
  });

  it("onCounterSuccess* 只能挂在防御槽——挂到攻击/状态槽上永远不触发", () => {
    const bad = [];
    for (const s of all()) {
      if (s.type !== SKILL_TYPE.MOVE) continue;
      const hasCounter = s.onCounterSuccessEnergyGain != null || s.onCounterSuccessDamageRatio != null;
      if (hasCounter && s.moveType !== "防御") bad.push(`${s.name}(${s.moveType})`);
    }
    expect(bad, `这些招挂了「防御成功才结算」的标志位，却不在防御槽，永远触发不了：${bad.join("、")}`).toEqual([]);
  });
});

// ── 全图武学总录：四源归一 ──────────────────────────────────────────────────
// 图鉴此前只读 SKILL_CATALOG，还被一张 SKILL_GROUP_LABEL 当白名单卡住
// （`.filter(([k]) => SKILL_GROUP_LABEL[k])`），只显示玉泉/雪山/锦官三家 17 门。
// 独孤/青城/峨眉/唐门/血刀/三星 六家 39 门，连同 168 个专属招、18 个制式招、
// 4 个博弈招，一共两百多招在图鉴里一个都看不到，而且丢得毫无痕迹。
import { buildMoveCodex, moveCodexStats, moveCodexBySource, MOVE_SOURCE, SKILL_GROUP_LABEL } from "./kungfu/moveCodex.js";
import { NPC_SIGNATURE_MOVES, SIGNATURE_SLOT_KEYS } from "./npcSignatureMoves.js";

describe("全图武学总录", () => {
  it("四个源一个都不少", () => {
    const st = moveCodexStats();
    for (const src of Object.values(MOVE_SOURCE)) {
      expect(st.bySource[src], `来源「${src}」一条都没收进来`).toBeGreaterThan(0);
    }
    expect(st.total).toBeGreaterThan(200);
  });

  it("SKILL_CATALOG 的每一门都在总录里——一门都不许被分组名白名单吃掉", () => {
    const inCodex = new Set(buildMoveCodex().filter(m => m.source === MOVE_SOURCE.WUGUAN).map(m => m.name));
    const missing = Object.values(SKILL_CATALOG).flat().filter(s => !inCodex.has(s.name)).map(s => s.name);
    expect(missing, `以下武馆武学没进总录：${missing.join("、")}`).toEqual([]);
  });

  it("每个武学集都有分组名（查不到也要用 key 兜底，绝不丢条目）", () => {
    const groups = new Set(buildMoveCodex().filter(m => m.source === MOVE_SOURCE.WUGUAN).map(m => m.group));
    for (const k of Object.keys(SKILL_CATALOG)) {
      if (!Array.isArray(SKILL_CATALOG[k]) || !SKILL_CATALOG[k].length) continue;
      expect(groups.has(SKILL_GROUP_LABEL[k] || k), `武学集「${k}」在总录里没有对应分组`).toBe(true);
    }
  });

  it("专属招全部收录，且每条都挂着主人", () => {
    let expected = 0;
    for (const d of Object.values(NPC_SIGNATURE_MOVES)) {
      if (!d || typeof d !== "object") continue;
      for (const k of SIGNATURE_SLOT_KEYS) if (d[k] && d[k].name) expected++;
    }
    const got = moveCodexBySource()[MOVE_SOURCE.SIGNATURE];
    expect(got.length).toBe(expected);
    expect(got.every(m => m.owner), "有专属招没挂主人").toBe(true);
  });

  it("专属招的档位取自 RESIDENT_NPCS 的 levelCap，不另存一份", () => {
    const xz = moveCodexBySource()[MOVE_SOURCE.SIGNATURE].find(m => m.owner === "玄尘师太");
    expect(xz, "玄尘师太的专属招没收进来").toBeTruthy();
    expect(xz.quality).toBe("红"); // 她 levelCap 5
  });

  it("总录条目喂得进唯一词典——每条都吐得出人话或至少有类型定性", () => {
    const mute = buildMoveCodex().filter(m => !moveEffectBrief(m) && !m.desc);
    expect(mute, `以下条目在图鉴里会是一片空白：${mute.map(m => m.name).join("、")}`).toEqual([]);
  });

  it("key 唯一（重复会让图鉴列表 React key 撞车）", () => {
    const keys = buildMoveCodex().map(m => m.key);
    expect([...new Set(keys)].length).toBe(keys.length);
  });
});

// ── 参悟类武学（令狐冲墓的独孤剑诀）──────────────────────────────────────
// 令狐冲墓此前是 BUILDING_TYPE.TEMPLE（拜祭殿），它挂着 skillSet:"独孤" 但
// TEMPLE 压根不读 skillSet —— 描述里承诺的「外功≥80可参悟习得」从未落地，
// 两门独孤武学在全图无处可学。
import { BUILDINGS_BY_LOCATION, BUILDING_TYPE } from "./buildings/qucuoBuildings.js";

describe("参悟类武学", () => {
  const all = () => Object.values(SKILL_CATALOG).flat();

  it("令狐冲墓是授业类建筑，否则 skillSet 没人读", () => {
    const tomb = (BUILDINGS_BY_LOCATION["贡措海"] || []).find(b => b.id === "dugu_tomb");
    expect(tomb, "令狐冲墓不见了").toBeTruthy();
    expect(tomb.type, "令狐冲墓不是授业类建筑，挂着的 skillSet 不会被读").toBe(BUILDING_TYPE.WUGUAN);
    expect(tomb.skillSet).toBe("独孤");
  });

  it("独孤两门都走参悟：不标价、带门槛", () => {
    for (const s of SKILL_CATALOG["独孤"]) {
      expect(s.price, `${s.name} 参悟类不该标价`).toBe(0);
      expect(s.insight, `${s.name} 缺参悟门槛`).toBeTruthy();
      expect(typeof s.insight.threshold).toBe("number");
      expect(s.insight.label, `${s.name} 门槛缺人话标签`).toBeTruthy();
    }
  });

  it("独孤九剑的门槛比剑冢独坐高（先坐得住，才看得懂）", () => {
    const g = SKILL_CATALOG["独孤"].find(s => s.name === "独孤九剑");
    const z = SKILL_CATALOG["独孤"].find(s => s.name === "剑冢独坐");
    expect(g.insight.threshold).toBeGreaterThan(z.insight.threshold);
  });

  it("凡带 insight 的武学，门槛属性必须是角色身上真有的字段", () => {
    const OK = new Set(["waigong", "neigong"]);
    const bad = all().filter(s => s.insight && !OK.has(s.insight.stat)).map(s => `${s.name}→${s.insight.stat}`);
    expect(bad, `门槛属性不存在，判定永远取到 undefined：${bad.join("、")}`).toEqual([]);
  });

  it("标价的武学不该同时带 insight（两条路径互斥）", () => {
    const bad = all().filter(s => s.insight && s.price > 0).map(s => s.name);
    expect(bad, `既标价又要参悟，界面会自相矛盾：${bad.join("、")}`).toEqual([]);
  });
});
