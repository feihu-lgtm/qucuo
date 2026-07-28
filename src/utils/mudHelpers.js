export const DIRS = { n: "北", s: "南", e: "东", w: "西", u: "上", d: "下", ne: "东北", nw: "西北", se: "东南", sw: "西南" };
export const bar = (v, mx, len = 10) => { const f = Math.max(0, Math.round((v / mx) * len)); return "█".repeat(f) + "░".repeat(len - f); };
export const STAGES = ["入门", "小成", "大成", "圆满", "登峰造极"];
// 武学升阶潜能成本（模块级，渲染和逻辑共用）：越高阶越贵，阶跃式突破单次成本较高
export const STAGE_UP_COST = { 小成: 12, 大成: 20, 圆满: 32, 登峰造极: 48 };
export const STAGE_TO_QUALITY = { 入门: "白", 小成: "绿", 大成: "蓝", 圆满: "紫", 登峰造极: "橙" };
export const DIR_DXY = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1], u: [0, 0], d: [0, 0] };
// 方向解析：之前要求方向词必须是字符串开头（如"北""往北"），但"向北走""朝北边走"
// "往北面走走"这类更符合口语习惯的说法反而识别不了——"向""朝"这类前置词没被覆盖，
// 导致这么打字的玩家的移动请求被系统误判为"没有明确移动方向"，于是不走系统裁决的
// 固定地图分支，AI 就有机可乘地自由发挥编出不存在的过渡地名（比如"熊曲山谷"）、
// 还擅自把 room.name 改成这个编造的地方，绕开了"AI 不能决定去哪里"这条硬规则。
// 修复只放宽"移动类前缀"（向/往/朝/去/到）+ 方向字的组合，不能简单放宽成"方向字
// 出现在字符串前几位就算"——那样"看看北边有没有人""北面风景不错"这类根本不是
// 移动指令的句子也会被误判成移动，反而制造新 bug。
const DIR_PREFIX = "(?:向|往|朝|去|到)?"; // 移动类前缀，可选（兼容"北""往北""向北走"）
// 方向表按【长的在前】排序，这是这个函数唯一要命的地方。
//
// 【锦官城那个单行陷阱的根子就在这个顺序上】
// 锦官城的**唯一**出口是 ne（东北→鱼定村），而鱼定村去锦官城走的是 sw。
// 最早这里干了两件事，正好把这条路封成单行道：给"西南/去锦官城"写了条精确
// 别名（进得去），却又写 `if (/^…(东南|东北|西北)/) return null` 把东北整个
// 毙掉（出不来）。那句 return null 的理由是"地图不支持这些复合方向，否则会被
// 东/西的单字正则提前命中"——理由前半句在锦官城进地图那刻就过期了，后半句才是
// 真问题，而真问题的正解是**把两个字的方向排在一个字的前面**，不是一律毙掉。
// 后来打的补丁只单独放行了 `/^(往东北|东北)/`，仍然漏两种写法：
//   parseDir("去东北") → 落到 e 的正则（"去东"命中）→ 返回 "e"，往东走；
//   parseDir("ne")     → 落到 n 的正则 → 返回 "n"，往北走。
// 现在八向全部照实解析，某个方向此地到底有没有路，交给 QUCUO_MAP 查表裁决
// （resolveExit 返回 null 时 resolveOuterLock 会给"此路不通"）——这才是本该有的
// 分工：parseDir 只管"这句话说的是哪个方向"，能不能走不是它的事。好处是以后
// 地图再加东南/西北的路，这里一行都不用改。
const DIR_PATTERNS = [
  // ── 两个字/两个字母的复合方向，必须排在单字之前 ──
  ["ne", new RegExp(`^(?:${DIR_PREFIX}(?:northeast|ne)|${DIR_PREFIX}东北)`)],
  ["nw", new RegExp(`^(?:${DIR_PREFIX}(?:northwest|nw)|${DIR_PREFIX}西北)`)],
  ["se", new RegExp(`^(?:${DIR_PREFIX}(?:southeast|se)|${DIR_PREFIX}东南)`)],
  ["sw", new RegExp(`^(?:${DIR_PREFIX}(?:southwest|sw)|${DIR_PREFIX}西南)`)],
  // ── 单字方向 ──
  ["n", new RegExp(`^(?:${DIR_PREFIX}(?:north|n)|${DIR_PREFIX}北)`)],
  ["s", new RegExp(`^(?:${DIR_PREFIX}(?:south|s)|${DIR_PREFIX}南)`)],
  ["e", new RegExp(`^(?:${DIR_PREFIX}(?:east|e)|${DIR_PREFIX}东)`)],
  ["w", new RegExp(`^(?:${DIR_PREFIX}(?:west|w)|${DIR_PREFIX}西)`)],
  ["u", new RegExp(`^(?:${DIR_PREFIX}(?:up|u)|${DIR_PREFIX}上)`)],
  ["d", new RegExp(`^(?:${DIR_PREFIX}(?:down|d)|${DIR_PREFIX}下)`)],
];
export const parseDir = (cmd) => {
  const c = (cmd || "").trim().toLowerCase();
  // 【删掉了"去锦官城→sw"这条地名别名】它是在鱼定村与锦官城直接接壤的年代写的。
  // 后来雅江插进了两者之间（鱼定村 -sw-> 雅江 -w-> 锦官城），这条别名就开始骗人：
  // 玩家打"去锦官城"，parseDir 返回 sw，查表走到的是**雅江**，人到了另一座城还
  // 以为自己到了锦官城。地名寻路本来就该走 autoTravelTo/findPath（九宫格点击与
  // 地图点击走的都是那条路，认的是目的地不是方向），parseDir 只该管方向。
  for (const [d, re] of DIR_PATTERNS) if (re.test(c)) return d;
  return null;
};

// 目标汉字数 → API 侧的 maxTokens 安全上限（真正的换算函数在 apiConfig.js，
// 这里是历史注释保留：中文一个汉字约占 1.5-2 个 token，用 2.2 倍系数 + 300 固定余量兜底）
const SHICHEN = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
// 24 回合/天，每时辰 2 回合。一个时辰劈两半：上半（偶数回合）为「初」、下半（奇数回合）为「正」。
// 如 t%24=2→丑初、=3→丑正、=6→卯初。子正即半夜正中，与古法一致。
// 24小时制钟点：每半时辰=1小时，子初(idx0)=23:00、子正(idx1)=0:00(显示24:00)、丑初(idx2)=1:00…
// 钟点 h=(idx+23)%24，h为0时按作者要求显示成24而非0。
const getClockHour = (idx) => { const h = (idx + 23) % 24; return (h === 0 ? 24 : h); };
export const getTimeStr = (t) => { const idx = ((t % 24) + 24) % 24; const day = Math.floor(t / 24) + 1; const shi = SHICHEN[Math.min(11, Math.floor(idx / 2))]; const half = idx % 2 === 0 ? "初" : "正"; return `第${day}日·${shi}${half}·${String(getClockHour(idx)).padStart(2, "0")}:00`; };
