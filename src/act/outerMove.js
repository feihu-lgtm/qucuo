import { step as traceStep } from "../actionTrace.js";
import { QUCUO_MAP, getMapNode, resolveExit, isNodeUnlocked } from "../qucuoMap.js";
import { hasInnerMap, getDistrictAnchor } from "../innerMap.js";
import { DIRS } from "../utils/mudHelpers.js";

// 外层大地图移动裁决（纯判定 + trace，不写任何 React 状态）：
// 固定拓扑地图决定移动的合法性和目的地，AI 不能自己决定去了哪里。
// 如果这个方向在 QUCUO_MAP 里有登记的出口，锁定目的地；如果没有，明确告诉 AI
// 这个方向走不通，不允许它凭空编一个新地方出来。
//
// 返回 { destinationLock, lockedDestName, blocked, outerDepart }：
//   destinationLock — 注入给 AI 的系统裁决文本（可能为空串）
//   lockedDestName  — 锁定的目的地据点名（无锁定为 null）
//   blocked         — 目标未解锁拦截（act 需把 movingDir/pendDir 置 null）
//   outerDepart     — 内层→外层出发信息（act 写入 outerDepartRef，供到达描述用）
export function resolveOuterLock({ _trace, isTalk, movingDir, roomName, questProgress, flags, innerRoomName }) {
  let destinationLock = "";
  let lockedDestName = null;
  if (!isTalk && movingDir) {
    const dest = resolveExit(roomName, movingDir);
    if (dest && !isNodeUnlocked(dest, { completedQuests: new Set(Object.entries(questProgress || {}).filter(([, p]) => p?.status === "completed" || p?.done).map(([id]) => id)), flags })) {
      // 解锁门禁：目标据点尚未解锁（如黑风寨需先完成 heifengzhai_2）——此路未通，不移动。
      destinationLock = `\n[系统裁决：此路未通] 玩家想往${DIRS[movingDir] || movingDir}去「${dest}」，但此地此刻尚未对玩家开启（前置条件未达成）。请在 output 里合理写出这条路走不通/被拦/时机未到，room.name 必须保持"${roomName}"不变，不要移动、不要凭空编新地点。`;
      traceStep(_trace, "外层移动", "block", `往${DIRS[movingDir] || movingDir}→${dest} 未解锁（前置未达成），不移动`);
      return { destinationLock, lockedDestName, blocked: true, outerDepart: null };
    } else if (dest) {
      lockedDestName = dest;
      // 内层→外层移动规则（用户拍板）：玩家在任意内层房间走外层出口时，逻辑上是
      // "先自动寻路回本据点锚点房间，再从锚点走到目标据点的锚点房间"。玩家一步指令
      // 完成、不拆回合，但这段"回锚点"要在到达描述里交代，否则会突兀（人在塔顶怎么
      // 一下就到了喇嘛庙）。这里捕获出发时的内层房间和本区锚点，供 arrivalNote 用。
      const _fromAnchor = hasInnerMap(roomName) ? getDistrictAnchor(roomName) : null;
      const _leftFromInner = (hasInnerMap(roomName) && innerRoomName && innerRoomName !== _fromAnchor) ? innerRoomName : null;
      const outerDepart = { fromInner: _leftFromInner, fromAnchor: _fromAnchor, fromDistrict: roomName };
      if (_leftFromInner) traceStep(_trace, "外层移动", "info", `先自本区内层「${_leftFromInner}」寻路回锚点「${_fromAnchor}」，再出据点`);
      traceStep(_trace, "外层移动", "pass", `锁定目的地 ${roomName}→${dest}，待AI生成到达描述后写回`);
      const destNode = getMapNode(dest);
      destinationLock = `\n[系统裁决：固定地图] 玩家往${DIRS[movingDir] || movingDir}走，这个方向确定通向"${dest}"，地图上这个据点的基础设定：${destNode.desc}
你必须把 room.name 设为"${dest}"，room.exits 必须严格等于该据点在固定地图上的实际出口方向列表：${Object.keys(destNode.exits).join(",")}（不能增删出口）。
你只负责基于上述基础设定，结合当前时间/剧情进展，生成更具体生动的场景描述文本（room.desc）、当前在场的 NPC、地上的物品——这些细节由你发挥，但地点本身、出口列表是固定的，不能更改。`;
      return { destinationLock, lockedDestName, blocked: false, outerDepart };
    } else if (QUCUO_MAP[roomName]) {
      // 当前房间在固定地图里，但这个方向没有登记出口——明确告知此路不通
      destinationLock = `\n[系统裁决：固定地图] 玩家尝试往${DIRS[movingDir] || movingDir}走，但曲措乡的固定地图里，"${roomName}"这个方向没有已知出口。你应该在 output 里合理描述"此路不通"或"是荒野/断崖/无路可走"，room.name 保持不变（不要移动），不要凭空编造一个新地点。`;
      traceStep(_trace, "外层移动", "block", `往${DIRS[movingDir] || movingDir} 无出口，不移动`);
    }
    // 如果当前房间不在 QUCUO_MAP 里（不应该发生，但作为兜底），不加任何锁定说明，走原有自由生成逻辑
  } else if (!isTalk && !movingDir && QUCUO_MAP[roomName]) {
    // 之前这里完全不给AI任何位置约束——玩家一句没有明确方向词的自由输入
    // （"随便走走""四处逛逛"之类），AI 会不受约束地凭感觉叙述"走到了别处"，
    // 而系统状态其实并未移动（下面应用响应时 name/exits 会被强制按原地锁回），
    // 导致"文字说去了新地方，但地图/据点其实没变"的错位观感，也是玩家反馈
    // "乱走会莫名跳到不该连通的地方"的真正来源——不是拓扑图连错了，是这里
    // 叙事和状态在打架。明确告诉AI这回合不会真的挪地方，把两边说法对齐。
    destinationLock = `\n[系统裁决：固定地图] 玩家这句输入没有明确的移动方向（不是"往东/南/西/北/上/下"这类清晰指令）。无论玩家写了什么（哪怕提到了别的地名），本回合都不会真的改变所在位置：room.name 必须保持"${roomName}"不变，room.exits 必须严格等于：${Object.keys(QUCUO_MAP[roomName].exits).join(",")}。output 里可以自由描述这个动作本身（比如打量四周、随便走走的心境、跟人搭话等），但不能暗示"已经到了别的地方"。`;
  }
  return { destinationLock, lockedDestName, blocked: false, outerDepart: null };
}
