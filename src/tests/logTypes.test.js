// 守卫：源码里写的每个日志类型 t 都必须在 LOG_T 清单里，清单里每个类型都必须有日夜两套颜色。
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { CARD_RENDERED_LOG_TYPES, LOG_TYPES } from "../domain/rules/log/logTypes.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// 日志条目的写法是 { t: "类型", text: … }；只认 t 后面紧跟 text 的对象，
// 别处同样用 t 当键名的对象（比如教程步骤的标题）不算。
const ENTRY_TYPE = /[{,]\s*t\s*:\s*(["'`])([^"'`]*)\1\s*,\s*text\b/g;

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    return /\.(js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });
}

it("every log entry type written in src is on the LOG_T list", () => {
  const unknown = listFiles(SRC).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    return [...source.matchAll(ENTRY_TYPE)]
      .map((match) => match[2])
      .filter((type) => !LOG_TYPES.has(type))
      .map((type) => `${file.slice(SRC.length + 1)}: t: "${type}"`);
  });
  expect(unknown).toEqual([]);
});

it("every listed type has a colour in both the night and the day palette", () => {
  const source = readFileSync(join(SRC, "app", "hooks", "useGameUi.js"), "utf8");
  const keys = (name) => {
    const body = source.match(new RegExp(`const ${name} = \\{([^}]*)\\}`))?.[1] || "";
    return new Set([...body.matchAll(/(\w+)\s*:/g)].map((match) => match[1]));
  };
  const night = keys("clrNight");
  const day = keys("clrDay");
  const missing = [...LOG_TYPES]
    .filter((type) => !CARD_RENDERED_LOG_TYPES.has(type))
    .filter((type) => !night.has(type) || !day.has(type));
  expect(night.size).toBeGreaterThan(0);
  expect(missing).toEqual([]);
});
