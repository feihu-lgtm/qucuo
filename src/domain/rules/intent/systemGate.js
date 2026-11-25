// 系统闸门：按顺序在模拟状态上逐步校验原子行动（钱够不够、人在不在、东西有没有），
// 第 2 步看到的是第 1 步结算后的状态。遇到第一个不通过的步骤就停下并给出原因，
// 之前已通过的步骤照常执行，之后的步骤一律跳过。
import { ACTION_KINDS, NONE, SILVER, inventoryCounts, itemNameOf, visibleNpcs } from "./actionKinds.js";
import { CONDITION_ON } from "./conditions.js";
import { tryLearnFromMaster } from "../kungfu/learnSkill.js";
import { isNpcAngry } from "../combat/stealSystem.js";

const NEEDS_TARGET = new Set([
  ACTION_KINDS.GIFT, ACTION_KINDS.BUY, ACTION_KINDS.DUEL, ACTION_KINDS.LEARN,
  ACTION_KINDS.INVITE, ACTION_KINDS.STEAL, ACTION_KINDS.APPEASE,
]);

function simulate(state) {
  return {
    money: Number(state?.char?.money) || 0,
    inv: inventoryCounts(state),
    npcs: new Set(visibleNpcs(state).map((npc) => npc.name)),
    npcByName: new Map(visibleNpcs(state).map((npc) => [npc.name, npc])),
    state,
  };
}

// 拜师与按钮同一套门槛：生气不教、好感不够/无招可学不教、束脩不够不教；束脩计入模拟银两。
function learnPrice(sim, action) {
  const npc = sim.npcByName.get(action.target);
  const { varTree = {}, skills = [], char = {} } = sim.state || {};
  if (isNpcAngry(varTree, npc.name)) return { reason: `${npc.name}正在气头上，不肯传授` };
  const decision = tryLearnFromMaster(npc, varTree, skills, { ...char, money: sim.money });
  if (!decision.ok) return { reason: decision.reason.replace(/[。！]$/, "") };
  if (decision.totalPrice > sim.money) return { reason: `束脩需银${decision.totalPrice}两（身上只有${sim.money}两）` };
  return { price: decision.totalPrice };
}

function checkStep(sim, action) {
  if (NEEDS_TARGET.has(action.kind)) {
    if (!action.target || action.target === NONE) return "没说清是对谁";
    if (!sim.npcs) return `走动之后还不知道${action.target}在不在`;
    if (!sim.npcs.has(action.target)) return `${action.target}不在此处`;
  }
  if (action.kind === ACTION_KINDS.GIFT || action.kind === ACTION_KINDS.USE_ITEM) {
    if (!action.item || action.item === NONE) return "没说清是哪件东西";
    if (action.item === SILVER) {
      if (action.kind !== ACTION_KINDS.GIFT) return "银两不能这样用";
      if (!action.amount) return "没说清给多少银两";
      if (action.amount > sim.money) return `银两不够（身上只有${sim.money}两）`;
    } else if (!(sim.inv.get(action.item) > 0)) {
      return `背包里没有${action.item}`;
    }
  }
  if (action.kind === ACTION_KINDS.MOVE && (!action.direction || action.direction === NONE)) return "没说清往哪走";
  if (action.kind === ACTION_KINDS.APPEASE) {
    if (!isNpcAngry(sim.state?.varTree, action.target)) return `${action.target}并没有在生气`;
  }
  if (action.kind === ACTION_KINDS.PICKUP) {
    if (!action.item || action.item === NONE) return "没说清捡什么";
    // 同名地上物可以连捡，按已捡次数递减；捡光才算没有。
    const groundCount = (sim.state?.room?.items || []).map(itemNameOf).filter((n) => n === action.item).length;
    if (groundCount <= (sim.picked?.get(action.item) || 0)) return `地上没有${action.item}`;
  }
  if (action.kind === ACTION_KINDS.EQUIP) {
    if (!action.item || action.item === NONE) return "没说清是哪件装备";
    if (!(sim.inv.get(action.item) > 0)) return `背包里没有${action.item}`;
  }
  if (action.kind === ACTION_KINDS.LEARN && sim.npcs) return learnPrice(sim, action).reason || null;
  return null;
}

function applyStep(sim, action) {
  if (action.kind === ACTION_KINDS.GIFT && action.item === SILVER) sim.money -= action.amount;
  else if (action.kind === ACTION_KINDS.GIFT || action.kind === ACTION_KINDS.USE_ITEM) sim.inv.set(action.item, sim.inv.get(action.item) - 1);
  if (action.kind === ACTION_KINDS.PICKUP) {
    // 捡起来的东西进模拟背包，后续步骤（如接着装备）才认得它；计数防把同一件捡两回。
    (sim.picked ??= new Map()).set(action.item, (sim.picked.get(action.item) || 0) + 1);
    sim.inv.set(action.item, (sim.inv.get(action.item) || 0) + 1);
  }
  if (action.kind === ACTION_KINDS.LEARN) sim.money -= learnPrice(sim, action).price || 0;
  if (action.kind === ACTION_KINDS.MOVE) sim.npcs = null;
}

export function validatePlan(state, actions) {
  const sim = simulate(state);
  const valid = [];
  const triggers = [];
  const freeSteps = [];
  for (let index = 0; index < (actions || []).length; index++) {
    const action = { ...actions[index], index };
    // 自由回落段不进闸门；条件步不立即执行，记为待定触发（触发时再走原有校验）。
    if (action.free) { freeSteps.push(action); continue; }
    if (action.condition) { triggers.push(action); continue; }
    const reason = checkStep(sim, action);
    if (reason) {
      const rest = actions.slice(index + 1).map((a, i) => ({ ...a, index: index + 1 + i }));
      // 前一步被拒会拦住后面所有步；唯一例外是前提正好为「被拒」的条件步，此刻立即触发。
      const refused = rest.find((a) => a.condition?.on === CONDITION_ON.REFUSED) || null;
      return {
        valid,
        rejected: { ...action, reason },
        skipped: refused ? rest.filter((a) => a.index !== refused.index) : rest,
        triggers,
        freeSteps,
        refused,
      };
    }
    applyStep(sim, action);
    valid.push(action);
  }
  return { valid, rejected: null, skipped: [], triggers, freeSteps, refused: null };
}

