#!/usr/bin/env node
// 部署专用：把玩家首页看到的版本时间刷成本次构建时间（东八区）。
// 只在服务器部署克隆的工作区运行，不要求每个架构/底层 PR 手工编版本记录；
// version-history 第一条同步刷新，避免点进版本历史仍看到旧时间。
import { readFileSync, writeFileSync } from "node:fs";

function shanghaiTime(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}`;
}

const stamp = process.argv[2] || shanghaiTime();
const currentPath = "src/utils/version-current.json";
const historyPath = "src/utils/version-history.json";
const current = JSON.parse(readFileSync(currentPath, "utf8"));
current.time = stamp;
writeFileSync(currentPath, `${JSON.stringify(current)}\n`);
const history = JSON.parse(readFileSync(historyPath, "utf8"));
if (Array.isArray(history) && history[0]) {
  history[0].time = stamp;
  writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`);
}
console.log(`部署版本戳已刷新：${stamp}`);
