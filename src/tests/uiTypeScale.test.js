// 字号护栏：UI 里的 font-size 只能取 tokens.css 的 --fs-* 阶梯，不许再写裸 px。
// 历史代码里还留着一批未迁移的字面量（非首位属性，ast 批量改写覆盖不到），
// 这里用「只许变少」的账本把它们记下来：新写的代码一旦又写裸 px，数量超线就报错。
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["ui", "utils/theme.js"];

// 迁移基线：只许下调。改完一批字面量就把它改小，别让它涨回去。
const KNOWN_FONT_LITERALS = 381;

function walk(entry, out = []) {
  const abs = path.join(ROOT, entry);
  const stat = fs.statSync(abs);
  if (stat.isFile()) {
    if (/\.(jsx?|mjs)$/.test(abs) && !/\.test\.jsx?$/.test(abs)) out.push(abs);
    return out;
  }
  for (const name of fs.readdirSync(abs)) walk(path.join(entry, name), out);
  return out;
}

describe("UI 字号统一调度", () => {
  it("裸 px 的 font-size 不超过账面数字（只许降不许升）", () => {
    const offenders = [];
    for (const file of SCAN_DIRS.flatMap((dir) => walk(dir))) {
      const text = fs.readFileSync(file, "utf8");
      const hits = text.match(/fontSize:\s*(\d|"\d)/g) || [];
      if (hits.length) offenders.push([path.relative(ROOT, file), hits.length]);
    }
    const total = offenders.reduce((sum, [, n]) => sum + n, 0);
    expect(total, `还有 ${total} 处裸 px 字号，基线 ${KNOWN_FONT_LITERALS}；新代码请用字号阶梯变量`)
      .toBeLessThanOrEqual(KNOWN_FONT_LITERALS);
  });

  it("字号阶梯的每一档都在 tokens.css 里定义", () => {
    const tokens = fs.readFileSync(path.join(ROOT, "ui/tokens.css"), "utf8");
    for (const step of ["2xs", "xs", "sm", "md", "base", "lg", "xl", "2xl", "3xl"]) {
      expect(tokens, `缺少 --fs-${step}`).toContain(`--fs-${step}:`);
    }
  });
});
