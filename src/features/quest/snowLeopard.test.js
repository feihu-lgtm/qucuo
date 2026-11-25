// WO-16C-snow：自由文本挠痒/喂食确定性判定
import { describe, expect, it } from "vitest";
import { resolveSnowInteraction, snowLeopardRule } from "./snowLeopard.js";
import { filterSnowModelFlags } from "../../domain/rules/quests/snowLeopardQuest.js";

const base = (overrides = {}) => ({
  questProgress: { snow_leopard_quest: { status: "active" } },
  flags: [],
  inv: [{ id: "m1", name: "羊肉" }],
  room: { name: "鱼定村", npcs: [{ name: "雪豹" }] },
  innerRoomName: null,
  char: { special: {} },
  companionState: {},
  skills: [],
  time: 1,
  ...overrides,
});

describe("resolveSnowInteraction 触发面", () => {
  it("肯定挠痒触发 scratch", () => {
    const r = resolveSnowInteraction(base(), "给雪豹挠痒痒");
    expect(r.kind).toBe("scratch");
    expect(r.changes.flags([])).toContain("snow_spirit_scratch");
  });
  it("肯定喂肉触发 feed，扣一件肉写旗", () => {
    const r = resolveSnowInteraction(base(), "喂雪豹吃肉");
    expect(r.kind).toBe("feed");
    expect(r.changes.flags([])).toContain("snow_spirit_meat");
    expect(r.changes.inv(base().inv)).toHaveLength(0); // 一件肉被扣
  });
  it("多件肉只扣一件", () => {
    const st = base({ inv: [{ id: "m1", name: "羊肉" }, { id: "m2", name: "牛肉干" }] });
    const r = resolveSnowInteraction(st, "喂雪豹吃肉");
    expect(r.changes.inv(st.inv)).toHaveLength(1);
  });
  it.each(["不给雪豹挠痒", "别喂雪豹", "要不要喂雪豹？", "如果喂雪豹会怎样", "喂雪豹吃肉了吗", "假如我帮雪豹挠痒"])(
    "否定/询问/假设不触发：%s", (cmd) => {
      expect(resolveSnowInteraction(base(), cmd)).toBeNull();
    });
  it("无肉不触发喂食", () => {
    expect(resolveSnowInteraction(base({ inv: [] }), "喂雪豹吃肉")).toBeNull();
    expect(resolveSnowInteraction(base({ inv: [{ id: "x", name: "青稞饼" }] }), "喂雪豹吃肉")).toBeNull();
  });
  it("非肉食不触发", () => {
    expect(resolveSnowInteraction(base({ inv: [{ id: "x", name: "绷带" }] }), "喂雪豹吃肉")).toBeNull();
  });
  it("幂等：flag 已有不重复触发", () => {
    expect(resolveSnowInteraction(base({ flags: ["snow_spirit_meat"] }), "喂雪豹吃肉")).toBeNull();
    expect(resolveSnowInteraction(base({ flags: ["snow_spirit_scratch"] }), "给雪豹挠痒痒")).toBeNull();
  });
  it("任务未激活/雪豹不在场不触发", () => {
    expect(resolveSnowInteraction(base({ questProgress: {} }), "给雪豹挠痒痒")).toBeNull();
    expect(resolveSnowInteraction(base({ room: { name: "鱼定村", npcs: [] } }), "给雪豹挠痒痒")).toBeNull();
  });
  it("无关指令不触发", () => {
    expect(resolveSnowInteraction(base(), "四处看看")).toBeNull();
  });
  it("自挠/旁观不误触发：雪豹不是被挠对象", () => {
    expect(resolveSnowInteraction(base(), "雪豹看着我，我挠挠头")).toBeNull();
    expect(resolveSnowInteraction(base(), "我挠挠自己的背，雪豹眯着眼")).toBeNull();
  });
  it("点名非肉不触发，不偷扣背包里的肉", () => {
    const st = base({ inv: [{ id: "m1", name: "羊肉" }, { id: "b1", name: "青稞饼" }] });
    expect(resolveSnowInteraction(st, "喂雪豹吃青稞饼")).toBeNull();
    expect(resolveSnowInteraction(st, "把青稞饼喂给雪豹")).toBeNull();
  });
  it("点名为肉扣该件，不扣错件", () => {
    const st = base({ inv: [{ id: "m1", name: "羊肉" }, { id: "m2", name: "牛肉干" }] });
    const r = resolveSnowInteraction(st, "把牛肉干喂雪豹");
    expect(r.kind).toBe("feed");
    const after = r.changes.inv(st.inv);
    expect(after).toHaveLength(1);
    expect(after[0].name).toBe("羊肉"); // 牛肉干被精确扣掉
  });
  it("喂雪豹吃X 句式点名", () => {
    const st = base({ inv: [{ id: "m1", name: "羊肉" }, { id: "m2", name: "牛肉干" }] });
    const r = resolveSnowInteraction(st, "喂雪豹吃牛肉干");
    expect(r.changes.inv(st.inv).map((e) => e.name)).toEqual(["羊肉"]);
  });
  it("名字前缀重叠时优先更长名称", () => {
    const st = base({ inv: [{ id: "m1", name: "羊肉" }, { id: "m2", name: "羊肉干" }] });
    const r = resolveSnowInteraction(st, "把羊肉干喂雪豹");
    expect(r.changes.inv(st.inv).map((e) => e.name)).toEqual(["羊肉"]); // 扣羊肉干不扣羊肉
  });
  it("否定挂在给/吃上也不触发", () => {
    expect(resolveSnowInteraction(base(), "不给雪豹吃肉")).toBeNull();
    expect(resolveSnowInteraction(base(), "别给雪豹喂食")).toBeNull();
  });
  it("怎么/如何问法不触发", () => {
    expect(resolveSnowInteraction(base(), "怎么喂雪豹")).toBeNull();
    expect(resolveSnowInteraction(base(), "如何给雪豹挠痒")).toBeNull();
  });
  it("乳制品不算肉", () => {
    const st = base({ inv: [{ id: "d1", name: "牦牛奶酪" }, { id: "d2", name: "奶渣" }] });
    expect(resolveSnowInteraction(st, "喂雪豹吃肉")).toBeNull();
  });
  it("点名了身上没有的东西不触发，不偷换", () => {
    const st = base({ inv: [{ id: "m1", name: "羊肉" }] });
    expect(resolveSnowInteraction(st, "喂雪豹吃牛肉干")).toBeNull();
    expect(resolveSnowInteraction(st, "把鹿腿喂雪豹")).toBeNull();
    // 泛称仍允许回落
    expect(resolveSnowInteraction(st, "喂雪豹吃肉")?.kind).toBe("feed");
  });
  it("量词泛称仍可回落：把一块肉喂给雪豹", () => {
    const st = base();
    expect(resolveSnowInteraction(st, "把一块肉喂给雪豹")?.kind).toBe("feed");
    expect(resolveSnowInteraction(st, "喂雪豹吃肉吧")?.kind).toBe("feed");
  });
  it("我不吃的X 是定语不是否定喂食", () => {
    const st = base({ inv: [{ id: "m1", name: "风干牦牛肉" }] });
    expect(resolveSnowInteraction(st, "把我不吃的风干牦牛肉喂给雪豹")?.kind).toBe("feed");
  });
  it("陈述句含怎么不误伤：我知道怎么做了", () => {
    expect(resolveSnowInteraction(base(), "我知道怎么做了，给雪豹挠痒")?.kind).toBe("scratch");
  });
  it("长距离疑问（怎么才能安全地喂）不触发", () => {
    expect(resolveSnowInteraction(base(), "怎么才能安全地喂雪豹吃肉")).toBeNull();
    expect(resolveSnowInteraction(base(), "怎么才能帮雪豹挠痒")).toBeNull();
  });
  it("整句禁止式别把不触发", () => {
    const st = base({ inv: [{ id: "m1", name: "羊肉" }] });
    expect(resolveSnowInteraction(st, "别把我不吃的羊肉喂给雪豹")).toBeNull();
  });
  it("没把是过去陈述非禁止", () => {
    const st = base({ inv: [{ id: "m1", name: "羊肉" }] });
    expect(resolveSnowInteraction(st, "我没把羊肉烤熟，直接喂雪豹")?.kind).toBe("feed");
  });
  it("冒号后陈述不误伤", () => {
    expect(resolveSnowInteraction(base(), "我知道怎么做了：我给雪豹挠痒")?.kind).toBe("scratch");
  });
  it("我没把肉喂给雪豹是过去否定不触发", () => {
    const st = base({ inv: [{ id: "m1", name: "风干牦牛肉" }] });
    expect(resolveSnowInteraction(st, "我没把风干牦牛肉喂给雪豹")).toBeNull();
  });
  it("请告诉我怎么做是求助不触发", () => {
    expect(resolveSnowInteraction(base(), "请告诉我怎么做：喂雪豹吃肉")).toBeNull();
  });
  it("未点名时取背包第一块肉", () => {
    const st = base({ inv: [{ id: "b1", name: "青稞饼" }, { id: "m1", name: "羊肉" }, { id: "m2", name: "牛肉干" }] });
    const r = resolveSnowInteraction(st, "喂雪豹吃肉");
    expect(r.changes.inv(st.inv).map((e) => e.name)).toEqual(["青稞饼", "牛肉干"]);
  });
});

describe("quest rule 能吃到确定性 flag", () => {
  it("feed 落下的 flag 进 snowLeopardRule 统计", () => {
    const st = base({ flags: ["snow_spirit_meat", "snow_spirit_scratch", "snow_spirit_village", "snow_spirit_strength"] });
    // 已有四灵，rule 对魅力等其余检查不过时不新增——此处验证 flag 形状被 rule 直接消费
    const out = snowLeopardRule.run(st, {});
    // 不报错、且不改写已有旗（幂等）
    if (out?.changes?.flags) {
      const next = out.changes.flags(st.flags);
      expect(new Set(next).size).toBe(next.length);
    }
  });
});

describe("filterSnowModelFlags 收紧", () => {
  it("模型写的 snow 旗一律剥除（含 meat/scratch），非 snow 旗放行", () => {
    const st = base();
    const out = filterSnowModelFlags(["snow_spirit_meat", "snow_spirit_scratch", "other_flag"], st);
    expect(out).toEqual(["other_flag"]);
  });
});
