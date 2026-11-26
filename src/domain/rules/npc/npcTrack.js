// 无好感轨道判定（叶子纯函数，无依赖）——从 affection.js 抽离：
// 判官规则层（inspectContainer 等）直引本模块，避免经 affection→applyWrite→fields
// →innerMap→loadDefaultContent 拖入全量 content 形成 ESM 循环（FIELDS TDZ）。
export function hasNoAffectionTrack(npc) {
  // 口径与 commitRound 搭话跳过一致：intimacy.forbidden 或兽类。
  // 「不能说话」≠无好感轨道——哑人/人形缄默伙伴仍有情感关系。
  return !!(npc?.intimacy?.forbidden || npc?.beast);
}
