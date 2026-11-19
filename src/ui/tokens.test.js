import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const TOKENS = readFileSync("src/ui/tokens.css", "utf-8");

function sourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(js|jsx|css)$/.test(name)) out.push(path);
  }
  return out;
}

describe("UI tokens", () => {
  it("defines every CSS variable referenced in src", () => {
    const defined = new Set([...TOKENS.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
    const references = new Set();
    for (const file of sourceFiles("src")) {
      const content = readFileSync(file, "utf-8");
      for (const match of content.matchAll(/var\(\s*(--[\w-]+)/g)) references.add(match[1]);
    }
    const missing = [...references].filter(name => !defined.has(name)).sort();
    expect(missing).toEqual([]);
  });

  it("reduces animation and transition timing for reduced-motion users", () => {
    expect(TOKENS).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(TOKENS).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(TOKENS).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });
});
