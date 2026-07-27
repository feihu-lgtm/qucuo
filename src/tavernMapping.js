// 酒馆（SillyTavern）式 13 条注入位置映射
// ============================================================================
// 把 system prompt 的“一坨大字符串”拆成多条带角色/位置的消息，让模型按酒馆
// 13 条注入顺序接收信息。每条消息带 tavernBlock / tavernLabel，供 TraceViewer
// 和注入结构面板做可视化定位。
//
// 位置编号与含义对齐酒馆默认 Prompt Manager 顺序：
//   1 Main Prompt · 2 World Info Before Char · 3 Character Description
//   4 Character Personality · 5 Scenario · 6 World Info After Char
//   7 Persona Description · 8 Author's Note · 9 Example Messages
//   10 Chat History · 11 In-Chat Injection · 12 User's Latest Message
//   13 Post-History Instructions / Jailbreak

export const TAVERN_POSITIONS = [
  { key: "main", order: 1, label: "Main Prompt", role: "system" },
  { key: "worldInfoBefore", order: 2, label: "World Info — Before Char", role: "system" },
  { key: "charDescription", order: 3, label: "Character Description", role: "system" },
  { key: "charPersonality", order: 4, label: "Character Personality", role: "system" },
  { key: "scenario", order: 5, label: "Scenario", role: "system" },
  { key: "worldInfoAfter", order: 6, label: "World Info — After Char", role: "system" },
  { key: "persona", order: 7, label: "Persona Description", role: "system" },
  { key: "authorsNote", order: 8, label: "Author's Note", role: "system" },
  { key: "exampleStart", order: 9, label: "Example Start Marker", role: "user" },
  { key: "dialogueExamples", order: 9, label: "Example Messages", role: "system" },
  { key: "chatHistory", order: 10, label: "Chat History", role: "user" },
  { key: "inChat", order: 11, label: "In-Chat Injection", role: "user" },
  { key: "latestUser", order: 12, label: "User's Latest Message", role: "user" },
  // 【注意与酒馆原义的差别】ST 的 Post-History Instructions 是 system 角色
  // （API 不支持 system 时退化为 user），靠"位置最靠后"取得优先级，不是 prefill。
  // 我们这一位实现的是 prefill：assistant 角色 + 作为最后一条消息，让模型顺着
  // 它继续写。沿用 PHI 这个名字只是为了位次对得上酒馆的 13 位视图，技法并不相同。
  { key: "phi", order: 13, label: "Post-History Instructions（本项目实为 assistant prefill）", role: "assistant" },
];

const POSITION_BY_KEY = Object.fromEntries(TAVERN_POSITIONS.map(p => [p.key, p]));

// 用指定 key 创建一个带酒馆位置的 system 块（buildSysBase 内部用）
export function makeBlock(key, content = "") {
  const pos = POSITION_BY_KEY[key];
  return {
    role: pos?.role || "system",
    content,
    tavernBlock: key,
    tavernLabel: pos?.label || key,
  };
}

// 给一条消息标记酒馆位置（用于纯外部消息，不经过 buildSysBase 时）
export function labelMessage(msg, key) {
  const pos = POSITION_BY_KEY[key];
  return {
    ...msg,
    tavernBlock: key,
    tavernLabel: pos?.label || key,
  };
}

// 把一组已按 Tavern 顺序排好的消息批量标上位置
// 注意：调用方必须保证消息顺序与 TAVERN_POSITIONS 一致。
export function labelMessages(messages) {
  return messages.map((m, i) => {
    const pos = TAVERN_POSITIONS[i];
    if (!pos) return m;
    return { ...m, tavernBlock: pos.key, tavernLabel: pos.label };
  });
}

// 按 key 查找位置元信息
export function getPositionMeta(key) {
  return POSITION_BY_KEY[key] || null;
}

// 把 content 数组拼成一段用于旧式日志/显示的 system 文本
export function concatSystemText(messages) {
  return messages
    .filter(m => m.role === "system")
    .map(m => `[${m.tavernLabel || m.tavernBlock || "system"}]\n${m.content || ""}`)
    .join("\n\n");
}

// 格式化单条消息用于调试输出
export function formatTavernMessage(m, index) {
  const pos = m.tavernBlock ? `[${m.tavernLabel || m.tavernBlock}] ` : "";
  return `#${index + 1} ${pos}${m.role}\n${m.content || ""}`;
}
