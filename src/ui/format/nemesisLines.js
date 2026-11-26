// 宿敌状态的展示文本。只给界面用，从 domain/rules/nemesis/nemesisLines.js 搬来（路线图 U4-2）。

// 状态行：active 空串（默认态不占字数）；其余状态原样标注。
// fakeDead/settled/captured 等状态值由后续工单写账，本层只如实展示。
export function nemesisStatusLine(entry) {
  const status = entry?.status;
  if (!status || status === "active") return "";
  // 复审裁决：fakeDead 对玩家只显示「已故」——面板直写「假死」会把后续假死重逢
  // 的包袱提前泄给玩家；账本里 fakeDead 真实态不动，这只是展示层口径。
  const label = { fakeDead: "已故", dead: "已故", settled: "已了结", captured: "被擒", recruited: "已收服" }[status] || status;
  return `（${label}）`;
}
