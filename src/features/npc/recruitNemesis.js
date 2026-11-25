// WO-23C4 宿敌收服最小 deterministic 闭环（不接 AI、不做追杀令后续战斗）
// ------------------------------------------------------------------
// 结果全部 deterministic：
// · 宿敌谱 entry status → "recruited"（注入层只认 active，自动退场；
//   UI nemesisStatusLine 显示「已收服」）；
// · companionState 复用 unlockImportedCompanion 转入——绝不起平行同伴系统；
// · 原势力声誉接既有轨道 varTree.世界.势力声誉 deterministic 扣减（RECRUIT_REP_PENALTY=-10），
//   另记 deterministic「追杀令」账（varTree.世界.追杀令）；
// · 当前房间若有同名世界版 NPC 一并移除（按名字唯一惯例），池子/驻场注入侧由
//   residentNpcRule 按 recruited 过滤防隔天刷回；
// · 幂等：已 recruited 直接拒、companion 解锁天然幂等、追杀令按 entryId dedupe。
import { nemesisRecruitEligibility, appendHuntedOrder } from "../../domain/rules/nemesis/recruitCheck.js";
import { unlockImportedCompanion } from "../../domain/rules/companion/companion.js";
import { applyFactionRep } from "../../domain/rules/economy/factionRep.js";
import { removeNpc } from "../../domain/rules/npc/roomNpcs.js";

export const RECRUIT_REP_PENALTY = -10;

export function recruitNemesis(state, ref = {}) {
  const { faction, entryId } = ref;
  const group = state.varTree?.世界?.宿敌谱?.[faction];
  const entry = group?.entries?.[entryId];
  if (!entry) return { logs: [{ t: "err", text: "  谱中查无此人。" }] };
  // 幂等：重复点击/重复结算不重复扣账、不重复加 companion、不重复记追杀令
  if (entry.status === "recruited") return { logs: [{ t: "sys", text: `  ${entry.name}早已弃暗投明，在你麾下。` }] };
  const elig = nemesisRecruitEligibility(state.varTree, entry);
  if (!elig.ok) {
    const why = {
      not_active: "此人事已了，谈不上收服。",
      tier_too_high: `${entry.name}在${faction}位阶太高，招抚不动。`,
      no_ledger: `你与${entry.name}无恩义往来，空口招抚无用。`,
      grudge_not_outweighed: `${entry.name}怨大于恩，不肯听你招抚。`,
    }[elig.reason] || `${entry.name}不肯听你招抚。`;
    return { logs: [{ t: "sys", text: `  ${why}` }] };
  }
  const turn = state.time || 0;
  return {
    changes: {
      // 复用现有 imported companion 机制转入——levelCap 以 tier 近似，brief 写明来路
      companionState: (prev) => unlockImportedCompanion(prev || {}, {
        name: entry.name,
        levelCap: Math.max(1, Math.min(4, Number(entry.tier) || 1)),
        brief: `${faction}出身的${entry.baseRole || "江湖人"}，受你招抚弃暗投明`,
      }),
      varTree: (prev) => {
        const book = prev?.世界?.宿敌谱 || {};
        const grp = book[faction];
        const target = grp?.entries?.[entryId];
        if (!target || target.status !== "active") return prev; // 写入前再核，状态已变不动账（声誉/追杀令也不重复扣记）
        const orders = appendHuntedOrder(prev?.世界?.追杀令, {
          faction, entryId, name: entry.name, turn,
          note: `${entry.name}背${faction}投敌，悬令追杀`,
        });
        // 原势力声誉 deterministic 扣减（接既有 applyFactionRep 轨道）——
        // 与状态翻转同窗：只有真从 active 转 recruited 才扣，幂等天然成立。
        const withRep = applyFactionRep(prev, { [faction]: RECRUIT_REP_PENALTY }, { step: Infinity, ripple: false });
        return {
          ...(withRep || {}),
          世界: {
            ...(withRep?.世界 || {}),
            追杀令: orders,
            宿敌谱: {
              ...book,
              [faction]: {
                ...grp,
                entries: {
                  ...(grp.entries || {}),
                  [entryId]: { ...target, status: "recruited" },
                },
              },
            },
          },
        };
      },
      // 当前房间同名世界版 NPC 一并撤下——不撤会分身（世界版+companion 同屏）。
      room: (prev) => ({
        ...prev,
        npcs: removeNpc(prev?.npcs, (n) => n?.name === entry.name),
      }),
    },
    logs: [
      { t: "sys", text: `  ${entry.name}沉默良久，终是长叹一声，愿听你差遣。` },
      { t: "sys", text: `  ${faction}已悬下追杀令，视${entry.name}为叛徒。` },
    ],
  };
}
