import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { QUCUO_SHOPS, buildShopInventory } from "./qucuoShops.js";

// 【群友实测反馈】"好奇怪，和实际银两不一样呀，雪山派的商铺显示值"。
// 历史：门派商坊曾用功德（karma）结算，TradingScreen 写死「银两/两」导致单位错位。
// 全势力合稿 §8.1 统一改回**银两 + 势力声誉折扣/门槛**（FACTION_SHOPS 接管）；
// karma 结算的 plumbing（currencyName/canSell/playerMoney 分支）保留在渲染层，
// 但目前没有任何商店声明 karma。

describe("门派商坊用银两结算（合稿 §8.1）", () => {
  it("shops 表里不再声明 karma", () => {
    expect(QUCUO_SHOPS["门派商坊"].currency).toBeUndefined();
  });

  it("当前没有 karma 商店", () => {
    const karmaShops = Object.entries(QUCUO_SHOPS).filter(([, v]) => v.currency === "karma");
    expect(karmaShops.map(([k]) => k)).toEqual([]);
  });

  it("货品有价（否则界面显示 undefined）", () => {
    for (const it of buildShopInventory("门派商坊").items) {
      expect(it.buyPrice, `${it.name} 没有 buyPrice`).toBeGreaterThan(0);
    }
  });
});

describe("TradingScreen 的货币名必须可传参（不许写死）", () => {
  const src = readFileSync("src/ui/screens/TradingScreen.jsx", "utf-8");

  it("组件接受 currencyName / currencyUnit / canSell", () => {
    expect(src).toMatch(/currencyName\s*=\s*"银两"/);
    expect(src).toMatch(/currencyUnit\s*=\s*"两"/);
    expect(src).toMatch(/canSell\s*=\s*true/);
  });

  it("渲染处不再出现写死的「两」字面量", () => {
    const bad = src.split("\n")
      .map((l, i) => [i + 1, l])
      .filter(([, l]) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      // JSX 里形如 }两< 或 "银两：" 这类写死单位
      .filter(([, l]) => /\}两[<\s]|银两：\{|"银两不足"/.test(l));
    expect(bad.map(([n, l]) => `${n}: ${l.trim().slice(0, 60)}`)).toEqual([]);
  });
});

describe("商店屏渲染层把功德单位与只出不进传下去", () => {
  const src = readFileSync("src/ui/panels/buildingScreens.jsx", "utf-8");

  it("按 isKarma 传货币名与单位", () => {
    expect(src).toMatch(/currencyName=\{isKarma \? "功德" : "银两"\}/);
    expect(src).toMatch(/currencyUnit=\{isKarma \? "点" : "两"\}/);
  });

  it("功德商店禁售（canSell={!isKarma}）——否则玩家点卖出没反应，看着像坏了", () => {
    expect(src).toMatch(/canSell=\{!isKarma\}/);
  });

  it("playerMoney 与扣款用同一种货币（数值侧本来就是对的，别改坏）", () => {
    expect(src).toMatch(/playerMoney=\{isKarma \? \(c\.dao\.karma \|\| 0\) : \(c\.char\.money \|\| 0\)\}/);
    expect(src).toMatch(/if \(isKarma\) \{ if \(\(c\.dao\.karma\|\|0\)<item\.buyPrice\) return; c\.captureUndo\(\); c\.setDao/);
  });
});
