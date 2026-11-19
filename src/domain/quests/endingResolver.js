// 多结局判定与记录——见总纲第七章7.4节。
// gameState 至少需要 { flags, char } 两项；一旦某个结局判定成立，
// 调用方应立刻把 "story_ending_" + resolvedId 写入 flags，防止后续被覆盖判断
// （resolveEnding 本身只读不写，由调用方决定何时落盘）。

import { canBypassExclusive } from "./questEngine.js";

// 虎胆三重门的四个结局——priority 数字越小越优先判断（隐藏结局排最前）。
// 三条常规线互斥（见 lockExclusiveSiblings），正常游玩下 quest_heyx_s4 /
// quest_zhaxi_s5 / quest_lanjie_s6 三个完成flag里通常只会有一个成立；
// 全收集隐藏线绕过互斥锁后，允许多个同时成立，此时 priority 0 优先命中。
export const HUDAN_ENDINGS = [
  {
    id: "全收集·后宫",
    priority: 0,
    condition: (gs) => canBypassExclusive(gs) && gs.flags?.includes("quest_allin_s5"),
  },
  {
    id: "花主之伴",
    priority: 1,
    condition: (gs) => gs.flags?.includes("quest_lanjie_s6") && !gs.flags?.includes("quest_allin_s5"),
  },
  {
    id: "牧民之婿",
    priority: 1,
    condition: (gs) => gs.flags?.includes("quest_zhaxi_s5") && !gs.flags?.includes("quest_allin_s5"),
  },
  {
    id: "师母之情",
    priority: 1,
    condition: (gs) => gs.flags?.includes("quest_heyx_s4") && !gs.flags?.includes("quest_allin_s5"),
  },
];

// 通用结局判定：按 priority 从小到大检查，第一个成立的即为最终结局。
// endings 参数可传入不同的结局集合（目前只有虎胆三重门一套，未来终局七方
// 博弈的结局集可以是另一个数组，调用同一个函数）。
export function resolveEnding(gameState, endings = HUDAN_ENDINGS) {
  const sorted = [...endings].sort((a, b) => a.priority - b.priority);
  for (const e of sorted) {
    if (e.condition(gameState)) return e.id;
  }
  return null;
}
