// 路线甲·纯函数化处理器的统一落盘口。
// 处理器只返回结果描述：{ logs, delayedLogs, delayMs, changes, refWrites }。
// 这里负责把结果落成真实的日志与状态写入——处理器内不再直接调 d.addLog / d.setX。
// changes 的 key 与 d.setX 的对应表只此一份；refWrites 的 key 是 d 上的 ref 名字段。

export function applyPostResult(d, out) {
  if (!out) return;
  if (out.logs) d.addLog(out.logs);
  if (out.delayedLogs) setTimeout(() => d.addLog(out.delayedLogs), out.delayMs ?? 0);
  if (out.changes) {
    const setters = {
      varTree: d.setVarTree, room: d.setRoom, mapData: d.setMapData, time: d.setTime,
      convo: d.setConvo, char: d.setChar, skills: d.setSkills, inv: d.setInv,
      dao: d.setDao, exp: d.setExp, pot: d.setPot, flags: d.setFlags,
      gambleNegotiation: d.setGambleNegotiation, pendingQuestBranch: d.setPendingQuestBranch,
    };
    for (const [key, value] of Object.entries(out.changes)) setters[key]?.(value);
  }
  if (out.refWrites) {
    for (const [key, value] of Object.entries(out.refWrites)) {
      if (d[key]) d[key].current = value;
    }
  }
}
