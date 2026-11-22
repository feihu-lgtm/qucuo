// 无缓存的「环顾四周」：地名、出口、在场人物由系统直接给出，房间描写后台补写。
import { DIRS } from "../../../utils/mudHelpers.js";

// 固定地图给 {方向: 目的地}，导入剧本的房间只给方向数组。
function exitEntries(exits) {
  return Array.isArray(exits) ? exits.map((dir) => [dir, ""]) : Object.entries(exits || {});
}

export function roomLookFact({ place = "", exits = {}, npcs = [] } = {}) {
  const exitText = exitEntries(exits)
    .map(([dir, dest]) => (dest ? `${DIRS[dir] || dir}·${dest}` : (DIRS[dir] || dir))).join("、");
  const npcText = (npcs || []).map((n) => n?.name || n).filter(Boolean).join("、");
  return [
    `此处是${place || "未知之地"}`,
    `出口：${exitText || "无"}`,
    npcText ? `在场：${npcText}` : "",
  ].filter(Boolean).join("；");
}

export function buildLookNarrationPrompt({ place = "", base = "", exits = {}, npcs = [] } = {}) {
  const sys = `你是曲措乡的说书人。玩家刚在此处环顾四周，地名、出口、在场人物已由系统列出。
写一段三到五句的描写（不超过一百五十字），写眼前所见的景致、声响与气氛。
铁律：只写给定的地点；人物只可写给定的在场者，不添新人物、不添可拾取的物品、不推进任何事件、不替玩家做决定、不向玩家提问；
白话古文的说书人口吻，不用冒号破折号。只输出正文，不要任何前后缀。`;
  const npcText = (npcs || []).map((n) => n?.name || n).filter(Boolean).join("、");
  const user = [
    `地点：${place}`,
    base ? `底本：${base}` : "",
    `出口：${exitEntries(exits).map(([dir, dest]) => dest || DIRS[dir] || dir).join("、") || "无"}`,
    `在场：${npcText || "无人"}`,
  ].filter(Boolean).join("\n");
  return { sys, user };
}
