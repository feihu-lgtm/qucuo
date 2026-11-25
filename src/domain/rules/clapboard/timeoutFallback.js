// 短答档首字超时本地兜底（WO-08）：纯函数生成一句不涉及任何状态变更的过渡反应。
// 玩家按下发送、模型首字还没到时先上屏解 waiting 焦虑；真实流式抵达后按 backfillKey 原位替换。
// 铁律：不掷骰、不读时间、不写状态——同输入恒同输出，命中顺序即优先级。

// 性情标签 → 反应句。按 personality 文本的关键词匹配，先中先用。
const PERSONA_LINES = [
  { keys: ["精明", "算计", "商", "算盘"], line: (n) => `${n}拨弄着算盘，抬眼细细打量你。` },
  { keys: ["豪爽", "爽朗", "直率", "粗豪"], line: (n) => `${n}咧嘴一笑，抬手给你把碗满上。` },
  { keys: ["冷", "傲", "孤"], line: (n) => `${n}眼皮也懒得抬，指尖有一搭没一搭敲着桌沿。` },
  { keys: ["暴", "烈", "急躁", "火"], line: (n) => `${n}不耐烦地拿指节叩着桌面，等你把话说完。` },
  { keys: ["温", "善", "柔", "慈"], line: (n) => `${n}温声让你且坐，转身去张罗热水。` },
  { keys: ["狡", "猾", "奸"], line: (n) => `${n}眯起眼笑了笑，袖中的手却悄悄收紧了。` },
];

// 动作类别 → 过渡句。key 用 includes 匹配意图类别原文（如「切磋」「交易」「交谈」）。
const KIND_LINES = [
  // WO-16H-H2 补底稿五类缺口（文案照 roadmap 字面，搜刮用「看着」；查看类不走搜刮，
  // 故搜刮 keys 不含「看/查」——避免荒野里冒出翻箱倒柜的假动作）。
  { keys: ["拜师", "求教"], line: (n) => (n ? `${n}上下打量你，没立刻点头。` : "场院里一时静了下来。") },
  { keys: ["搜刮", "翻找", "箱柜", "尸身"], line: (n) => (n ? `${n}站在一旁看着，没作声。` : "你伸手往里探去，指尖碰着些灰土。") },
  { keys: ["敷药", "上药", "敷"], line: (n) => (n ? `${n}递过一块干净粗布。` : "苦涩药味在指尖散开。") },
  { keys: ["打坐", "调息", "入定"], line: (n) => (n ? `${n}放轻了脚步站在一旁。` : "你闭目收拢喘息，四下静了下来。") },
  { keys: ["邀伴", "邀人", "同行"], line: (n) => (n ? `${n}掂了掂行囊，朝你看过来。` : "长路在脚下铺开，只欠一句准话。") },
  { keys: ["切磋", "决斗", "战斗", "攻击", "偷袭"], line: (n) => (n ? `${n}退了半步，手缓缓按上腰间兵刃。` : "空气霎时绷紧，连风声都停了。") },
  { keys: ["交易", "买", "卖", "谈价"], line: (n) => (n ? `${n}拨弄着算盘，抬眼细细打量你。` : "柜上的算盘珠子被风碰得轻响。") },
  { keys: ["赠送", "给", "送礼"], line: (n) => (n ? `${n}视线落在你手上，没急着接。` : "四下里静了一瞬。") },
  { keys: ["移动", "赶路", "探索", "走", "出门"], line: (_n, place) => (place ? `${place}的风卷着雪沫扑面而来，你眯了眯眼。` : "风卷着雪沫扑面而来，你眯了眯眼。") },
  { keys: ["偷窃", "偷", "扒"], line: (n) => (n ? `${n}别过脸去招呼旁人，似乎并未留意你这边。` : "周遭人声嘈杂，没人留意你这边。") },
  { keys: ["交谈", "搭话", "问", "说"], line: (n) => (n ? `${n}抬眼看你，似在掂量你这话的分量。` : "你清了清嗓子，四下里一静。") },
];

const DEFAULT_NPC_LINE = (n) => `${n}抬眼看你，似在等你把话说完。`;
const DEFAULT_ENV_LINE = "风雪掠过檐角，四下里静了一瞬。";

function matchLine(table, text, npcName, place) {
  for (const row of table) {
    if (row.keys.some((k) => text.includes(k))) return row.line(npcName, place);
  }
  return null;
}

// 生成一句过渡反应。
// kind：动作类别原文（可空）；npc：{ name, personality } 在场相关 NPC（可空）；
// place：地名（可空）。优先按动作类别给句，类别认不出再按 NPC 性情，兜底环境句。
export function timeoutFallbackLine({ kind = "", npc = null, place = "" } = {}) {
  const npcName = npc?.name || "";
  if (kind) {
    const line = matchLine(KIND_LINES, String(kind), npcName, place);
    if (line) return line;
  }
  if (npcName && npc?.personality) {
    const line = matchLine(PERSONA_LINES, String(npc.personality), npcName, place);
    if (line) return line;
  }
  if (npcName) return DEFAULT_NPC_LINE(npcName);
  return DEFAULT_ENV_LINE;
}
