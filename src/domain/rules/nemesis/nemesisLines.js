// ── WO-23B 宿敌谱确定性文本行（纯函数，无 AI）─────────────────────────────
// 与 pactLines.js 同构、两处共用同一出处防漂移：
//  ① actCall ⑨号位「@江湖契约与宿敌」注入——只列在场且 active 的谱中人物；
//  ② 契约与宿敌面板 UI——按势力分组列全部（不限在场），含状态。
// 账本契约（与 WO-23A 名册底座对齐，协调者写死）：
//   varTree.世界.宿敌谱[faction].entries[entryId] =
//     {id,name,faction,tier,baseRole,epithet,tauntLine,rumorSnippet,scars,grudge,
//      status,firstTurn,lastTurn}；tier 1-4；scars 元素 {kind,note,turn}，
//      kind ∈ 利刃/钝击/火毒/寒冰/点穴。
// 绝不 AI 自证：行内容全部来自账本；AI 起号/假死/日结争位/收服/伤痕战斗效果
// 全部不在本单（后续工单）——本模块只是确定性展示层。

export const NEMESIS_INJECT_CAP = 3;
const VALID_KINDS = new Set(["利刃", "钝击", "火毒", "寒冰", "点穴"]);

// 全部谱中人物摊平成 [{faction, entryKey, ...entry}]——UI 与注入共用。
// 旧档/坏形状兼容：无宿敌谱、entries 非对象、缺 id/name 的非法条目一律丢弃不炸。
export function flattenNemeses(varTree) {
  const book = varTree?.世界?.宿敌谱;
  if (!book || typeof book !== "object") return [];
  const out = [];
  for (const [faction, group] of Object.entries(book)) {
    const entries = group?.entries;
    if (!entries || typeof entries !== "object") continue;
    for (const [entryKey, entry] of Object.entries(entries)) {
      if (!entry || typeof entry !== "object" || !entry.name || !entry.id) continue;
      out.push({
        entryKey,
        ...entry,
        faction: typeof entry.faction === "string" && entry.faction ? entry.faction : faction,
        tier: Number.isFinite(entry.tier) ? entry.tier : 1,
        grudge: Number.isFinite(entry.grudge) ? entry.grudge : 0,
        status: typeof entry.status === "string" && entry.status ? entry.status : "active",
        scars: Array.isArray(entry.scars)
          ? entry.scars.filter((s) => s && typeof s === "object" && VALID_KINDS.has(s.kind))
          : [],
        // 结仇原委（复审契约补）：{turn,place,summary}，无 origin/坏形状兼容为 null 不炸
        origin: entry.origin && typeof entry.origin === "object" && entry.origin.summary
          ? { turn: entry.origin.turn ?? null, place: entry.origin.place || "", summary: String(entry.origin.summary) }
          : null,
      });
    }
  }
  return out;
}

// 结仇强度行：grudge 0 不提；1-2 小有嫌隙 / 3-4 结怨已深 / >=5 不共戴天。
// 阈值是展示层起步口径（手册未定），只在 UI/注入展示，绝不反哺结算。
export function nemesisGrudgeLine(grudge) {
  if (!Number.isFinite(grudge) || grudge <= 0) return "";
  if (grudge >= 5) return "不共戴天";
  if (grudge >= 3) return "结怨已深";
  return "小有嫌隙";
}

// 状态行：active 空串（默认态不占字数）；其余状态原样标注。
// fakeDead/settled/captured 等状态值由后续工单写账，本层只如实展示。
export function nemesisStatusLine(entry) {
  const status = entry?.status;
  if (!status || status === "active") return "";
  // 复审裁决：fakeDead 对玩家只显示「已故」——面板直写「假死」会把后续假死重逢
  // 的包袱提前泄给玩家；账本里 fakeDead 真实态不动，这只是展示层口径。
  const label = { fakeDead: "已故", settled: "已了结", captured: "被擒", recruited: "已收服" }[status] || status;
  return `（${label}）`;
}

// 一行谱中人物的注入/展示文本（不含名字前缀——调用方按需拼）。
function nemesisLineText(entry) {
  const epithet = String(entry.epithet || "").trim() || "尚无绰号";
  const scars = (entry.scars || []).slice(-2).map((s) => `${s.kind}伤${s.note ? `（${String(s.note).slice(0, 12)}）` : ""}`);
  const grudgeLine = nemesisGrudgeLine(entry.grudge);
  const originLine = entry.origin?.summary ? `结仇原委：${String(entry.origin.summary).slice(0, 18)}` : "";
  return [
    `${entry.faction}·第${entry.tier}阶`,
    epithet,
    ...(scars.length ? [`旧伤：${scars.join("、")}`] : []),
    ...(grudgeLine ? [grudgeLine] : []),
    ...(originLine ? [originLine] : []),
  ].join("，");
}

// ⑨号位注入块：只在场且 active 的谱中人物，最多 NEMESIS_INJECT_CAP 条，超出截断注人数。
// 无谱中人物返回空串，prompt 形状零污染。fakeDead/settled 等非 active 绝不入注入。
export function buildNemesisInjectBlock(varTree, presentNpcNames) {
  const present = new Set((presentNpcNames || []).filter(Boolean));
  if (!present.size) return "";
  const rows = flattenNemeses(varTree)
    .filter((e) => present.has(e.name) && e.status === "active")
    .sort((a, b) => (b.grudge - a.grudge) || ((a.firstTurn || 0) - (b.firstTurn || 0)));
  if (!rows.length) return "";
  const shown = rows.slice(0, NEMESIS_INJECT_CAP);
  const more = rows.length - shown.length;
  const lines = shown.map((e) => `${e.name}：${nemesisLineText(e)}`);
  if (more > 0) lines.push(`……另有 ${more} 名宿敌在场，未列。`);
  return `@宿敌谱（在场者中有与你结仇之人，只作背景，不替任何人表态）\n${lines.join("\n")}`;
}
