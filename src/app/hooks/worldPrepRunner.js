// WO-24C world.prep 后台备料控制器（依赖注入纯逻辑，React 薄壳在 useWorldPrep）
// 全部外部接触面（取状态/调 AI/落账/计时/epoch）经参数注入——测试可复现，
// 也是 stale/epoch 纪律能钉死的原因：没有任何隐式全局时序。
import { decidePrep } from "../../engine/turn/prepScheduler.js";
import { prepStateVersion, upsertPrepSeeds } from "../../domain/rules/prep/prepSeeds.js";
import { buildPrepSeedsFromOutput } from "../../domain/rules/prep/prepIngest.js";
import { buildWorldPrepInput } from "../../domain/rules/prompt/calls/prepCalls.js";
import { prepEligibleContainerNames, resolveContainerContext } from "../../domain/rules/world/containers.js";
import { getInnerRoom } from "../../domain/rules/map/innerMap.js";

export const READING_IDLE_MS = 8000;

export function unlootedContainerNames(state) {
  const { containerView } = resolveContainerContext({
    districtName: state?.room?.name,
    innerRoomName: state?.innerRoomName ?? null,
    varTree: state?.varTree,
    roomDefLookup: getInnerRoom,
  });
  // #523/#524 Review 裁决：scripted（有预设物）容器首翻必中预设+即坍缩，
  // 备料永不兑现——候选口径与 prompt/ingest 同源（prepEligibleContainerNames）。
  return prepEligibleContainerNames(containerView);
}

// createWorldPrepRunner({
//   getState, callAI({prepInput, state, isStale}) → Promise<{ok,data}>,
//   applySeeds(seeds), getEpoch, isEpochStale, setTimeoutFn, clearTimeoutFn,
// })
// → { maybePrep(trigger), dispose() }
export function createWorldPrepRunner({
  getState, callAI, applySeeds, getEpoch, isEpochStale,
  setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout,
}) {
  let inflight = false;
  let readingTimer = null;

  function fire(trigger) {
    if (inflight) return false; // 并发礼让：同时最多 1 个 inflight
    const state = getState();
    let decision;
    try {
      decision = decidePrep({ trigger, state, seeds: state?.prepSeeds });
    } catch {
      return false;
    }
    if (!decision.shouldPrep) return false;
    inflight = true;
    void (async () => {
      const epoch = getEpoch();
      const isStale = () => isEpochStale(epoch);
      try {
        // 第一跳：发起前版本 A + 白名单快照（同版本即同名单）
        const versionA = prepStateVersion(state);
        const whitelist = {
          presentNpcNames: (state.room?.npcs || []).map((n) => n?.name).filter(Boolean),
          unlootedContainers: unlootedContainerNames(state),
        };
        const prepInput = buildWorldPrepInput(state);
        const { ok, data } = await callAI({ prepInput, state, isStale });
        if (!ok || !data || isStale()) return;
        // 第二跳：返回后以最新 state 重算版本，不一致直接废弃
        const latest = getState();
        if (prepStateVersion(latest) !== versionA) return;
        if (isStale()) return;
        const seeds = buildPrepSeedsFromOutput(data, {
          ...whitelist,
          location: state.room?.name || "",
          stateVersion: versionA,
          turn: state.time,
        });
        if (!seeds.length) return; // 非法输出零落账
        // 入库：upsert 内部按最新 state 再校验一轮（版本/地点/幂等替换）
        applySeeds(seeds.reduce(
          (acc, seed) => upsertPrepSeeds(acc, seed, getState()),
          getState().prepSeeds,
        ));
      } catch { /* 无 API/异常静默——备料本就是锦上添花 */ } finally {
        inflight = false;
      }
    })().catch(() => { inflight = false; });
    return true;
  }

  // 四处触发入口（lodging/meditate/travel/reading）：
  // reading 走 8 秒空档——计时到点时地点/stateVersion 双钉未变才真发；
  // 重复阅读重置计时；换地/世界变了取消。其余三个成功后即发。
  function maybePrep(trigger) {
    if (trigger !== "reading") return fire(trigger);
    const state = getState();
    const placeKey = `${state?.room?.name || ""}|${state?.innerRoomName || ""}`;
    const version = prepStateVersion(state);
    if (readingTimer) clearTimeoutFn(readingTimer);
    readingTimer = setTimeoutFn(() => {
      readingTimer = null;
      const now = getState();
      if (`${now?.room?.name || ""}|${now?.innerRoomName || ""}` !== placeKey) return;
      if (prepStateVersion(now) !== version) return;
      fire("reading");
    }, READING_IDLE_MS);
    return true;
  }

  function dispose() {
    if (readingTimer) clearTimeoutFn(readingTimer);
    readingTimer = null;
  }

  return { maybePrep, dispose };
}
