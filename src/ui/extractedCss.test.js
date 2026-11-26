import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// U2：可点击元素的内联样式由工具搬进各目录的样式文件（screens.css、components.css…）。
// extractedCss.snapshots.json 记着搬迁前的内联样式（值已换算成 CSS 写法），
// 这里逐条核对：基础规则 = 开态快照，基础规则 + [data-on="false"] = 关态快照。
const SNAPSHOTS = JSON.parse(readFileSync("src/ui/extractedCss.snapshots.json", "utf-8"));
const kebab = (key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const cache = new Map();

function rule(file, selector) {
  if (!cache.has(file)) cache.set(file, readFileSync(file, "utf-8").replace(/\/\*[\s\S]*?\*\//g, ""));
  const decls = {};
  for (const match of cache.get(file).matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!match[1].split(",").map((s) => s.trim()).includes(selector)) continue;
    for (const line of match[2].split(";")) {
      const [prop, ...rest] = line.split(":");
      if (prop && rest.length) decls[prop.trim()] = rest.join(":").trim();
    }
  }
  return decls;
}

describe("工具搬迁的样式与搬迁前的内联样式逐属性相等", () => {
  it("快照非空，且每个类都在样式文件里有规则", () => {
    expect(SNAPSHOTS.length).toBeGreaterThan(0);
    for (const { css, cls } of SNAPSHOTS) expect(Object.keys(rule(css, `.${cls}`)).length, cls).toBeGreaterThan(0);
  });

  for (const { css, cls, on, off } of SNAPSHOTS) {
    it(`${css.split("/").pop()} → .${cls}`, () => {
      const base = rule(css, `.${cls}`);
      for (const [key, value] of Object.entries(on)) expect(base[kebab(key)], `开 → ${key}`).toBe(value);
      if (off) {
        const merged = { ...base, ...rule(css, `.${cls}[data-on="false"]`) };
        for (const [key, value] of Object.entries(off)) expect(merged[kebab(key)], `关 → ${key}`).toBe(value);
      }
    });
  }
});
