// A2：updater 合并部署清理——临时目录脚本测试：只删 7 天前且不被最近三版 manifest 引用的资源。
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sweepAssets } from "./cleanupArgonAssets.mjs";

const DAY = 24 * 3600 * 1000;

describe("cleanupArgonAssets 合并部署清理", () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "qucuo-clean-")); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  const put = (rel, ageMs, content = "x") => {
    const fp = join(dir, rel);
    mkdirSync(join(fp, ".."), { recursive: true });
    writeFileSync(fp, content);
    const t = new Date(Date.now() - ageMs);
    utimesSync(fp, t, t);
    return fp;
  };
  const manifest = (ts, assets) => {
    mkdirSync(join(dir, ".deploy-manifests"), { recursive: true });
    writeFileSync(join(dir, ".deploy-manifests", `${ts}.json`), JSON.stringify({ assets }));
  };

  it("7 天前且不被引用：删；被引用/未满 7 天：保", () => {
    put("assets/old-unreferenced-aaa.js", 8 * DAY);
    put("assets/old-referenced-bbb.js", 8 * DAY);
    put("assets/new-unreferenced-ccc.js", 2 * DAY);
    manifest("20260101000000", ["assets/old-referenced-bbb.js"]);
    const removed = sweepAssets(dir);
    expect(removed).toContain("assets/old-unreferenced-aaa.js");
    expect(existsSync(join(dir, "assets/old-unreferenced-aaa.js"))).toBe(false);
    expect(existsSync(join(dir, "assets/old-referenced-bbb.js"))).toBe(true);
    expect(existsSync(join(dir, "assets/new-unreferenced-ccc.js"))).toBe(true);
  });

  it("引用集取最近三版 manifest：第四旧不再保护", () => {
    put("assets/in-old-manifest.js", 8 * DAY);
    put("assets/in-new-manifest.js", 8 * DAY);
    manifest("20260101000000", ["assets/in-old-manifest.js"]); // 最旧——出三版窗
    manifest("20260102000000", []);
    manifest("20260103000000", []);
    manifest("20260104000000", ["assets/in-new-manifest.js"]); // 最新三版内
    const removed = sweepAssets(dir);
    expect(removed).toContain("assets/in-old-manifest.js");
    expect(removed).not.toContain("assets/in-new-manifest.js");
  });

  it("嵌套目录资源：子目录内文件同样按引用/ age 裁决，空目录顺手收", () => {
    put("assets/chunks/nested/deep-aaa.js", 8 * DAY);
    put("assets/chunks/nested/deep-bbb.js", 8 * DAY);
    manifest("20260101000000", ["assets/chunks/nested/deep-bbb.js"]);
    const removed = sweepAssets(dir);
    expect(removed).toContain("assets/chunks/nested/deep-aaa.js");
    expect(existsSync(join(dir, "assets/chunks/nested/deep-bbb.js"))).toBe(true);
  });

  it("public 顶层静态目录（非哈希）不被清理波及——清理只扫 assets/", () => {
    // 只增不删语义下 public 目录 stones/portraits/fonts 不在清理范围：
    // 它们不是 vite 哈希资产、文件名不带内容指纹，删除会让旧页面缺立绘/字体。
    put("portraits/old-portrait.png", 30 * DAY);
    put("assets/hash-aaa123.js", 8 * DAY);
    const removed = sweepAssets(dir);
    expect(removed).toEqual(["assets/hash-aaa123.js"]);
    expect(existsSync(join(dir, "portraits/old-portrait.png"))).toBe(true);
  });

  it("无 manifest 记录：老资源全删新资源全保（不炸）", () => {
    put("assets/x.js", 8 * DAY);
    put("assets/y.js", 1 * DAY);
    const removed = sweepAssets(dir);
    expect(removed).toEqual(["assets/x.js"]);
  });
});
