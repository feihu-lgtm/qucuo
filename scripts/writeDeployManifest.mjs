#!/usr/bin/env node
// 构建后写部署清单：远端校验用它确认服务器实际跑到了哪个 commit，而不是只看静态文件存在。
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const commit = process.argv[2] || execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
const current = JSON.parse(readFileSync("src/utils/version-current.json", "utf8"));
const manifest = {
  commit,
  builtAt: new Date().toISOString(),
  version: current.version,
  versionTime: current.time,
};
writeFileSync("dist/deploy-manifest.json", `${JSON.stringify(manifest)}\n`);
console.log(`部署清单：${commit} ${manifest.versionTime}`);
