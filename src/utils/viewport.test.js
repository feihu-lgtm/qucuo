import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PHONE_MAX_WIDTH, isMobileWidth } from "./viewport.js";

const TOKENS = readFileSync("src/ui/tokens.css", "utf-8");
const MOBILE = readFileSync("src/ui/mobile.css", "utf-8");
const bp = (name) => Number(TOKENS.match(new RegExp(`--bp-${name}:\\s*(\\d+)px;`))[1]);

function sourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(js|jsx)$/.test(name) && !/\.test\./.test(name)) out.push(path.split(/[\\/]/).join("/"));
  }
  return out;
}

describe("断点表与设备判断只有一处（U5）", () => {
  it("JS 的手机断点等于 tokens.css 的 --bp-phone-max", () => {
    expect(PHONE_MAX_WIDTH).toBe(bp("phone-max"));
    expect(isMobileWidth(767)).toBe(true);
    expect(isMobileWidth(768)).toBe(false);
  });

  it("mobile.css 里每个 @media 用到的宽高都登记在断点表里", () => {
    const registered = new Set(["phone-max", "tablet-min", "compact-max", "short-max", "landscape-max"].map(bp));
    const used = [...MOBILE.matchAll(/@media[^{]*/g)].flatMap((m) => [...m[0].matchAll(/(?:max|min)-(?:width|height):\s*(\d+)px/g)].map((x) => Number(x[1])));
    expect(used.length).toBeGreaterThan(0);
    expect([...new Set(used)].filter((n) => !registered.has(n))).toEqual([]);
  });

  it("除 utils/viewport.js 外，没有文件调用 matchMedia 或拿 innerWidth 比大小", () => {
    const offenders = sourceFiles("src").filter((file) => file !== "src/utils/viewport.js").filter((file) => {
      const source = readFileSync(file, "utf-8").replace(/\/\/.*$/gm, "");
      return /\bmatchMedia\s*\(/.test(source) || /innerWidth\s*[<>]=?\s*\d/.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it("手机样式只有 mobile.css 一份", () => {
    const cssFiles = [];
    const walk = (dir) => readdirSync(dir).forEach((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/mobile/i.test(name) && name.endsWith(".css")) cssFiles.push(path.split(/[\\/]/).join("/"));
    });
    walk("src");
    expect(cssFiles).toEqual(["src/ui/mobile.css"]);
  });
});
