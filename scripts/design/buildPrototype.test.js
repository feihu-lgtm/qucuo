import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ICON_GROUPS } from "../../src/ui/primitives/iconPaths.js";
import { PROTOTYPE_PATH, buildPrototype } from "./buildPrototype.mjs";

describe("夜色精修界面原型", () => {
  it("仓库里的原型页与生成脚本一致（改了图标或原型要重新生成）", () => {
    expect(readFileSync(PROTOTYPE_PATH, "utf8")).toBe(buildPrototype());
  });

  it("图标册收齐全部分组，原型里不残留外部图标字体", () => {
    const html = buildPrototype();
    for (const [group] of ICON_GROUPS) expect(html).toContain(group);
    expect(html).not.toMatch(/class="ti /);
  });
});
