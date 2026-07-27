import { step as traceStep } from "../actionTrace.js";
import { hasInnerMap, resolveInnerExit, isNpcVisibleInInnerRoom, getInnerRoom, isInnerExitUnlocked, describeInnerLock } from "../innerMap.js";
import { describeInnerArrival } from "../mapNarration.js";
import { detectNewFaces } from "../npcAwareness.js";
import { DIRS } from "../utils/mudHelpers.js";

// 内层箱庭移动判定（纯判定 + trace，不写任何 React 状态）：
// 如果当前据点有内层数据（hasInnerMap(room.name)为真）且这个方向是
// 内层当前房间的有效出口，这次移动完全在纯前端处理：只改 innerRoomName，
// 不触碰 room.name/room.exits，也不进入AI调用流程。这跟总纲
// 第十章"内层移动不该消耗AI调用"的设计意图一致——在同一个据点内部
// 从村口走到老孙饭馆，属于UI层面的场景切换，不需要每步都请求AI
// 重新生成场景描述（房间的描述本身是innerMap.js里钉死的固定文字）。
// 只有内层房间没有这个方向的出口时，才继续走外层大地图/AI叙事
// 的原有逻辑——这样"从内层某个房间的锚点走出据点"依然能触发外层
// resolveExit，两套移动无缝衔接。
// 命令区分内外层：内/外方向按钮点击时通过 forceLayer 明确指定这次
// 是"内层移动"还是"外层移动"，不再靠"内层优先"猜——那会在锚点房间同方向既有内层
// 出口又有外层出口时撞车（村口按西：内层通杂货铺、外层通鱼定土司，内层优先就永远
// 到不了土司）。forceLayer="outer" 时直接跳过内层判定走外层；="inner" 时只在内层
// 找，内层没这方向就明确"此路不通"，不越权去走外层。打字移动（无 forceLayer）保持
// 旧行为：内层优先、内层没有再 fallback 外层。
//
// 返回值：
//   { kind: "move", ... }    纯前端移动成立，act 负责写状态并 early return
//   { kind: "blocked" }      forceLayer=inner 但内层无此出口，act 提示并 early return
//   null                     不适用 / 跳过 / 内层无出口但打字移动放行外层（act 继续主流程）
export function tryInnerMove({ _trace, isTalk, movingDir, forceLayer, room, innerRoomName, flags, varTree, questProgress, inv, char }) {
  if (!isTalk && movingDir && hasInnerMap(room.name) && innerRoomName && forceLayer !== "outer") {
    const innerDest = resolveInnerExit(room.name, innerRoomName, movingDir);
    traceStep(_trace, "内层移动", "info", `判定：当前内层「${innerRoomName}」往${DIRS[movingDir] || movingDir}${innerDest ? `通向「${innerDest}」` : "无出口"}`);
    // 上锁的房间（安全屋钥匙门/剧情暗门）：查表查得到，但没钥匙走不进去。
    // 此前这里只做 resolveInnerExit 裸查表、完全不看 unlockCondition，
    // 于是"锁"只体现在到达描述文字里滤掉方向，玩家照样能点九宫格或打字走进去
    // ——四栋安全屋会门户大开。三处（本函数、左栏九宫格、放大地图）现已统一判定。
    if (innerDest) {
      const destRoom = getInnerRoom(room.name, innerDest);
      if (destRoom?.unlockCondition && !isInnerExitUnlocked(destRoom.unlockCondition, { questProgress, flags, inv, char })) {
        traceStep(_trace, "内层移动", "block", `「${innerDest}」上锁（${describeInnerLock(destRoom.unlockCondition)}）`);
        return { kind: "blocked", summary: "门锁着", lockedMsg: describeInnerLock(destRoom.unlockCondition) };
      }
    }
    if (innerDest) {
      traceStep(_trace, "内层移动", "pass", `${innerRoomName} → ${innerDest}（纯前端，不调AI）`);
      // 新人物检测：按目标内层房间(innerDest)的可见性过滤 room.npcs，再 detectNewFaces
      // 查没见过的——与主流程同一套判据（此前内层移动直接 return 会跳过主流程检测，
      // 从 B 箱庭走到绑着新 NPC 的 A 箱庭时不报"※新人物出现"）。
      const arrivedNpcs = (room.npcs || []).filter(n => isNpcVisibleInInnerRoom(room.name, innerDest, n));
      const newFaces = detectNewFaces(varTree, arrivedNpcs);
      return {
        kind: "move",
        summary: `内层移动到 ${room.name}·${innerDest}`,
        innerDest,
        fromRoom: innerRoomName,
        arrivalLines: describeInnerArrival(room.name, innerRoomName, innerDest, movingDir, { flags }),
        newFaces: newFaces.map(n => n.name),
        arrivedNames: arrivedNpcs.map(n => n.name),
      };
    }
    // 内层这个方向没出口。若玩家明确点的是「内」按钮（forceLayer==="inner"），
    // 就到此为止、告诉他内层此路不通，不越权走外层。
    if (forceLayer === "inner") {
      traceStep(_trace, "内层移动", "block", `内层「${innerRoomName}」往${DIRS[movingDir] || movingDir}无出口`);
      return { kind: "blocked", summary: "内层此路不通" };
    }
    // 打字移动（无 forceLayer）：内层没这方向，放行继续走外层判定（旧行为）。
    return null;
  }
  if (!isTalk && movingDir) {
    // 是移动指令，但没进内层判定分支——记录为什么，便于排查"内层移动为何走了AI/外层"。
    const why = !hasInnerMap(room.name) ? "此据点无内层地图"
      : !innerRoomName ? "内层房间未定位(innerRoomName为空)"
      : forceLayer === "outer" ? "明确指定外层(forceLayer=outer)"
      : "未知";
    traceStep(_trace, "内层移动", "skip", `跳过内层判定（${why}）→ 转外层/AI`);
  }
  return null;
}
