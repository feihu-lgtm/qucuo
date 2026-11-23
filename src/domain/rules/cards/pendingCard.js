// 待用主角卡与开局同行（从 importedRegistry.js 拆出）
// ============================================================================
// ── 待用主角卡 ──────────────────────────────────────────────────────────────
// 【为什么单独放 localStorage 而不进上面那个 IndexedDB 库】
// 导入主角只能发生在开局之前——角色一旦创建，再导就是覆盖。而开始界面
// （StartScreen）在 MudRPG 之外，那时既没有 char 也没有 setChar。所以流程是：
// 开始界面导入 → 存一张「待用卡」→ CharacterCreate 读到它，问玩家要不要用它开局。
// CharacterCreate 是同步渲染的，读不了异步的 IDB，而这张卡只有名字＋12 项体貌＋
// 七维，几 KB，localStorage 完全够。
//
// 【这三个函数曾经缺失过】消费侧（CharacterCreate 的三处读、main.jsx 的一处写）
// 在 49e4128 就提交了，生产侧却没进去——当时用的是不带 assert 的字符串替换，
// 锚点对不上就静默空转。vitest 全绿（没有一条测试 import CharacterCreate），
// 只有 vite build 抓得到「is not exported by」。教训：单文件语法检查看不出
// 跨模块的导出缺失，改完必须跑一次 bundle。
const PENDING_KEY = "qucuo_pending_player_card";

export function setPendingPlayerCard(player) {
  try {
    if (!player) { localStorage.removeItem(PENDING_KEY); return; }
    localStorage.setItem(PENDING_KEY, JSON.stringify({ ...player, at: Date.now() }));
  } catch { /* 无痕模式写不进就算了，只是少一个便利功能 */ }
}

/** 同步读，供 CharacterCreate 渲染时判断要不要显示「用这张卡开局」 */
export function getPendingPlayerCard() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return (v && typeof v === "object" && v.bodyProfile) ? v : null;
  } catch { return null; }
}

export function clearPendingPlayerCard() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* */ }
}

// ── 开局同行 ──────────────────────────────────────────────────────────────────
// 开局向导第 2 步从「落江湖的 NPC」里指定 1 人开局就随队（companion 出战位）。
// 跟待用主角卡同一个思路：开局前才有效，存 localStorage，新开局时 MudRPG 读到后
// 用 unlockImportedCompanion 把它设成已解锁+出战，随后即清除。
const STARTER_KEY = "qucuo_pending_starter_companion";

export function setPendingStarterCompanion(name) {
  try {
    if (!name) { localStorage.removeItem(STARTER_KEY); return; }
    localStorage.setItem(STARTER_KEY, String(name).slice(0, 20));
  } catch { /* 无痕模式写不进就算了 */ }
}

export function getPendingStarterCompanion() {
  try { return localStorage.getItem(STARTER_KEY) || ""; } catch { return ""; }
}

export function clearPendingStarterCompanion() {
  try { localStorage.removeItem(STARTER_KEY); } catch { /* */ }
}
