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
import { emptyTally } from "./memory/tally.js";

export function initialNarratorVars() {
  return {
    seaUnlocked: false,   // 心灵之海是否已解锁（玄女点破之后置真）
    metXuannu: false,     // 是否已被玄女点破过（防止引导重复播）
    seaVisited: false,    // 是否已经进过一次心灵之海
    villaEntered: false,  // 是否已进过白色别墅（阶段2 手工剧情只播一次）
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
export function setNarratorVars(varTree, patch) {
  const next = JSON.parse(JSON.stringify(varTree || {}));
  if (!next.世界) next.世界 = { 威望: 0 };
  next.世界.旁白 = { ...initialNarratorVars(), ...(next.世界.旁白 || {}), ...patch };
  return next;
}

export function initialVarTree() {
  return {
    角色: {},   // 角色.NPC名.属性名 = 值，例如 角色.呼延雪.好感度
    世界: { 威望: 0, 旁白: initialNarratorVars(), 起居注: emptyTally() },
                          // 世界.威望是全局单一的总声望值（做好事+，做坏事-，见下方裁剪规则），
                          // 其余"世界.任意状态"仍然可以自由声明，只有"威望"这一个字段有专门的初始值和裁剪。
                          // 世界.旁白.* 是旁白个人线的进度（见 initialNarratorVars）——挂在变量树里
                          // 而不是另起一套 state，是为了跟着存档走、也能被 <mvu> 指令读写。
    主角: {},   // 主角.任意属性
  };
}

// ---- 路径读写工具 ----

function getPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
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

// ---- 系统裁决层 ----
// 这里是唯一真正修改变量树的地方。所有 AI 提议的指令都要先过这一关。
// 裁决规则（可按需扩展）：
// 1. 路径必须以 角色./世界./主角. 开头，防止 AI 写入任意奇怪路径
// 2. 好感度类数值：_.add 单次幅度限制在 ±15 以内，_.set 限制在 0-100 范围内裁剪
// 3. 威望（世界.威望，全局单一总值，不分势力）：_.add 单次幅度限制在 ±15 以内，
//    _.set 限制在 -100~100 范围内裁剪——跟好感度同一套限幅逻辑，只是区间不同
// 4. 其他数值属性：不做特别限制，但会记录日志方便调试
const ALLOWED_ROOTS = ["角色", "世界", "主角"];

// ── 系统裁决域：AI 一律不得写入的路径（前缀匹配）──
// 项目第一条法则是「AI 提议内容，系统裁决数值与拓扑」。变量树里绝大多数东西
// （好感度、威望、各种自由声明的世界状态）确实该由 AI 在叙事里提议、系统裁剪后落盘；
// 但有一类不行——**个人线的进度与门禁**。它们跟 flags/questProgress 同类，
// 决定"玩家能不能进某个地方、剧情走到第几步"，属拓扑范畴。
//
// 这里堵的是一个真实的洞：ALLOWED_ROOTS 只校验根，"世界" 底下此前全部自由可写，
// 而 MVU 说明书还写着"其余世界状态按需自由声明"——等于明说随便写。于是
// AI 只要在 <mvu> 里写一句 _.set('世界.旁白.seaUnlocked', true)，就能把整条
// 旁白个人线的门禁一句话开掉，且不报错、无人察觉。
//
// AI 仍然读得到旁白的状态（当前好感档位与文风由 narratorVoicePrompt 注入），
// 只是不能改。要改由系统在满足条件时自己写（见 seaOfMind.js / setNarratorVars）。
const PROTECTED_PATHS = [
  "世界.旁白",   // 旁白个人线：seaUnlocked/metXuannu/seaVisited/questStage
  "世界.起居注", // 行动计数（memory/tally.js）：由系统在各动作点自增。
                 // AI 绝不能写——它一旦能改，"今日打坐3次"这类数就成了叙事编的，
                 // 而这些数会回头喂进 ctx 和日总结，等于让它自己给自己造证据。
];

// 这条路径是否落在系统裁决域内（前缀匹配，"世界.旁白" 挡住 "世界.旁白.任意子键"）。
export function isProtectedMvuPath(path) {
  const p = String(path || "");
  return PROTECTED_PATHS.some(pre => p === pre || p.startsWith(pre + "."));
}
const AFFECTION_KEY = "好感度";
const REPUTATION_PATH = "世界.威望";
const MAX_SINGLE_ADD = 15;

export function applyMvuCommands(varTree, commands, opts = {}) {
  const tree = JSON.parse(JSON.stringify(varTree)); // 深拷贝，避免直接改引用
  const rejected = [];
  const applied = [];
  // 魅力系数：玩家魅力高，正向好感度增量被放大（送礼、示好都更讨喜）。
  // 系数 0.8~1.4（魅力0→0.8，5→1.0，10→1.4），只放大"加好感"，不影响掉好感/威望。
  const charm = opts.charm ?? 5;
  const charmCoef = 1 + (Math.max(0, Math.min(10, charm)) - 5) * 0.06; // 魅力5→1.0，10→1.3，0→0.7

  for (const cmd of commands) {
    const root = cmd.path.split(".")[0];
    if (!ALLOWED_ROOTS.includes(root)) {
      rejected.push({ ...cmd, reason: `路径根 "${root}" 不在允许范围内` });
      continue;
    }
    // 系统裁决域：个人线进度/门禁不接受 AI 写入，写了也不生效。
    if (isProtectedMvuPath(cmd.path)) {
      rejected.push({ ...cmd, reason: `"${cmd.path}" 属系统裁决域（个人线进度/门禁），AI 无权改写` });
      continue;
    }

    const isAffection = cmd.path.endsWith("." + AFFECTION_KEY);
    const isReputation = cmd.path === REPUTATION_PATH;
    const clampRange = isReputation ? [-100, 100] : [0, 100];

    if (cmd.op === "set") {
      let value = cmd.value;
      if ((isAffection || isReputation) && typeof value === "number") {
        value = Math.max(clampRange[0], Math.min(clampRange[1], value));
      }
      setPath(tree, cmd.path, value);
      applied.push({ ...cmd, finalValue: value });
    } else if (cmd.op === "add") {
      if (typeof cmd.value !== "number") {
        rejected.push({ ...cmd, reason: "add 操作的值必须是数字" });
        continue;
      }
      let delta = cmd.value;
      // 魅力只放大"加好感度"（正增量），掉好感、威望不受影响。放大后再限幅。
      if (isAffection && delta > 0) delta = delta * charmCoef;
      if (isAffection || isReputation) {
        delta = Math.max(-MAX_SINGLE_ADD, Math.min(MAX_SINGLE_ADD, Math.round(delta)));
      }
      const current = getPath(tree, cmd.path);
      const base = typeof current === "number" ? current : 0;
      let next = base + delta;
      if (isAffection || isReputation) next = Math.max(clampRange[0], Math.min(clampRange[1], next));
      setPath(tree, cmd.path, next);
      applied.push({ ...cmd, finalValue: next, actualDelta: delta });
    }
  }

  return { tree, applied, rejected };
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
你可以通过在回复末尾追加一个 <mvu>...</mvu> 块来维护角色和世界的持久化状态变量。
语法（每行一条，分号结尾）：
  _.set('角色.某某.好感度', 30);   // 直接设置某个数值/文本
  _.add('角色.某某.好感度', 5);    // 在现有值基础上增减
路径规则：
- 新出场的 NPC，如果剧情需要追踪她/他和玩家的关系，请用 角色.<姓名>.好感度 声明并维护，初始值建议给 0-20 之间的合理数字
- 角色还可以有其他属性，如 角色.<姓名>.态度、角色.<姓名>.身份，按需自由声明
- 世界.威望 是全局唯一的总声望值（-100 到 100，初始 0，不分势力/据点），玩家做的事在江湖上传开、被人看在眼里时才用 _.add 调整——路见不平出手相助、兑现承诺、救人性命等义举加分（幅度参考好感度：明显的义举 +5~15）；坑蒙拐骗、恃强凌弱、背弃承诺等劣行减分（同等幅度扣分）。日常寻常对话、纯私人恩怨、没有旁人知晓的事不必触发这个字段——威望是"江湖怎么看你"，不是"某个人怎么看你"（那是好感度该管的事），两者不要混用
- 其余世界状态用 世界.<名称> 声明，按需自由声明（威望之外没有固定字段名）
- 主角自身状态用 主角.<名称> 声明
- 好感度、威望这两类数值都会被系统自动限制在各自的合理区间（好感度0-100，威望-100~100），单次增减都不会超过 ±15，不需要你自己计算裁剪
- 不要虚构不存在的路径根，只能用 角色 / 世界 / 主角 三个前缀
- 【禁写】世界.旁白.* 这一支是系统维护的剧情进度与门禁（是否解锁了某处、个人线走到第几步），你不得用 _.set/_.add 碰它的任何子键——写了会被系统直接丢弃。剧情该不该推进由系统按条件判定，不由叙事决定
- 这个 <mvu> 块不会展示给玩家看，只有你的 output 正文会展示，所以块内不需要考虑文风
`;
