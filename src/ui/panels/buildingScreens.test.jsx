import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BUILDING_SCREENS } from "./buildingScreens.jsx";
import { BUILDING_TYPE } from "../../domain/data/buildings/qucuoBuildings.js";
import TradingScreen from "../screens/TradingScreen.jsx";
import EscortScreen from "../screens/buildings/EscortScreen.jsx";
import ForgeScreen from "../screens/buildings/ForgeScreen.jsx";
import JadeShopScreen from "../screens/buildings/JadeShopScreen.jsx";

vi.mock("../../domain/data/shops/qucuoShops.js", () => ({
  rollShopStock: vi.fn(() => null),
  buildShopInventory: vi.fn(() => ({ shopName: "测试商铺", items: [], currency: "money" })),
}));

// CenterPanel 打包 ctx 的最小替身：渲染函数只取字段、不真渲染。
function makeCtx(overrides = {}) {
  return {
    building: { type: BUILDING_TYPE.SHOP, name: "铺子" },
    char: { money: 100 }, time: 6, zoneTheme: {}, inv: [], skills: [], flags: [],
    questProgress: {}, dao: {}, mapData: {}, room: { name: "鱼定村", npcs: [] },
    innerRoomName: null, varTree: { 世界: {} }, queueCount: 0, effectiveSpecialNow: {},
    craftTab: "shop", tabs: vi.fn(() => null), isJade: false,
    runCommand: vi.fn(), captureUndo: vi.fn(), setDao: vi.fn(), setChar: vi.fn(),
    setInv: vi.fn(), addLog: vi.fn(), jotNote: vi.fn(), inspectItem: vi.fn(),
    setGambleStoneMinimized: vi.fn(), gambleNegotiation: null,
    deposit: 0, depositedAt: null, pledgedItems: [], sectMasterAffection: 0,
    closeBuilding: vi.fn(), openBasement: vi.fn(),
    ...overrides,
  };
}

// 契约：每种 BUILDING_TYPE 都在映射表里有登记，漏登记会在 CenterPanel 静默渲染空白。
describe("BUILDING_SCREENS 覆盖", () => {
  it.each(Object.values(BUILDING_TYPE))("registers a screen for type %s", (type) => {
    expect(BUILDING_SCREENS[type], type).toBeTypeOf("function");
  });

  // 契约：映射表里没有 BUILDING_TYPE 以外的键——tradingShop/Basement 这类
  // 由独立状态驱动的屏不走表，也不会被误登记进来。
  it("contains no keys outside BUILDING_TYPE", () => {
    const known = new Set(Object.values(BUILDING_TYPE));
    for (const key of Object.keys(BUILDING_SCREENS)) {
      expect(known.has(key), key).toBe(true);
    }
  });
});

describe("店铺建筑专图", () => {
  it("在专图店铺的交易面板显示头图，普通交易不显示通用建筑图", () => {
    const renderShop = (id) => renderToStaticMarkup(BUILDING_SCREENS[BUILDING_TYPE.SHOP](makeCtx({
      building: { id, type: BUILDING_TYPE.SHOP, name: "雪域珍宝行", shopKey: "雪域珍宝行" },
    })));
    expect(renderShop("shop_dajianlu")).toContain('src="/art/building/shop_dajianlu.webp"');
    expect(renderShop("not_registered")).not.toContain("/art/building/");
  });
});

// 契约：镖局是双形态——无 shopKey 走护镖任务屏（EscortScreen），
// 带 shopKey 的镖局卖防身器，走商店屏（TradingScreen）。
describe("ESCORT 分支", () => {
  it("renders EscortScreen for an escort without shopKey", () => {
    const el = BUILDING_SCREENS[BUILDING_TYPE.ESCORT](makeCtx({
      building: { type: BUILDING_TYPE.ESCORT, name: "镖局" },
    }));

    expect(el.type).toBe(EscortScreen);
  });

  it("renders TradingScreen for an escort with shopKey", () => {
    const el = BUILDING_SCREENS[BUILDING_TYPE.ESCORT](makeCtx({
      building: { type: BUILDING_TYPE.ESCORT, name: "镖局", shopKey: "escort_shop" },
    }));

    expect(el.type).toBe(TradingScreen);
  });
});

// 契约：现货+定制双页签铺子——craftTab==="shop" 给现货 TradingScreen，
// 否则按 isJade 分流到 JadeShopScreen/ForgeScreen 定制页。
describe("craft 双页签", () => {
  const forgeBuilding = { type: BUILDING_TYPE.SMITHY, name: "铁铺", shopKey: "smithy", craft: "forge" };

  it("shows the trading screen on the shop tab", () => {
    const el = BUILDING_SCREENS[BUILDING_TYPE.SMITHY](makeCtx({
      building: forgeBuilding, craftTab: "shop",
    }));

    expect(el.props.children[1].type).toBe(TradingScreen);
  });

  it("shows ForgeScreen on the craft tab for a non-jade building", () => {
    const el = BUILDING_SCREENS[BUILDING_TYPE.SMITHY](makeCtx({
      building: forgeBuilding, craftTab: "craft", isJade: false,
    }));

    expect(el.props.children[1].type).toBe(ForgeScreen);
  });

  it("shows JadeShopScreen on the craft tab for a jade building", () => {
    const el = BUILDING_SCREENS[BUILDING_TYPE.SHOP](makeCtx({
      building: { type: BUILDING_TYPE.SHOP, name: "玉器铺", shopKey: "jade", craft: "jade" },
      craftTab: "craft", isJade: true,
    }));

    expect(el.props.children[1].type).toBe(JadeShopScreen);
  });
});
