import { describe, it, expect } from "vitest";
import { ensureItemId, resolveEntityByIdOrName, ITEM_ID_RE } from "./entityId.js";
import { CATALOG_INDEX } from "../../data/items/catalog.js";

describe("ensureItemId 确定性编号", () => {
  it("已有 it_ 前缀的 id 原样保留", () => {
    expect(ensureItemId({ name: "短刀", id: "it_8f3a21" }, 5, 2)).toBe("it_8f3a21");
    // 历史遗留的非标后缀也保留（敬重存量存档）
    expect(ensureItemId({ name: "短刀", id: "it_legacy_x" }, 5, 2)).toBe("it_legacy_x");
  });

  it("图鉴物生成稳定 it_cat_<hash>，与回合/序号无关", () => {
    const catalogName = Object.keys(CATALOG_INDEX)[0];
    const a = ensureItemId({ name: catalogName }, 1, 1);
    const b = ensureItemId({ name: catalogName }, 99, 42);
    expect(a).toMatch(/^it_cat_[0-9a-f]{6}$/);
    expect(a).toBe(b);
    // 两件不同图鉴物 id 不同
    const other = Object.keys(CATALOG_INDEX)[1];
    if (other) expect(ensureItemId({ name: other }, 1, 1)).not.toBe(a);
  });

  it("新物用 turn/seq 派生 it_<hex>：同参幂等、异参分叉", () => {
    const item = { name: "无名铁片" };
    const a1 = ensureItemId(item, 10, 3);
    const a2 = ensureItemId({ name: "无名铁片" }, 10, 3);
    expect(a1).toBe(a2);                       // 同回合同序号同名幂等
    expect(a1).toMatch(/^it_[0-9a-f]{6}$/);
    expect(ensureItemId(item, 11, 3)).not.toBe(a1);  // 换回合分叉
    expect(ensureItemId(item, 10, 4)).not.toBe(a1);  // 换序号分叉
  });

  it("纯字符串物品名也支持", () => {
    expect(ensureItemId("无名铁片", 10, 3)).toBe(ensureItemId({ name: "无名铁片" }, 10, 3));
  });

  it("空输入返回空串，绝不抛", () => {
    expect(ensureItemId(null)).toBe("");
    expect(ensureItemId({})).toMatch(/^it_[0-9a-f]{6}$/);
  });

  it("ID 形状常量与生成物自洽", () => {
    expect(ITEM_ID_RE.test(ensureItemId({ name: "无名铁片" }, 1, 1))).toBe(true);
    const catalogName = Object.keys(CATALOG_INDEX)[0];
    expect(ITEM_ID_RE.test(ensureItemId({ name: catalogName }, 1, 1))).toBe(true);
  });
});

describe("resolveEntityByIdOrName 反查", () => {
  const pool = [
    { id: "it_8f3a21", name: "霜牙短刀" },
    { id: "it_cat_a1b2c3", name: "断念剑" },
    { id: "F42_1", name: "雪夜赠酒" },
  ];

  it("id 精确命中优先", () => {
    expect(resolveEntityByIdOrName(pool, "it_8f3a21")?.name).toBe("霜牙短刀");
  });

  it("name 精确命中", () => {
    expect(resolveEntityByIdOrName(pool, "断念剑")?.id).toBe("it_cat_a1b2c3");
    expect(resolveEntityByIdOrName(pool, "雪夜赠酒")?.id).toBe("F42_1");
  });

  it("宽松命中：去空白与 hex 尾段", () => {
    expect(resolveEntityByIdOrName(pool, " 断念剑 ")?.id).toBe("it_cat_a1b2c3");
    expect(resolveEntityByIdOrName(pool, "8f3a21")?.name).toBe("霜牙短刀");
  });

  it("对象表 pool 同样支持", () => {
    const map = { 霜牙短刀: pool[0] };
    expect(resolveEntityByIdOrName(map, "it_8f3a21")?.name).toBe("霜牙短刀");
  });

  it("找不到返回 null，绝不抛", () => {
    expect(resolveEntityByIdOrName(pool, "不存在")).toBe(null);
    expect(resolveEntityByIdOrName(null, "it_8f3a21")).toBe(null);
    expect(resolveEntityByIdOrName(pool, "")).toBe(null);
  });
});
