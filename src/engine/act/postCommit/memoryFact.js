// ── 信息领域·memory 登记为可传播事实（原 commitRound 内嵌块）──
// 路线甲纯函数化：返回 { changes, refWrites } 由 commitRound 统一落盘。
import { registerFact } from "../../../domain/rules/prompt/knowledge.js";

// 单调用 JSON 可能把 memory 吐成数组/对象——所有消费口（writeMemoryNote/
// appendDayMaterial/registerMemoryFact）共用这一归一，否则数组逐字哈希/拼接
// 流程会在叙事上屏后抛错，整轮回滚。commitRound 在进 postCommit 链前统一调用。
export function normalizeMemoryText(memory) {
  if (!memory) return memory;
  if (typeof memory === "string") return memory;
  if (Array.isArray(memory)) return memory.filter(Boolean).join("；");
  if (typeof memory === "object") {
    // 对象形态：优先取常见文本字段，否则 JSON 序列化——裸 String() 只会得到
    // "[object Object]"，事实摘要全丢且不同内容哈希相同互相撞键。
    // 逐字段取第一个非空白字符串——空白/非字符串的 text 不能掩盖后面的有效 summary
    for (const key of ["text", "摘要", "summary", "content"]) {
      const v = memory[key];
      if (typeof v === "string" && v.trim()) return v;
    }
    try { return JSON.stringify(memory); } catch { return String(memory); }
  }
  return String(memory);
}

export function registerMemoryFact({ p, room, activeTarget, isTalk, talkTarget, time, appendDayMaterial }) {
  if (!p.memory) return null;
  if (typeof p.memory !== "string") {
    p = { ...p, memory: normalizeMemoryText(p.memory) };
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
