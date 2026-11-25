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

// AI 产出的 mvu 指令本身就是 Patch[]；本函数只是 applyPatches(source:'mvu')
// 的门面：入树前深拷贝、返回形适配 {tree, applied, rejected, logs}。
export function applyMvuCommands(varTree, commands, opts = {}) {
  const turnBase = { varTree: JSON.parse(JSON.stringify(varTree)) };
  // turnBaselines：本批次里才声明好感的新角色，记下声明落定的分值当回合起点（见 applyWrite）
  const { state, applied, rejected, logs } = applyPatches(turnBase, commands, { ...opts, source: "mvu", turnBase, turnBaselines: new Map() });
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
