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

function hasOpaqueLiteralBackground(style) {
  const background = style.match(/\bbackground\s*:\s*["']([^"']+)["']/)?.[1];
  if (!background) return false;
  const rgba = background.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)$/i);
  if (rgba && Number(rgba[1]) < 1) return false;
  return /^#|^rgb\(/i.test(background);
}

function hasVariableForeground(style) {
  return /\b(?:color|fill)\s*:\s*[^,}]*var\(--/.test(style);
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

  it("does not pair tokenized foregrounds with opaque literal backgrounds", () => {
    const mismatches = [];
    for (const file of sourceFiles("src")) {
      const content = readFileSync(file, "utf-8");
      for (const match of content.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
        if (hasVariableForeground(match[1]) && hasOpaqueLiteralBackground(match[1])) {
          mismatches.push(`${file}:${content.slice(0, match.index).split("\n").length}`);
        }
      }
      for (const match of content.matchAll(/^\s{2}(?:input|select)\s*:\s*\{([\s\S]*?)^\s{2}\},?/gm)) {
        if (hasVariableForeground(match[1]) && hasOpaqueLiteralBackground(match[1])) {
          mismatches.push(`${file}:${content.slice(0, match.index).split("\n").length}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
    expect(readFileSync("src/ui/components/ClickableMap.jsx", "utf-8"))
      .not.toMatch(/fill=\{n\.current \? accent : "var\(--text\)"\}/);
  });
});
