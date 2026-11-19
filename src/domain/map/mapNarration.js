// 地图叙述 · 纯函数层
// ------------------------------------------------------------------
// 把"移动到了哪、四周有什么、远处通向哪"翻译成给玩家看的方位文字。
// 纯函数：只读地图数据，不碰 React / DOM / 存档，所以能在 Node 调试台
// （tools/debug.mjs）里直接调用、直接打印验证，不必开浏览器截图。
//
// 内层箱庭移动不经过 AI，方位描述就由这里本地生成；MudRPG 的内层移动
// 分支调 describeInnerArrival 拿到日志条目数组，直接 addLog。

import { QUCUO_MAP } from "./qucuoMap.js";
import { getInnerRoom, visibleInnerExits } from "./innerMap.js";

// 方向键 → 中文方位词。与 MudRPG.jsx 的同名表刻意保持一致（七个固定罗盘
// 方向，不会变动，这点重复无碍，反而让本模块自洽、能脱离 MudRPG 独立测试）。
export const DIRS = { n: "北", s: "南", e: "东", w: "西", u: "上", d: "下", sw: "西南" };

// 把 { 方向: 目标名 } 出口表拼成 "东·马车行　西·村口" 这样的可读串。
export function formatExits(exitsObj) {
  return Object.entries(exitsObj || {})
    .map(([d, name]) => `${DIRS[d] || d}·${name}`)
    .join("　");
}

// 内层箱庭移动后的方位描述，返回 addLog 用的日志条目数组（{ t, text }）。
//   districtName 外层据点名（如"鱼定村"）
//   fromRoom     移动前所在内层房间；为空时（首次进据点落脚）不写"从哪来"
//   toRoom       移动后所在内层房间
//   dir          移动方向键（n/s/e/w/…）
//   flags        当前剧情 flag 列表，用于隐藏尚未解锁的暗房间出口
export function describeInnerArrival(districtName, fromRoom, toRoom, dir, { flags = [] } = {}) {
  const dest = getInnerRoom(districtName, toRoom);
  // 四周：目标房间当前"可见"的内层出口（visibleInnerExits 会滤掉未解锁的暗房间）。
  const innerStr = formatExits(visibleInnerExits(districtName, toRoom, { flags }));
  // 远处：本据点在外层大地图上通往乡境其他据点的出口。
  const outerStr = formatExits(QUCUO_MAP[districtName]?.exits);

  const lines = [];
  if (fromRoom) {
    lines.push({ t: "desc", text: `  你自「${fromRoom}」向${DIRS[dir] || dir}，来到此处。` });
  }
  lines.push({ t: "desc", text: `  ${dest?.desc || ""}` });
  if (innerStr) lines.push({ t: "sys", text: `  四周：${innerStr}` });
  if (outerStr) lines.push({ t: "sys", text: `  远处：${outerStr}` });
  return lines;
}
