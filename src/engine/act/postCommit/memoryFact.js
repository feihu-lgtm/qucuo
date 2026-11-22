// ── 信息领域·memory 登记为可传播事实（原 commitRound 内嵌块）──
import { registerFact } from "../../../domain/rules/prompt/knowledge.js";

export function registerMemoryFact(d) {
  if (d.p.memory) {
    d.dayMaterialRef.current.push({ turn: d.time, text: d.p.memory }); // 主叙事/对话的事实也进当日原料（日总结用）
    const roomNpcs = (d.p.room && Array.isArray(d.p.room.npcs) ? d.p.room.npcs : d.room.npcs) || [];
    const witnesses = (d.activeTarget || (d.isTalk && d.talkTarget))
      ? [{ name: d.activeTarget || d.talkTarget, 途径: "亲历" }]
      : roomNpcs.map(n => ({ name: n.name, 途径: "目击" }));
    if (witnesses.length) {
      const factId = `turn_${d.time}_${witnesses[0].name}`;
      d.setVarTree(prev => registerFact(prev, { id: factId, 摘要: d.p.memory, 标签: d.isTalk ? "私语" : "见闻", 知晓者: witnesses }, d.time));
    }
  }
}
