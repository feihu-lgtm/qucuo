import { markNpcAsKnown } from "../../domain/npc/npcAwareness.js";
import { recordAngerAttempt } from "../../domain/combat/stealSystem.js";

export function recordNpcAttempt(varTree, npcName, attempt) {
  const known = markNpcAsKnown(varTree || {}, npcName);
  const attrs = known.角色?.[npcName] || {};
  const anger = recordAngerAttempt(attrs.生气状态, attempt);
  if (anger === attrs.生气状态) return known;
  return {
    ...known,
    角色: { ...known.角色, [npcName]: { ...attrs, 生气状态: anger } },
  };
}

export function recordInitialStealAttempt(angryState, now) {
  return recordAngerAttempt(angryState, { kind: "steal", detail: "偷窃未遂", time: now });
}

const ACTIONS = {
  trade: { command: "交易", settle: "想与他交易" },
  learn: { command: "求教", settle: "想向他求教武艺" },
  steal: { command: "偷窃", settle: "想对他下手偷窃" },
  invite: { command: "邀同行", settle: "想邀他同行" },
};

export function appeaseAngryNpc(state, npc, { kind, detail = "", now = Date.now() } = {}) {
  const action = ACTIONS[kind];
  return {
    changes: {
      varTree: (prev) => recordNpcAttempt(prev, npc.name, { kind, detail, time: now }),
    },
    logs: [{ t: "cmd", text: `> ${action.command} ${npc.name}` }],
    settle: `趁${npc.name}气头上${action.settle}，借机赔罪缓和`,
    settleOptions: { settleNpc: npc.name, settleKind: "appease" },
  };
}
