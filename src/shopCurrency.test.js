import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { QUCUO_SHOPS, buildShopInventory } from "./shops/qucuoShops.js";

// 【群友实测反馈】"好奇怪，和实际银两不一样呀，雪山派的商铺显示值"。
// 雪山派门派商坊用**功德**结算（QUCUO_SHOPS 里 currency:"karma"），
// CenterPanel 也确实把 dao.karma 当 playerMoney 传进去、买的时候扣的也是 karma
// ——数值一直是对的。错的是 TradingScreen 里**五处把单位写死成"银两/两"**，
// 于是界面显示「银两：37 两」，玩家一对自己的实际银两就发现对不上。
// 这类"数值对、字错了"的 bug 特别容易让人怀疑是结算坏了。

describe("门派商坊用功德结算", () => {
  it("shops 表里声明了 karma 货币", () => {
    expect(QUCUO_SHOPS["门派商坊"].currency).toBe("karma");
  });

  it("其余商店不声明货币（默认银两）", () => {
    const karmaShops = Object.entries(QUCUO_SHOPS).filter(([, v]) => v.currency === "karma");
    expect(karmaShops.map(([k]) => k)).toEqual(["门派商坊"]);
  });

  it("货品有价（否则界面显示 undefined）", () => {
    for (const it of buildShopInventory("门派商坊").items) {
      expect(it.buyPrice, `${it.name} 没有 buyPrice`).toBeGreaterThan(0);
    }
  });
});

describe("TradingScreen 的货币名必须可传参（不许写死）", () => {
  const src = readFileSync("src/TradingScreen.jsx", "utf-8");

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

describe("CenterPanel 把功德单位与只出不进传下去", () => {
  const src = readFileSync("src/panels/CenterPanel.jsx", "utf-8");

  it("按 isKarma 传货币名与单位", () => {
    expect(src).toMatch(/currencyName=\{isKarma \? "功德" : "银两"\}/);
    expect(src).toMatch(/currencyUnit=\{isKarma \? "点" : "两"\}/);
  });

  it("功德商店禁售（canSell={!isKarma}）——否则玩家点卖出没反应，看着像坏了", () => {
    expect(src).toMatch(/canSell=\{!isKarma\}/);
  });

  it("playerMoney 与扣款用同一种货币（数值侧本来就是对的，别改坏）", () => {
    expect(src).toMatch(/playerMoney=\{isKarma \? \(dao\.karma \|\| 0\) : \(char\.money \|\| 0\)\}/);
    expect(src).toMatch(/if \(isKarma\) \{ if \(\(dao\.karma\|\|0\)<item\.buyPrice\) return; setDao/);
  });
});
