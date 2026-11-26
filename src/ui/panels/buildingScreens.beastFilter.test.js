import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Review 修：驿站收信人名单滤掉兽类", () => {
  it("metNpcs 经 findNpcObject beast 过滤——草稿不再写给大公鸡被系统拒信清空", () => {
    const src = readFileSync("src/ui/panels/buildingScreens.jsx", "utf8");
    expect(src).toMatch(/metNpcs=\{\(c\.varTree\.世界\?\.曾经出现人物[\s\S]*?filter\(\(n\) => !findNpcObject\(/);
  });
});
