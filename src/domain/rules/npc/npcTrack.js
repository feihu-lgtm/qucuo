// 无好感轨道判定（叶子纯函数，无依赖）——从 affection.js 抽离：
// 判官规则层（inspectContainer 等）直引本模块，避免经 affection→applyWrite→fields
// →innerMap→loadDefaultContent 拖入全量 content 形成 ESM 循环（FIELDS TDZ）。
export function hasNoAffectionTrack(npc) {
  // 口径与 commitRound 搭话跳过一致：intimacy.forbidden 或兽类。
  // 「不能说话」≠无好感轨道——哑人/人形缄默伙伴仍有情感关系。
  // 夜班双修 Review 修：beast 不一概无轨道——companionCandidate 命定同伴（村口雪豹
  // 人形化可亲密）门禁既放行，好感/心账就必须落得进；普通兽类（大公鸡/草甸野兽）
  // 仍无轨道。判官签发（handleIntimate）与落账（materializeFacts）共用本谓词保两端一致。
  if (npc?.intimacy?.forbidden) return true;
  if (npc?.beast && !npc?.companionCandidate) return true;
  return false;
}
