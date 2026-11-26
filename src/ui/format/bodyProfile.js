// 体貌档案的展示文本（遮罩、预览）。只给界面用，从 domain/rules/character/bodyProfile.js 搬来（路线图 U4-2）。

export function maskText(text) {
  const s = String(text || "").trim();
  return s ? "•".repeat(Math.min(12, Math.max(4, Math.ceil(s.length / 2)))) : "";
}

// 面板里的折叠预览：不完整显示，只露前 n 个字，剩下的用 … 收掉。
// 私密层默认整条打码，要点一下才展开——这个面板是会在别人面前打开的。
export function previewText(text, n = 14) {
  const s = String(text || "").trim();
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}
