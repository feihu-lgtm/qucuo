import { describe, expect, it } from "vitest";
import { resolveFreeActExpense } from "./freeActPricing.js";

describe("resolveFreeActExpense 服务菜单进查价链（夜班银两单 Review）", () => {
  it("牦牛骨汤按饭馆菜单实价 8 两——不落 quality 估价 18", () => {
    const hit = resolveFreeActExpense({ text: "来一碗牦牛骨汤暖暖身子" });
    expect(hit).toBeTruthy();
    expect(hit.price).toBe(8);
    expect(hit.source).toContain("菜单具名");
  });

  it("青稞糌粑 3 两、辣子炒肉 12 两、曲措老酒 5 两（跨菜单同名同价照落）", () => {
    expect(resolveFreeActExpense({ text: "来份青稞糌粑" })?.price).toBe(3);
    expect(resolveFreeActExpense({ text: "上一盘辣子炒肉" })?.price).toBe(12);
    expect(resolveFreeActExpense({ text: "打一壶曲措老酒" })?.price).toBe(5);
  });

  it("菜单与货架/物件志歧义共存时不猜（多个互不包含具名→null）", () => {
    // 同句出现两个互不包含的具名——歧义不落价，走 risk 默认
    const hit = resolveFreeActExpense({ text: "来一碗牦牛骨汤再配一份辣子炒肉" });
    expect(hit).toBeNull();
  });

  it("服务/请客类无目标物仍返回 null（走 risk 默认）", () => {
    expect(resolveFreeActExpense({ text: "打赏伙计几个钱" })).toBeNull();
  });
});
