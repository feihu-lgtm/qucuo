import { expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const coreDir = resolve(dirname(fileURLToPath(import.meta.url)));

function listJavaScriptFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(path);
    return entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
  });
}

it("keeps React and non-vanilla Zustand imports out of core", () => {
  const violations = listJavaScriptFiles(coreDir).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    const imports = [...source.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((match) => match[1]);
    return imports
      .filter((specifier) => specifier === "react" || (specifier.startsWith("zustand") && specifier !== "zustand/vanilla"))
      .map((specifier) => `${relative(coreDir, file)}: ${specifier}`);
  });

  expect(violations).toEqual([]);
});
