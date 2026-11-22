import { describe, expect, it } from "vitest";
import { getBuildingsForLocation } from "../../domain/data/buildings/qucuoBuildings.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";
import { parseLocalCommand } from "../../engine/localCommands.js";
import { buyTangmenItem, tangmenShopOffer } from "./tangmenShop.js";

const rep = (value) => ({ 世界: { 势力声誉: { 唐门: value } } });
const vault = (value = 0) => ({
  char: { money: 500, special: { 智谋: 5 } },
  room: { name: "蜀南唐堡" }, innerRoomName: "唐堡内库",
  inv: [], skills: [], flags: ["tangmen_invited"], questProgress: {}, varTree: rep(value), time: 1,
});
const names = (offer) => offer.items.map((item) => item.name);

describe("唐堡内库", () => {
  it("sits east of the main hall behind the invitation and shares the 唐门暗器 pool", () => {
    const id = getBuildingIdForInnerRoom("蜀南唐堡", "唐堡内库");
    expect(getBuildingsForLocation("蜀南唐堡").find((building) => building.id === id))
      .toMatchObject({ name: "唐堡内库", type: "sectshop", shopKey: "唐门暗器" });
  });

  it("hides rep-gated goods until 唐门 rep reaches 15 and discounts by tier", () => {
    expect(names(tangmenShopOffer(rep(0), "vault"))).not.toContain("假死药");
    expect(buyTangmenItem(vault(0), "假死药").changes).toBeUndefined();
    const friendly = tangmenShopOffer(rep(15), "vault");
    expect(names(friendly)).toContain("假死药");
    expect(friendly.coef).toBe(0.92);
    const item = friendly.items.find((entry) => entry.name === "假死药");
    const bought = buyTangmenItem(vault(15), "假死药", 1);
    expect(bought.logs[0].text).toContain(`${Math.ceil(item.buyPrice * 0.92)}两`);
  });

  it("closes the vault when hostile and only sells green goods at a markup outside", () => {
    expect(tangmenShopOffer(rep(-20), "vault").closed).toBeTruthy();
    const outer = tangmenShopOffer(rep(-20), "outer");
    expect(outer.coef).toBe(1.2);
    expect(new Set(outer.items.map((item) => item.quality))).toEqual(new Set(["绿"]));
    expect(tangmenShopOffer(rep(-60), "outer").closed).toBeTruthy();
  });

  it("stocks the 合稿 secret goods behind 唐门 rep 40 / 80 with their catalog effects", () => {
    expect(names(tangmenShopOffer(rep(0), "vault"))).toContain("铁莲子");
    expect(names(tangmenShopOffer(rep(39), "vault"))).not.toContain("淬竹袖箭");
    expect(names(tangmenShopOffer(rep(40), "vault"))).toEqual(expect.arrayContaining(["淬竹袖箭", "蚕丝防毒衣"]));
    expect(names(tangmenShopOffer(rep(40), "vault"))).not.toContain("冰魄解蛊散");
    const offer = tangmenShopOffer(rep(80), "vault");
    expect(offer.items.find((item) => item.name === "淬竹袖箭")).toMatchObject({ category: "weapon", effect: { forceFirst: true } });
    expect(offer.items.find((item) => item.name === "冰魄解蛊散")).toMatchObject({ consumable: { dispelAll: true } });
    expect(names(tangmenShopOffer(rep(-20), "outer"))).toContain("铁莲子");
  });

  it("lets the CLI buy at the vault through the shared rule", () => {
    const result = parseLocalCommand("买暗器 蛇药", vault(0), { surface: "cli" }).result;
    expect(result.logs[0].text).toContain("购得「蛇药」");
  });
});
