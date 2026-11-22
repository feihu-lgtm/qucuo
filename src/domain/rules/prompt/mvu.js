// MVU 风格变量系统
// 核心思路：不在代码里预先声明每一个 NPC/属性，而是维护一棵可以任意生长的
// 变量树（普通 JS 嵌套对象），AI 在输出里嵌入类似 `_.set('路径', 值)` 的指令，
// 前端解析这些指令并"裁决"是否真的写入（白名单+幅度限制），而不是直接信任
// AI 返回的任意 JSON 结构。这保留了"AI 提议 + 系统裁决"的原则，
// 同时把"新增角色/属性不需要改代码"的灵活性还给了 AI。

// ---- 变量树的初始状态 ----
// 只给一个空壳，具体长出什么（哪些NPC、哪些属性）完全由游戏过程中
// AI 的 _.set 指令动态填充。
// 旁白个人线的变量。挂在 世界.旁白 下，随存档走。
// 【为什么要 ensure 而不是只在 initialVarTree 里给初值】老存档的 varTree 里没有这一支，
// 直接 varTree.世界.旁白.seaUnlocked 会炸；读的地方一律走 narratorVars() 兜底。
import { emptyTally } from "../memory/tally.js";
import { AFFECTION_RULES, FIELD, FIELDS } from "../state/fields.js";
import { applyPatches, merge } from "../state/applyPatches.js";
export { isProtectedMvuPath } from "../state/applyWrite.js";

export function initialNarratorVars() {
  return {
    seaUnlocked: false,   // 心灵之海是否已解锁（玄女点破之后置真）
    metXuannu: false,     // 是否已被玄女点破过（防止引导重复播）
    seaVisited: false,    // 是否已经进过一次心灵之海
    villaEntered: false,  // 是否已进过白色别墅（阶段2 手工剧情只播一次）
    portalOpened: false,  // 阶段5：传送门是否已开
    tokyoVisited: false,  // 阶段6：是否已回过第三新东京市
    asukaFree: false,     // 阶段7：明日香是否已脱身入队
    questStage: 0,        // 个人线阶段，0=未开始
    // ── 创伤线（narratorQuest.js）──
    // comfort 是唯一真值，defenseLevel 由它纯函数派生、不另存一份
    // （旧稿设计过独立的 trust 字段与 comfort 并存，两处记账必然对不上，已砍）
    comfort: { verbal: 0, food: 0, medication: 0, hug: 0, kiss: 0 },
    knots: [],            // 已说出口的心结 key，有序：hebe → corner → doll
    traumaResolved: false,
  };
}

// 安全读取 世界.旁白.*，老存档缺这一支时返回默认值。
export function narratorVars(varTree) {
  return { ...initialNarratorVars(), ...(varTree?.世界?.旁白 || {}) };
}

// 写入 世界.旁白 的若干字段，返回新的 varTree（不就地改）。
// 收口进 applyPatches：世界.* 是系统裁决域，走 merge（可信深写，不经字段声明表）。
export function setNarratorVars(varTree, patch) {
  return applyPatches({ varTree: varTree || {} }, [
    merge("varTree.世界", (prev) => ({
      威望: 0,
      ...(prev || {}),
      旁白: { ...initialNarratorVars(), ...(prev?.旁白 || {}), ...patch },
    })),
  ]).state.varTree;
}

export function initialVarTree() {
  return {
    角色: {},   // 角色.NPC名.属性名 = 值，例如 角色.呼延雪.好感度
    世界: { 威望: 0, 旁白: initialNarratorVars(), 起居注: emptyTally(), 好感日增: { dayStamp: 0, gained: {} } },
                          // 世界.威望是全局单一的总声望值（做好事+，做坏事-，见下方裁剪规则），
                          // 其余"世界.任意状态"仍然可以自由声明，只有"威望"这一个字段有专门的初始值和裁剪。
                          // 世界.旁白.* 是旁白个人线的进度（见 initialNarratorVars）——挂在变量树里
                          // 而不是另起一套 state，是为了跟着存档走、也能被 <mvu> 指令读写。
    主角: {},   // 主角.任意属性
  };
}

// ---- 指令语法 ----
// AI 在 output 文本之外，另起一段 <mvu> 块，内容形如：
//   _.set('角色.呼延雪.好感度', 8);
//   _.add('角色.呼延雪.好感度', 5);  // 在现有值基础上加减
//   _.set('世界.曲措乡声望', 10);
// 每行一条指令，分号结尾，注释用 // 开头（会被忽略）。
// 用简单正则解析，不引入真正的 JS eval，避免任意代码执行风险。

const SET_RE = /_\.set\(\s*'([^']+)'\s*,\s*(.+?)\s*\)\s*;?/g;
const ADD_RE = /_\.add\(\s*'([^']+)'\s*,\s*(.+?)\s*\)\s*;?/g;

function parseValue(raw) {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
  // 去掉包裹的引号（单引号或双引号字符串）
  const m = trimmed.match(/^['"](.*)['"]$/);
  if (m) return m[1];
  return trimmed;
}

// 从 AI 原始输出文本中提取 <mvu>...</mvu> 块，返回 { cleanText, commands }
// cleanText 是去掉 mvu 块之后的文本（用于正常展示叙事内容）
export function extractMvuBlock(rawText) {
  const blockMatch = rawText.match(/<mvu>([\s\S]*?)<\/mvu>/);
  if (!blockMatch) return { cleanText: rawText, commands: [] };

  const block = blockMatch[1];
  const cleanText = rawText.replace(blockMatch[0], "").trim();
  const commands = [];

  let m;
  SET_RE.lastIndex = 0;
  while ((m = SET_RE.exec(block)) !== null) {
    commands.push({ op: "set", path: m[1], value: parseValue(m[2]) });
  }
  ADD_RE.lastIndex = 0;
  while ((m = ADD_RE.exec(block)) !== null) {
    commands.push({ op: "add", path: m[1], value: parseValue(m[2]) });
  }
  return { cleanText, commands };
}

const MAX_SINGLE_ADD = AFFECTION_RULES.mvu.maxDelta;

// AI 产出的 mvu 指令本身就是 Patch[]；本函数只是 applyPatches(source:'mvu')
// 的门面：入树前深拷贝、返回形适配 {tree, applied, rejected, logs}。
export function applyMvuCommands(varTree, commands, opts = {}) {
  const { state, applied, rejected, logs } = applyPatches(
    { varTree: JSON.parse(JSON.stringify(varTree)) },
    commands,
    { ...opts, source: "mvu" },
  );
  return { tree: state.varTree, applied, rejected, logs };
}

// 威望数值 → 文字标签，同好感度的 npcAffectionLabel 风格，供 UI 展示用。
export function reputationLabel(value) {
  if (value == null) return "未知";
  if (value <= -60) return "声名狼藉";
  if (value <= -20) return "劣迹斑斑";
  if (value < 20) return "籍籍无名";
  if (value < 60) return "颇有侠名";
  return "威震曲措乡";
}

// ---- 供 UI / prompt 使用的辅助函数 ----

// 列出当前变量树里所有已经"长出来"的角色名及其属性，供右侧面板展示
export function listCharacters(varTree) {
  const chars = varTree.角色 || {};
  return Object.entries(chars).map(([name, attrs]) => ({ name, attrs }));
}

export function npcAffectionLabel(affection) {
  if (affection == null) return "未知";
  if (affection < 10) return "陌生";
  if (affection < 30) return "初识";
  if (affection < 50) return "熟络";
  if (affection < 70) return "信任";
  if (affection < 90) return "亲近";
  return "深交";
}

// 拼进 system prompt 的说明，教会 AI 这套指令语法
export const MVU_SYSTEM_INSTRUCTIONS = `
回复末尾可追加 <mvu>...</mvu> 维护持久化状态（不展示给玩家，仅 output 展示，块内不考虑文风）。
语法（每行一条，分号结尾）：
  _.set('角色.某某.好感度', 30);   // 设数值/文本
  _.add('角色.某某.好感度', 5);    // 增减数值
路径与区间：
- 仅可用 角色 / 世界 / 主角 三个前缀，禁虚构路径根。
- 需追踪关系的新 NPC 用 角色.<姓名>.好感度 声明（建议初始 ${AFFECTION_RULES.firstMeeting.join("-")}）；其他属性如 角色.<姓名>.态度、角色.<姓名>.身份 按需声明。
- 世界.威望 全局唯一；其余世界状态用 世界.<名称> 自由声明（威望外无固定字段）；主角状态用 主角.<名称> 声明。
- 绝对区间：好感度 ${FIELDS[FIELD.affection].min}~${FIELDS[FIELD.affection].max}，威望 ${FIELDS[FIELD.reputation].min}~${FIELDS[FIELD.reputation].max}；单次增减不超 ±${MAX_SINGLE_ADD}。
- 【禁写】世界.旁白.* 属系统维护的剧情进度与门禁，禁 _.set/_.add 碰任何子键（会被丢弃）；剧情推进由系统按条件判定，不由叙事决定。
变动尺度（以本轮专用规则为准）：
- 好感度：寻常友好聊天 +1；白档礼物通常 +${AFFECTION_RULES.gift["白"][0]}~+${AFFECTION_RULES.gift["白"][1]}；重情分（如传授绝学）可到 +${AFFECTION_RULES.learn.master[1]}；无态度变化不改。
- 威望：公开义举（路见不平、兑现承诺）+5~${FIELDS[FIELD.reputation].maxDelta}，广为人知的恶行同量扣减；私下态度不是威望，禁与单人好感混用。
`;
