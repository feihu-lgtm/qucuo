#!/usr/bin/env node
// 构建后写部署清单：远端校验用它确认服务器实际跑到了哪个 commit，而不是只看静态文件存在。
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const commit = process.argv[2] || execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
const current = JSON.parse(readFileSync("src/utils/version-current.json", "utf8"));
// A2：清理裁决需要「最近三版 manifest 引用的资源」——清单内带本次构建资产相对路径全集。
const walk = (dir, base = dir) => {
  const out = [];
  for (const e of readdirSync(dir)) {
    const fp = join(dir, e);
    if (statSync(fp).isDirectory()) out.push(...walk(fp, base));
    else out.push(relative(base, fp).split("\\").join("/"));
  }
  return out;
};
let assets = [];
try { assets = walk("dist/assets", "dist"); } catch { assets = []; }
const manifest = {
  commit,
  builtAt: new Date().toISOString(),
  version: current.version,
  versionTime: current.time,
  assets,
};
writeFileSync("dist/deploy-manifest.json", `${JSON.stringify(manifest)}\n`);
console.log(`部署清单：${commit} ${manifest.versionTime}`);
