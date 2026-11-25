// ── WO-22B-P4a→P4b 江湖契约确定性文本行（纯函数，无 AI）─────────────────────
// 两处共用同一出处，防漂移：
//  ① actCall ⑨号位「@江湖契约与宿敌」注入——只列当前在场 NPC 的未了契约；
//  ② 契约面板 UI——列全部契约（不限在场），含状态。
// 时间口径：time 单位格、1 格=1 小时、1 时辰=2 格；deadline=bindTurn+deadlineHours。
// 绝不 AI 自证：行内容全部来自 varTree.世界.契约 账本，模型/玩家原话不进字符串。

export const PACT_INJECT_CAP = 3;

// 单条契约状态：未了 open / 已了 settled / 违约 breached（breachTurn 优先于 settled
// 不会出现——违约后 P3 不得再履约；若两标记都在，违约口径优先展示）。
export function pactStatusOf(pact) {
  if (pact?.breachTurn != null) return "breached";
  if (pact?.settled) return "settled";
  return "open";
}

// 期限行：剩余/逾期时辰。无期限（deadlineHours 空）返回空串。
export function pactDeadlineLine(pact, now) {
  if (!Number.isFinite(pact?.deadlineHours) || !Number.isFinite(pact?.bindTurn) || !Number.isFinite(now)) return "";
  const remaining = pact.bindTurn + pact.deadlineHours - now; // 格=小时
  const shichen = Math.max(1, Math.round(Math.abs(remaining) / 2));
  return remaining >= 0 ? `余 ${shichen} 个时辰` : `已逾 ${shichen} 个时辰`;
}

// 全部契约摊平成 [{npcName, pactKey, ...pact, status}]——UI 与注入共用。
// 旧档兼容：无 place/deadlineHours 字段不炸；非法条目丢弃。
export function flattenPacts(varTree) {
  const book = varTree?.世界?.契约;
  if (!book || typeof book !== "object") return [];
  const out = [];
  for (const [npcName, byKey] of Object.entries(book)) {
    if (!byKey || typeof byKey !== "object") continue;
    for (const [pactKey, pact] of Object.entries(byKey)) {
      if (!pact || typeof pact !== "object" || !pact.promise) continue;
      out.push({ npcName, pactKey, ...pact, status: pactStatusOf(pact) });
    }
  }
  return out;
}

// 一行契约的注入文本（不含 NPC 名前缀——由调用方按需拼）。
function pactLineText(pact, now) {
  const deadline = pactDeadlineLine(pact, now);
  const reward = String(pact.rewardHint || "").trim();
  return `「${pact.promise}」${deadline ? `（${deadline}）` : ""}${reward ? `，允诺酬谢：${reward}` : ""}${pact.status === "breached" ? "，已违约" : ""}`;
}

// ⑨号位注入块：只在场 NPC 的未了契约（open/breached 都算未了——已了不提），
// 最多 PACT_INJECT_CAP 条，超出截断注人数。无契约返回空串，prompt 形状零污染。
export function buildPactInjectBlock(varTree, presentNpcNames, now) {
  const present = new Set((presentNpcNames || []).filter(Boolean));
  if (!present.size) return "";
  const rows = flattenPacts(varTree)
    .filter((p) => present.has(p.npcName) && p.status !== "settled")
    .sort((a, b) => (a.bindTurn || 0) - (b.bindTurn || 0));
  if (!rows.length) return "";
  const shown = rows.slice(0, PACT_INJECT_CAP);
  const more = rows.length - shown.length;
  const lines = shown.map((p) => `${p.npcName}：${pactLineText(p, now)}`);
  if (more > 0) lines.push(`……另有 ${more} 桩未了之约，未列。`);
  return `@江湖契约（在场者与你未了之约，只作背景，不替任何人表态）\n${lines.join("\n")}`;
}
