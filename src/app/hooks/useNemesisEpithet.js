// WO-23C1 宿敌赐号接线（系统定何时赐，AI 只起名）
// ------------------------------------------------------------------
// 硬边界：
// · 触发只在 duel 结算后——diff 宿敌谱前后快照，首次入谱/tier 晋升且 epithet 空
//   的 active entry 排一次 nemesis.epithet 调用；同一 entry 只赐一次。
// · 无 AI/失败/校验不过全部静默——entry.epithet 保留 null，绝不阻塞结算。
// · 写入只补 epithet/tauntLine/rumorSnippet 三字段；落笔前再核：entry 仍 active、
//   epithet 仍空、epoch 未 stale（读档/换档绝不写旧档）。
import { useCallback, useRef } from "react";
import { featureCtx } from "../runtime/gameRuntime.js";
import { gameStore, getGameEpoch, isGameEpochStale } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { withAI } from "../../engine/ports/withAI.js";
import { createWebAi } from "../../engine/ports/ai.js";
import { findEpithetCandidates, validateEpithetOutput, collectEpithets, buildEpithetWriteChanges } from "../../domain/rules/nemesis/epithetCheck.js";
import "../../domain/rules/prompt/calls/nemesisCalls.js";

const webAi = createWebAi();



export function useNemesisEpithet({ apiCfg }) {
  const inflight = useRef(new Set());

  // beforeRoster/afterRoster：duel 结算前后 varTree.世界.宿敌谱 快照。
  // fire-and-forget——绝不 await，绝不阻塞结算链路。
  const maybeGrantEpithets = useCallback((beforeRoster, afterRoster) => {
    let candidates = [];
    try {
      candidates = findEpithetCandidates(beforeRoster, afterRoster);
    } catch {
      return;
    }
    for (const cand of candidates.slice(0, 2)) { // 一场最多赐两人，防批量刷屏
      const key = cand.entryId;
      if (inflight.current.has(key)) continue;
      inflight.current.add(key);
      void (async () => {
        const epoch = getGameEpoch();
        const isStale = () => isGameEpochStale(epoch);
        try {
          const state = gameStore.getState();
          const playerName = state.char?.name || "";
          const existingEpithets = collectEpithets(afterRoster, cand.entryId);
          // 最多一次重试：首次产出不合格才允许 deterministic 再问一遍，绝不循环。
          let valid = null;
          for (let attempt = 0; attempt < 2 && !valid; attempt += 1) {
            const { ok, data } = await withAI("nemesis.epithet", {
              state,
              nemesis: cand.entry,
              preset: state.preset,
            }, { ai: webAi, apiCfg, isStale });
            if (!ok) break;
            const verdict = validateEpithetOutput(data, { playerName, existingEpithets });
            if (verdict.ok) valid = verdict;
          }
          if (!valid || isStale()) return;
          // 落笔前最后核验：读档/换档/他人先赐/状态翻非 active 一律不写。
          const latest = gameStore.getState();
          const cur = latest.varTree?.世界?.宿敌谱?.[cand.faction]?.entries?.[cand.entryId];
          if (!cur || cur.status !== "active" || String(cur.epithet || "").trim()) return;
          applyResult(featureCtx(), {
            changes: {
              varTree: buildEpithetWriteChanges(cand.faction, cand.entryId, valid),
            },
          }, { feature: "nemesis.epithet", background: true });
        } catch { /* 无 API/异常静默——epithet 保留 null */ } finally {
          inflight.current.delete(key);
        }
      })().catch(() => { inflight.current.delete(key); });
    }
  }, [apiCfg]);

  return { maybeGrantEpithets };
}
