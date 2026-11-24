// 地宫房间事件 resolver 契约测试：十 kind 各一路径 + 检定失败分支。
import { describe, expect, it } from "vitest";
import { resolveRoomEvent, ROOM_EVENT_KINDS } from "./events.js";
import { DUNGEON_DISTRICTS_ALL } from "../../data/dungeon/districts.js";

const hiRng = () => 0;      // 检定必过
const loRng = () => 0.999;  // 检定必挂（最高 95% 也够不着）
const attrs = { agility: 10, wisdom: 10, combat: 10, stealth: 10, charm: 10, craft: 10, luck: 10, inner: 10, body: 10, strength: 10 };

describe("resolveRoomEvent 十类处理器", () => {
  it("kind 集合与十宫 eventSeeds 完全对齐", () => {
    const kinds = new Set();
    for (const cfg of Object.values(DUNGEON_DISTRICTS_ALL)) {
      for (const s of cfg.eventSeeds || []) kinds.add(s.kind);
    }
    expect([...kinds].sort()).toEqual([...ROOM_EVENT_KINDS].sort());
  });

  it("fight 产 combatNpc 且来自 buildCombatNpc", () => {
    const r = resolveRoomEvent("fight", { kind: "fight", desc: "巡僧遭遇战", check: "combat", dc: 6, outcome: "胜得残页", enemy: { id: "t1", name: "巡僧", levelCap: 3 } }, { attrs, rng: hiRng });
    expect(r.combatNpc).toBeTruthy();
    expect(r.combatNpc.name).toBe("巡僧");
    expect(r.effects[0].type).toBe("combat");
    expect(r.log).toContain("巡僧遭遇战");
  });

  it("event 成功走 outcome，失败给 hp_loss 骨架", () => {
    const seed = { kind: "event", desc: "翻板跌落", check: "agility", dc: 6, outcome: "掉血" };
    const ok = resolveRoomEvent("event", seed, { attrs, rng: hiRng });
    expect(ok.effects[0].success).toBe(true);
    const fail = resolveRoomEvent("event", seed, { attrs: { agility: 0 }, rng: loRng });
    expect(fail.effects.some((e) => e.type === "hp_loss")).toBe(true);
    expect(fail.log).toContain("失当");
  });

  it("nsfw 给 nsfwBranch 双选项", () => {
    const r = resolveRoomEvent("nsfw", { kind: "nsfw", desc: "催情香", check: "inner", dc: 5, outcome: "逼毒" }, { attrs, rng: hiRng });
    expect(r.nsfwBranch.options).toHaveLength(2);
    expect(r.nsfwBranch.options[0].check).toBe("inner");
    expect(r.nsfwBranch.options[1].effect.type).toBe("leave");
  });

  it("supply 免检定给补给", () => {
    const r = resolveRoomEvent("supply", { kind: "supply", desc: "搜刮金疮药", check: null, dc: 0, outcome: "补给若干" }, { attrs, rng: hiRng });
    expect(r.lootDelta.supplies).toBe(1);
    expect(r.effects[0].type).toBe("supply");
  });

  it("loot 成功给银钱，失败空手", () => {
    const seed = { kind: "loot", desc: "佛龛宝匣", check: "craft", dc: 7, outcome: "品阶装备" };
    const ok = resolveRoomEvent("loot", seed, { attrs, rng: hiRng });
    expect(ok.lootDelta.money).toBeGreaterThanOrEqual(20);
    expect(ok.effects[0].success).toBe(true);
    const fail = resolveRoomEvent("loot", seed, { attrs: { craft: 0 }, rng: loRng });
    expect(fail.lootDelta.money).toBeUndefined();
  });

  it("watch 给三选分支", () => {
    const r = resolveRoomEvent("watch", { kind: "watch", desc: "看武僧切磋", check: "stealth", dc: 4, outcome: "招式感悟" }, { attrs, rng: hiRng });
    expect(r.branch.options).toHaveLength(3);
    expect(r.branch.options[1].effect.type).toBe("intervene");
  });

  it("meet 给结交/避开分支", () => {
    const r = resolveRoomEvent("meet", { kind: "meet", desc: "寻宝散人", check: "charm", dc: 5, outcome: "雇佣随行" }, { attrs, rng: hiRng });
    expect(r.branch.options[0].effect.type).toBe("companion_offer");
    expect(r.branch.options[0].check).toBe("charm");
  });

  it("appraise 成败各落标记", () => {
    const seed = { kind: "appraise", desc: "鉴定唐卡", check: "wisdom", dc: 7, outcome: "真品" };
    const ok = resolveRoomEvent("appraise", seed, { attrs, rng: hiRng });
    expect(ok.effects.find((e) => e.type === "appraise").success).toBe(true);
    const fail = resolveRoomEvent("appraise", seed, { attrs: { wisdom: 0 }, rng: loRng });
    expect(fail.effects.find((e) => e.type === "appraise").success).toBe(false);
  });

  it("puzzle 挂谜题模板实例", () => {
    const r = resolveRoomEvent("puzzle", {
      kind: "puzzle", desc: "唐卡复位", check: "wisdom", dc: 6, outcome: "暗门",
      puzzleType: "sequenceReset",
      puzzleConfig: { items: ["割肉", "喂鹰", "成佛"], stat: "wisdom", dc: 6, prompt: "重挂唐卡" },
    }, { attrs, rng: hiRng });
    const inst = r.effects[0].instance;
    expect(inst.type).toBe("sequenceReset");
    expect(inst.actions().length).toBeGreaterThan(0);
  });

  it("checkpoint 免检定存档", () => {
    const r = resolveRoomEvent("checkpoint", { kind: "checkpoint", desc: "锚点房", check: null, dc: 0, outcome: "存点" }, { attrs, rng: hiRng });
    expect(r.effects[0].type).toBe("checkpoint");
  });

  it("未知 kind 抛错", () => {
    expect(() => resolveRoomEvent("bogus", {}, {})).toThrow(/未知地宫事件类型/);
  });

  it("十宫每个 eventSeed 都能出合法结果", () => {
    for (const cfg of Object.values(DUNGEON_DISTRICTS_ALL)) {
      for (const s of cfg.eventSeeds || []) {
        if (s.kind === "puzzle") {
          // catalog 里的 puzzle seed 不带 puzzleType——挂本宫 puzzle 配置
          const cfgPuzzle = DUNGEON_DISTRICTS_ALL[Object.keys(DUNGEON_DISTRICTS_ALL).find((k) => DUNGEON_DISTRICTS_ALL[k] === cfg)].puzzle;
          s.puzzleType = cfgPuzzle.type; s.puzzleConfig = cfgPuzzle.config;
        }
        const r = resolveRoomEvent(s.kind, s, { attrs, rng: hiRng });
        expect(r.log.length).toBeGreaterThan(0);
        expect(r).toHaveProperty("effects");
        expect(r).toHaveProperty("lootDelta");
      }
    }
  });
});
