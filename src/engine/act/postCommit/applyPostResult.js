// 路线甲·纯函数化处理器的统一落盘口。
// 处理器只返回结果描述：{ logs, delayedLogs, delayMs, changes, refWrites }。
// 这里负责把结果落成真实的日志与状态写入——处理器内不再直接调 d.addLog / d.setX。
// changes 的 key 与 d.setX 的对应表只此一份；refWrites 的 key 是 d 上的 ref 名字段。

export function applyPostResult(d, out) {
  if (!out) return;
  if (out.logs) d.addLog(out.logs);
  // insertLogs：要插在日志流中间（如地名标题排在本轮 cmd 回显之后、正文之前）；
  // 无 setLog 时退化为追加
  if (out.insertLogs) {
    if (d.setLog) {
      d.setLog((prev) => {
        const revIdx = [...prev].reverse().findIndex((e) => e?.t === "cmd");
        const at = revIdx < 0 ? prev.length : prev.length - revIdx;
        return [...prev.slice(0, at), ...out.insertLogs, ...prev.slice(at)];
      });
    } else {
      d.addLog(out.insertLogs);
    }
  }
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
      if (!d[key]) continue;
      if (typeof value === "function") {
        const next = value(d[key].current);
        if (next !== undefined) d[key].current = next; // 返回 undefined 视为原地改（如 push）
      } else {
        d[key].current = value;
      }
    }
  }
  // dWrites：处理器间隐式传值的显式化——写回 d 自身（如 freshNpcData 供后续处理器读）
  if (out.dWrites) Object.assign(d, out.dWrites);
  // effects：异步副作用（如小纸条向量写入），由落盘口统一触发
  if (out.effects) out.effects.forEach((fn) => fn());
}
