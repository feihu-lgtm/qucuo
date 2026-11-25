// ── steal 按表裁定（S4 纯搬家：原 judgeTurn.js steal 分支原样移入）──
// 检定 = 身法+智谋+rng()×6 对 警觉难度 4+修正；性情含 精明/多疑/阴鸷 +2，
// 在场人数每多一人（除目标外）+1。成功且目标身携有物签 TRANSFER_ITEM
// （npc→player 取其 carry 首件）；失败签 MUTATE_SOCIAL 怨 -6 并置生气标记。
import { findNpc } from "./shared.js";

export function handleSteal(J, action) {
  const { envelope, roll, facts, notes, nextFactId, talkOnly, npcs } = J;
  if (talkOnly) { notes.push(`纯搭话回合不结算steal`); return; }
  const target = findNpc(npcs, action.target);
  if (!target) { notes.push(`偷窃目标 ${action.target || "无名"} 不在场，不签发`); return; }
  const ch2 = envelope.char || {};
  const sp2 = ch2.special || {};
  const sneaky = /精明|多疑|阴鸷/.test(target.personality || "") ? 2 : 0;
  const crowd = Math.max(0, npcs.length - 1);
  const check = (sp2.身法 ?? 5) + (sp2.智谋 ?? 5) + roll() * 6;
  const difficulty = 4 + sneaky + crowd;
  if (check >= difficulty) {
    // 真实 room NPC 物件在 carriedItems（materializeFacts/roomNpcs/attireSync 同口径），
    // carry 仅作卡牌数据末位兼容；暂取数组首件（确定性起步，后续可按珍惜度/随机选）。
    const carried = Array.isArray(target.carriedItems) ? target.carriedItems : [];
    const carry = (carried.length ? carried : (Array.isArray(target.carry) ? target.carry : []))
      // 已易手/掉落/卖出的物件记录仍挂在 carriedItems 上——过滤后再选，
      // 否则首件被取走后后续偷窃永远选到死记录。
      .filter((it) => it && it.name && !it.taken && !it.dropped && !it.sold);
    if (carry.length) {
      const item = carry[0];
      facts.push({
        id: nextFactId(), op: "TRANSFER_ITEM",
        itemId: item.id || "", itemName: item.name,
        from: target.name, to: "player", witnesses: ["主角"],
      });
      notes.push(`偷窃得手：${target.name}的「${item.name}」（检定${check.toFixed(1)}≥${difficulty}）`);
    } else {
      notes.push(`${target.name}身无一物，偷窃无获`);
    }
  } else {
    facts.push({
      id: nextFactId(), op: "MUTATE_SOCIAL", npc: target.name,
      affectionDelta: -6, ledgerKind: "怨", reason: "偷窃败露",
      witnesses: ["主角", target.name],
      anger: { active: true, reason: "偷窃败露", turnsLeft: 3 },
    });
    notes.push(`偷窃败露：${target.name}结怨（检定${check.toFixed(1)}<${difficulty}）`);
  }
}
