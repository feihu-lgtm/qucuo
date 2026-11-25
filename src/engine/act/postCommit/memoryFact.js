// ── 信息领域·memory 登记为可传播事实（原 commitRound 内嵌块）──
// 路线甲纯函数化：返回 { changes, refWrites } 由 commitRound 统一落盘。
import { registerFact } from "../../../domain/rules/prompt/knowledge.js";

export function registerMemoryFact({ p, room, activeTarget, isTalk, talkTarget, time, appendDayMaterial }) {
  if (!p.memory) return null;
  const roomNpcs = (p.room && Array.isArray(p.room.npcs) ? p.room.npcs : room.npcs) || [];
  const witnesses = (activeTarget || (isTalk && talkTarget))
    ? [{ name: activeTarget || talkTarget, 途径: "亲历" }]
    : roomNpcs.map(n => ({ name: n.name, 途径: "目击" }));
  return {
    // 主叙事/对话的事实也进当日原料（日总结用）——经 io 注入回调推送，不出 app 层
    effects: appendDayMaterial ? [() => appendDayMaterial({ turn: time, text: p.memory })] : undefined,
    changes: witnesses.length ? {
      varTree: (prev) => registerFact(prev, { id: `turn_${time}_${witnesses[0].name}`, 摘要: p.memory, 标签: isTalk ? "私语" : "见闻", 知晓者: witnesses }, time),
    } : undefined,
  };
}
