// 卡扫描结果的降级值与清洗（从 scanPrompts.js 拆出）
// ============================================================================
// ── 降级值 ────────────────────────────────────────────────────────────────────

// AI 失败时不能阻塞导入，每个字段都要有不靠 AI 的兜底。
// 这些值的来源：special 全 5 是常人基线；levelCap 1 是"寻常村民"（residentNpcs
// 里 1 档最多的就是村民店家）；好感 0 是初见默认；里程碑四档阈值与 AI 输出一致。
// 阈值必须是 30 / 60 两档：characterMilestones.js 的 getAvailableMilestone
// 只查这两个数（thresholds = [60, 30]），给别的阈值等于永远不会被解锁。
// text 必须是数组：CharacterPage.jsx 里是 viewingMilestone.text.map(...)，
// undefined 会直接抛错。空数组安全（只是领取后没内容可读）。
export const FALLBACK_MILESTONES = [
  { threshold: 30, title: "面善", brief: "他开始主动与你搭话", text: [] },
  { threshold: 60, title: "交心", brief: "他说起了从不与人提的事", text: [] },
];

export const FALLBACK_SPECIAL = { 根骨: 5, 悟性: 5, 体魄: 5, 魅力: 5, 智谋: 5, 身法: 5, 气运: 5 };

export const FALLBACK_LEVEL_CAP = 1;

// 七个招式原型。取值必须与 combat/moveArchetypes.js 的 MOVE_ARCHETYPES 键一致，
// 否则 resolveArchetype 查不到会返回 null、招式退化成空对象。
export const MOVE_ARCHETYPE_IDS = ["硬攻", "趁虚", "防守反击", "封穴", "致乱", "蓄势", "疗伤"];
export const MOVE_SLOTS = ["攻击", "防御", "状态", "回气"];
export const SLOT_DEFAULT_ARCHETYPE = { 攻击: "硬攻", 防御: "防守反击", 状态: "致乱", 回气: "回气", 疗伤: "疗伤" };

// 品阶 → 内外功基准，跟 npcGeneration.js 的 getTierPower 口径一致
export const TIER_NEIGONG = [5, 23, 41, 59, 77, 95];

/** 内外功清洗：0-100 整数，缺值按品阶基准补 */
export function sanitizeGongfu(raw, levelCap = 1) {
  const v = Number(raw);
  const base = TIER_NEIGONG[Math.max(0, Math.min(5, levelCap))] ?? 23;
  if (!Number.isFinite(v)) return base;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** 招式清洗：原型必须在册，槽位补齐四个，名字空则留空由 UI 兜底 */
export function sanitizeMoves(raw, levelCap = 1) {
  const out = {};
  for (const slot of MOVE_SLOTS) {
    const m = (raw && typeof raw === "object" && raw[slot]) || {};
    const wanted = String(m.archetype || SLOT_DEFAULT_ARCHETYPE[slot] || "");
    // 回气槽固定走「回气」原型，别的槽位若给了不在册的原型就退回该槽默认
    const arch = slot === "回气" ? "回气"
      : (MOVE_ARCHETYPE_IDS.includes(wanted) ? wanted : SLOT_DEFAULT_ARCHETYPE[slot]);
    out[slot] = {
      archetype: arch,
      name: String(m.name || "").slice(0, 10),
      desc: String(m.desc || "").slice(0, 60),
    };
  }
  // 疗伤是可选第五槽，只有 AI 明确给了才留
  const heal = raw && typeof raw === "object" && raw["疗伤"];
  if (heal && (heal.name || heal.archetype)) {
    out["疗伤"] = { archetype: "疗伤", name: String(heal.name || "").slice(0, 10), desc: String(heal.desc || "").slice(0, 60) };
  }
  return out;
}

/** 把 AI 的七维输出清洗成合法值：缺项补 5，越界钳到 0-10，非整数取整 */
export function sanitizeSpecial(raw) {
  const out = { ...FALLBACK_SPECIAL };
  if (!raw || typeof raw !== "object") return out;
  for (const k of Object.keys(FALLBACK_SPECIAL)) {
    const v = Number(raw[k]);
    if (Number.isFinite(v)) out[k] = Math.max(0, Math.min(10, Math.round(v)));
  }
  return out;
}

/** 品阶清洗：0-5 整数，非法值退到 1 档 */
export function sanitizeLevelCap(raw) {
  const v = Number(raw);
  if (!Number.isFinite(v)) return FALLBACK_LEVEL_CAP;
  return Math.max(0, Math.min(5, Math.round(v)));
}

/** 好感初值清洗：-20 ~ 20，非法退 0 */
export function sanitizeAffection(raw) {
  const v = Number(raw);
  if (!Number.isFinite(v)) return 0;
  return Math.max(-20, Math.min(20, Math.round(v)));
}

/** 里程碑清洗：阈值必须是那四档，缺的用兜底补齐 */
export function sanitizeMilestones(raw) {
  const byT = new Map();
  if (Array.isArray(raw)) {
    for (const m of raw) {
      const t = Number(m?.threshold);
      if (![30, 60].includes(t)) continue;   // 别的阈值永远不会被解锁，直接丢
      const title = String(m?.title || "").slice(0, 8);
      const brief = String(m?.brief || "").slice(0, 30);
      const text = Array.isArray(m?.text)
        ? m.text.map(x => String(x || "").trim()).filter(Boolean).slice(0, 4)
        : [];
      if (title) byT.set(t, { threshold: t, title, brief, text });
    }
  }
  return FALLBACK_MILESTONES.map(f => byT.get(f.threshold) || { ...f, text: [] });
}

/** brief 清洗：截 15 字，空则由调用方用 comment 兜底 */
export function sanitizeBrief(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim().slice(0, 15);
}

// 人设正文注入前的清洗上限。原生 preset.npcLore 里最长那条（梅朵）是 236 字，
// 所以 240 既容得下合规输出，也不至于让降级路径（AI 没出凝练版、只能拿原卡正文
// 顶上）把三千字整段灌进 prompt。
export const LORE_MAX = 240;

/**
 * 人设正文清洗。两条路都要过：
 *   AI 出的凝练版 —— 它多半已经干净，这里只做兜底（不听话时也不至于破坏格式）
 *   原卡正文顶上 —— AI 失败时的降级路径，这一步是刚需
 *
 * 【为什么必须压成单行】原生 npcLore 的格式是「首行 - 名字（身份）：正文」加
 * 若干条两格缩进的子行（外貌锚点／初见态度）。正文自己带换行会把这个结构冲散，
 * 说书人分不清一条到哪儿结束、下一条从哪儿开始。实测一张普通卡的正文里有六个
 * 换行加两级 markdown 标题，注入后整块结构全乱。
 *
 * 【为什么替换占位符而不是删掉】{{user}} 删掉会让句子缺主语（"替她挡了一句"
 * 变成"替她挡了一句"没了主语更糊）。换成玩家名，句子仍然通顺。
 */
export function sanitizeLore(raw, opts = {}) {
  const playerName = opts.playerName || "玩家";
  const charName = opts.charName || "此人";
  let t = String(raw || "");
  if (!t.trim()) return "";

  // 占位符。酒馆卡里这几种写法都常见，大小写不敏感
  t = t.replace(/\{\{\s*user\s*\}\}/gi, playerName)
       .replace(/<\s*user\s*>/gi, playerName)
       .replace(/\{\{\s*char\s*\}\}/gi, charName)
       .replace(/<\s*char\s*>/gi, charName);

  // 行首的 markdown 标题记号与方括号小标题。只剥行首——正文中间正常用到方括号
  // 的情况（引用书名、招式名）不该被动
  t = t.split(/\r?\n/)
       .map(line => line.replace(/^\s*#{1,6}\s*/, "").replace(/^\s*【[^】]{1,12}】\s*/, ""))
       .join(" ");

  // 压成单行
  t = t.replace(/\s+/g, " ").trim();
  return t.slice(0, LORE_MAX);
}
