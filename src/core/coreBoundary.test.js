import { expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const coreDir = resolve(dirname(fileURLToPath(import.meta.url)));
const engineDir = resolve(coreDir, "../engine");
const featuresDir = resolve(coreDir, "../features");

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

it("keeps React and browser globals out of feature modules", () => {
  const violations = listJavaScriptFiles(featuresDir).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    const imports = [...source.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((match) => match[1]);
    const forbiddenImports = imports
      .filter((specifier) => specifier === "react" || specifier === "react-dom")
      .map((specifier) => `${relative(featuresDir, file)}: ${specifier}`);
    const browserGlobals = [...source.matchAll(/\b(window|document|localStorage)\b/g)]
      .map((match) => `${relative(featuresDir, file)}: ${match[1]}`);
    return [...forbiddenImports, ...browserGlobals];
  });

  expect(violations).toEqual([]);
});

it("keeps the UI overlay store out of core, engine, and feature modules", () => {
  const violations = [coreDir, engineDir, featuresDir].flatMap((dir) =>
    listJavaScriptFiles(dir).flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const imports = [...source.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((match) => match[1]);
      return imports
        .filter((specifier) => specifier.includes("uiStore"))
        .map((specifier) => `${relative(coreDir, file)}: ${specifier}`);
    }),
  );

  expect(violations).toEqual([]);
});
