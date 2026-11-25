// ── WO-16C 移动拾取条件券（S4 纯搬家：原 judgeTurn.js 移动拾取段原样移入）──
// rollMovementEvents 系统掷中的路遇拾取，只签空白条件券（quality/category 系统硬账
// 锁进 warrant，模型碰不到）——不进 facts。双证据齐备才落账：正文落实处埋 ⟦Fid⟧
// 锚点 + 尾章 fill 可编译；叙事此刻不宜捡（被盯着/险境）就不埋锚不填空，券自然作废
// 零落账——拒捡权归叙事、数值权归系统，与器物天机券同口径。迁移期 pointBudget=0/无词条，
// 保持旧移动拾取本无词条的行为；预算整合归后续工单。
export function processMovePickup(J) {
  const { envelope, turn, day, place, warrants, notes, nextFactId, nextWarrantId, talkOnly } = J;
  if (talkOnly || !envelope.pickupJudgment) return;
  const j = envelope.pickupJudgment;
  const factId = nextFactId();
  const warrantId = nextWarrantId();
  warrants.push({
    warrantId, factId, op: "GRANT_ITEM", conditional: true,
    category: j.category || "misc", quality: j.quality || "白",
    pointBudget: 0, allowedAffixes: [],
    origin: { turn, day, place, fromNpc: "" },
  });
  notes.push(`路遇拾取条件券 ${warrantId}：品质「${j.quality}」类别「${j.category}」系统锁定，正文埋锚+尾章填空双证据齐备才落账`);
}
