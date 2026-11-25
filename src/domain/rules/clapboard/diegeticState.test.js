import { describe, expect, it } from "vitest";
import { buildDiegeticState, renderDiegeticState } from "./diegeticState.js";

describe("buildDiegeticState", () => {
  it("输出三句：气血/穿戴/囊中天时，同输入恒同输出", () => {
    const input = { char: { hp: [80, 100], money: 50, neigong: 30 }, inv: [], time: 30 };
    const out = buildDiegeticState(input);
    expect(out).toHaveLength(3);
    expect(buildDiegeticState(input)).toEqual(out);
  });

  it("气血伤势档：<30% 重伤渗血、<60% 带伤气喘、>=60% 按内外功写气息", () => {
    expect(buildDiegeticState({ char: { hp: [20, 100] } })[0]).toContain("渗血");
    expect(buildDiegeticState({ char: { hp: [50, 100] } })[0]).toContain("喘");
    expect(buildDiegeticState({ char: { hp: [90, 100], neigong: 70 } })[0]).toContain("渊深");
    expect(buildDiegeticState({ char: { hp: [90, 100], waigong: 30 } })[0]).toContain("步履轻快");
    expect(buildDiegeticState({ char: { hp: [90, 100] } })[0]).toContain("根基尚浅");
  });

  it("显眼穿戴：紫橙红名器点名；衣不蔽体/身无寸铁点明", () => {
    const inv = [
      { name: "断念剑", quality: "橙", category: "weapon", equipped: true },
      { name: "皮袄", quality: "白", category: "armor", equipped: true },
    ];
    expect(buildDiegeticState({ char: {}, inv })[1]).toContain("断念剑");
    // 无甲无武器
    const bare = buildDiegeticState({ char: {}, inv: [] })[1];
    expect(bare).toContain("衣不蔽体");
    expect(bare).toContain("身无寸铁");
    // 齐整但不扎眼
    const plain = buildDiegeticState({ char: {}, inv: [
      { name: "铁剑", quality: "白", category: "weapon", equipped: true },
      { name: "布衣", quality: "白", category: "armor", equipped: true },
    ] })[1];
    expect(plain).toContain("不惹目");
  });

  it("囊中窘阔与昼夜节气：银两档位 + 时辰 + 节气", () => {
    expect(buildDiegeticState({ char: { money: 2 }, time: 0 })[2]).toContain("囊中羞涩");
    expect(buildDiegeticState({ char: { money: 200 }, time: 0 })[2]).toContain("肥实");
    // time 0 = 第1日子时
    expect(buildDiegeticState({ char: {}, time: 0 })[2]).toContain("子夜");
    expect(buildDiegeticState({ char: {}, time: 12 })[2]).toContain("正午");
    expect(buildDiegeticState({ char: {}, time: 0 })[2]).toContain("节气近");
  });

  it("renderDiegeticState 换行拼接", () => {
    const text = renderDiegeticState({ char: { hp: [10, 100] }, inv: [], time: 0 });
    expect(text.split("\n")).toHaveLength(3);
  });
});
