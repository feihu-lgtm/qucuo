// ── learn 求教收拒裁决（S4 纯搬家：原 judgeTurn.js learn 分支原样移入）──
import { personaMod, affectionMod } from "./shared.js";

export function handleLearn(J, action, npc, aff, stanceMod) {
  const { envelope, roll, turn, day, place, budget, facts, warrants, notes, nextFactId, nextWarrantId } = J;
  // WO-16F-F4b 按钮求教「直签转写」：learnRequest 在场即 feature 门规/束脩已裁，
  // 不二次掷骰——否则会出现「按钮说愿教、判官掷成不肯」双裁决打架。
  // 自由文本 learn（无 learnRequest）维持下方裁量/天机券/降级口径不变。
  const lreq = action.learnRequest;
  if (lreq && typeof lreq === "object" && Array.isArray(lreq.freshSkills)) {
    // 防御性原子口径（返修）：正常按钮路径 feature 已验资，但信封银两不足时
    // 整批零 facts——不得出现技能照得但银两只扣部分的半落账。
    const moneyNow = Number(envelope.char?.money ?? 0);
    if (Number.isFinite(lreq.totalPrice) && lreq.totalPrice > 0 && moneyNow < lreq.totalPrice) {
      notes.push(`束脩不足，授业未成（需银${lreq.totalPrice}两，现有${moneyNow}两）`);
      return;
    }
    J.accept.value = true;
    facts.push({
      id: nextFactId(), op: "BESTOW_SKILL", npc: npc.name,
      // 直接携带 feature 确定的招式目录快照——不走天机券自由填名（绝学有固定招式表）
      skills: lreq.freshSkills.map((sk) => ({ ...sk })),
      detail: `倾囊相授「${lreq.moveBrief || "所学"}」`,
      witnesses: ["主角", npc.name],
    });
    if (Number.isFinite(lreq.totalPrice) && lreq.totalPrice > 0) {
      facts.push({
        id: nextFactId(), op: "CHANGE_VITALS_SILVER", moneyDelta: -lreq.totalPrice,
        detail: `束脩银${lreq.totalPrice}两`, witnesses: ["主角", npc.name],
      });
    }
    // 无好感轨道（兽类/intimacy.forbidden）不签好感——内联谓词与 give 分支同口径
    if (!(npc?.intimacy?.forbidden || npc?.beast)) {
      facts.push({
        id: nextFactId(), op: "MUTATE_SOCIAL", npc: npc.name,
        affectionDelta: lreq.isMaster ? 6 : 3,
        ledgerKind: "恩", reason: "授业传艺", witnesses: ["主角", npc.name],
      });
    }
    return;
  }
  const score = 0.3 + affectionMod(aff) + personaMod(npc.personality) + stanceMod;
  if (roll() < Math.max(0.05, Math.min(0.9, score))) {
    J.accept.value = true;
    if (budget.allowSkillBestow) {
      const factId = nextFactId();
      const warrantId = nextWarrantId();
      facts.push({ id: factId, op: "BESTOW_SKILL", npc: npc.name, witnesses: ["主角", npc.name] });
      warrants.push({
        warrantId, factId, op: "BESTOW_SKILL",
        pointBudget: budget.maxPointBudget, allowedAffixes: [],
        origin: { turn, day, place, fromNpc: npc.name },
      });
    } else {
      facts.push({
        id: nextFactId(), op: "PROGRESS_CULTIVATION", npc: npc.name,
        potDelta: 2, reason: "指点一二", witnesses: ["主角", npc.name],
      });
      notes.push(`因果 tier ${budget.tier} 不足授技，降为点拨`);
    }
  } else {
    notes.push(`${npc.name}不肯传授`);
    if (J.lastActionOutcome) { J.lastActionOutcome.rejected = true; J.lastActionOutcome.kind = "learn"; J.lastActionOutcome.target = npc.name; }
  }
}
