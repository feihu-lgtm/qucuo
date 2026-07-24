// 从 qucuoQuests.js 自动提取全部任务，生成攻略手册 markdown。
// 一字不差地读代码里的真实字段，不手抄、不编造。
import { QUCUO_QUESTS } from "../src/quests/qucuoQuests.js";

// 任务分组（按 id 前缀归线）
const GROUPS = [
  { key: "虎胆三重门", match: (q) => q.exclusiveGroup === "虎胆归属" || q.id === "hidden_all_collect_line", desc: "三方互斥主线：任一条完成即锁定另外两条（除非满足隐藏全收集条件）" },
  { key: "村线·界石下的旧账", match: (q) => q.id.startsWith("village"), desc: "鱼定村六段递进支线，揭开地契伪造的旧账" },
  { key: "山线·狼曲与黑风寨", match: (q) => /^(shan|heifeng|hu\d|山)/.test(q.id) || q.id.includes("狼"), desc: "从狼曲遇匪到黑风寨，收束于狼烟旧账" },
  { key: "欢喜教线", match: (q) => q.id.includes("huanxi") || q.title.includes("欢喜教"), desc: "天都镇欢喜堂展开的长线" },
  { key: "锦官城官线·凤隐于青", match: (q) => q.id.includes("guan") || q.title.includes("官"), desc: "全乡与外界博弈，带分支抉择" },
  { key: "玉泉寨爱情线", match: (q) => q.id.includes("yuquan") || q.title.includes("玉泉"), desc: "玉泉寨牧民五段线，通向贡措海爱情高潮" },
  { key: "五神兵支线", match: (q) => q.title.includes("神兵"), desc: "散落全乡的五件神兵获取任务" },
  { key: "独立任务", match: () => true, desc: "其它单独任务" },
];

function rewardStr(onReach) {
  if (!onReach) return "—";
  const parts = [];
  if (onReach.exp) parts.push(`经验 +${onReach.exp}`);
  if (onReach.favorability) parts.push("好感度 " + Object.entries(onReach.favorability).map(([k, v]) => `${k}${v >= 0 ? "+" : ""}${v}`).join("、"));
  if (onReach.favorabilitySet) parts.push("好感度设为 " + Object.entries(onReach.favorabilitySet).map(([k, v]) => `${k}=${v}`).join("、"));
  if (onReach.items) parts.push("获得物品：" + (Array.isArray(onReach.items) ? onReach.items.map(it => typeof it === "string" ? it : it.name || JSON.stringify(it)).join("、") : onReach.items));
  if (onReach.reputation) parts.push("声望 " + Object.entries(onReach.reputation).map(([k, v]) => `${k}${v >= 0 ? "+" : ""}${v}`).join("、"));
  if (onReach.flags) parts.push("标记：" + (Array.isArray(onReach.flags) ? onReach.flags.join("、") : onReach.flags));
  return parts.length ? parts.join("；") : "—";
}

function stageBlock(s, i) {
  let out = `**第 ${i + 1} 阶段**：${s.description || "(无描述)"}\n\n`;
  if (s.playerHint) out += `- 🧭 怎么做：${s.playerHint}\n`;
  if (s.collect) out += `- 🎒 需采集：在「${s.collect.at}」获得「${s.collect.item}」${s.collect.quality ? `（${s.collect.quality}品）` : ""}${s.collect.hint ? ` —— ${s.collect.hint}` : ""}\n`;
  if (s.deliver) out += `- 📦 需交付：${typeof s.deliver === "string" ? s.deliver : JSON.stringify(s.deliver)}\n`;
  if (s.persuade) out += `- 💬 需说服：${typeof s.persuade === "string" ? s.persuade : JSON.stringify(s.persuade)}\n`;
  if (s.requireLocation) out += `- 📍 需到达：${s.requireLocation}\n`;
  if (s.choices) {
    out += `- 🔀 分支选择：\n`;
    for (const c of s.choices) {
      let line = `    - 「${c.label}」`;
      if (c.resolve === "combat" && c.combatNpc) line += ` → 战斗：${c.combatNpc.name}（等级上限 ${c.combatNpc.levelCap}${c.combatNpc.hostile ? "，敌对" : ""}）`;
      else if (c.resolve && c.resolve !== "none") line += ` → ${c.resolve}`;
      out += line + "\n";
    }
  }
  if (s.isCgMoment) out += `- ✨ 情感高潮节点（CG Moment）\n`;
  out += `- 🎁 通过奖励：${rewardStr(s.onReach)}\n`;
  return out;
}

function questBlock(q) {
  let out = `### ${q.title}\n\n`;
  out += `- **任务 ID**：\`${q.id}\`　**类型**：${q.type || "—"}　**委托人**：${q.giver || "无（自动触发/隐藏）"}\n`;
  if (q.exclusiveGroup) out += `- ⚔️ **互斥组**：「${q.exclusiveGroup}」——同组任务只能完成一条\n`;
  if (q.requiresQuestCompleted) out += `- 🔒 **前置**：需先完成 \`${Array.isArray(q.requiresQuestCompleted) ? q.requiresQuestCompleted.join("、") : q.requiresQuestCompleted}\`\n`;
  if (q.requiresAnyOf) out += `- 🔒 **前置（任一）**：\`${(Array.isArray(q.requiresAnyOf) ? q.requiresAnyOf : [q.requiresAnyOf]).join("、")}\`\n`;
  if (q.blockedByFlags) out += `- 🚫 **互斥标记**：有 \`${(Array.isArray(q.blockedByFlags) ? q.blockedByFlags : [q.blockedByFlags]).join("、")}\` 时不可接\n`;
  if (q.canBypassExclusive) out += `- 🗝️ **可绕过互斥**：满足特殊条件（详见隐藏全收集线）\n`;
  out += `\n> ${q.description || ""}\n\n`;
  if (q.targetTag) out += `**击杀目标**：${q.targetTag} × ${q.requiredCount || 1}\n\n`;
  if (q.stages && q.stages.length) {
    q.stages.forEach((s, i) => { out += stageBlock(s, i) + "\n"; });
  }
  out += `**🏆 最终奖励**：${q.rewardText || "—"}\n`;
  return out;
}

let md = `# 天都·曲措 · 任务攻略手册（代码核实版）

> ⚠️ **本手册由脚本从游戏源码 \`src/quests/qucuoQuests.js\` 自动提取**，每个任务的开启条件、
> 每阶段的通过方式、奖励数值都与代码一致，不含手写臆测。
> 🚧 **开发中说明**：任务的骨架、判定、奖励均已实现并跑通，但**叙事文本仍在打磨**，
> 实际游玩的对话细节可能与描述略有出入。
>
> 图例：🧭 怎么做　🎒 采集　📦 交付　💬 说服　🔀 分支　✨ 情感高潮　🎁 阶段奖励　🏆 最终奖励　🔒 前置　⚔️ 互斥

共 ${QUCUO_QUESTS.length} 条任务。

---

## 目录

`;

// 分组
const grouped = GROUPS.map(g => ({ ...g, quests: [] }));
const used = new Set();
for (const q of QUCUO_QUESTS) {
  for (const g of grouped) {
    if (used.has(q.id)) break;
    if (g.match(q)) { g.quests.push(q); used.add(q.id); break; }
  }
}

// 目录
for (const g of grouped) {
  if (!g.quests.length) continue;
  md += `- **${g.key}**（${g.quests.length} 条）\n`;
  for (const q of g.quests) md += `  - ${q.title}\n`;
}
md += `\n---\n\n`;

// 正文
for (const g of grouped) {
  if (!g.quests.length) continue;
  md += `## ${g.key}\n\n> ${g.desc}\n\n`;
  for (const q of g.quests) { md += questBlock(q) + "\n---\n\n"; }
}

md += `\n> 据点与功能导览见 [\`世界导览_据点与房间.md\`](世界导览_据点与房间.md)；任务线概览见 [\`世界导览_任务线.md\`](世界导览_任务线.md)。\n`;

process.stdout.write(md);
