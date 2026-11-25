// ── 信息领域·memory 登记为可传播事实（原 commitRound 内嵌块）──
// 路线甲纯函数化：返回 { changes, refWrites } 由 commitRound 统一落盘。
import { registerFact } from "../../../domain/rules/prompt/knowledge.js";

export function registerMemoryFact({ p, room, activeTarget, isTalk, talkTarget, time, appendDayMaterial }) {
  if (!p.memory) return null;
  // 单调用 JSON 可能把 memory 吐成数组/对象——入账前一律归一成字符串，
  // 否则逐字哈希/入账流程会在叙事上屏后抛错，整轮回滚。
  if (typeof p.memory !== "string") {
    p = { ...p, memory: Array.isArray(p.memory) ? p.memory.filter(Boolean).join("；") : String(p.memory) };
    if (!p.memory) return null;
  }
  const roomNpcs = (p.room && Array.isArray(p.room.npcs) ? p.room.npcs : room.npcs) || [];
  const witnesses = (activeTarget || (isTalk && talkTarget))
    ? [{ name: activeTarget || talkTarget, 途径: "亲历" }]
    : roomNpcs.map(n => ({ name: n.name, 途径: "目击" }));
  // 同一回合对同一对象可能有多条记忆（连聊两次时间不前进时 time 相同），
  // id 只按 time+对象 命名会让 registerFact 静默丢弃后一条——把摘要文本
  // 哈希进 id，内容不同即不同键；内容完全相同的重复条目被去重是正确的。
  let hash = 0;
  for (let i = 0; i < p.memory.length; i += 1) hash = (hash * 31 + p.memory.charCodeAt(i)) >>> 0;
  return {
    // 主叙事/对话的事实也进当日原料（日总结用）——经 io 注入回调推送，不出 app 层
    effects: appendDayMaterial ? [() => appendDayMaterial({ turn: time, text: p.memory })] : undefined,
    changes: witnesses.length ? {
      varTree: (prev) => registerFact(prev, { id: `turn_${time}_${witnesses[0].name}_${hash.toString(36)}`, 摘要: p.memory, 标签: isTalk ? "私语" : "见闻", 知晓者: witnesses }, time),
    } : undefined,
  };
}
