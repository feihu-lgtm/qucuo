// WO-23D2 器物铭文 orchestration：系统定可否/升品，AI 只写文案。
// async stale/epoch guard：每次 await 后核 epoch，跨档/迟到一律不写。
import { useCallback } from "react";
import { createWebAi, cleanJsonString } from "../../engine/ports/ai.js";
import { withAI } from "../../engine/ports/withAI.js";
import { gameStore, getGameEpoch, isGameEpochStale } from "../../store/gameStore.js";
import { applyResult } from "../../features/run.js";
import { featureCtx } from "../runtime/gameRuntime.js";
import { validateInscription, planInscriptionUpgrade } from "../../domain/rules/items/inscribe.js";
import { awakenableWeapons } from "../../domain/rules/items/itemAwaken.js";
import { getAllProseChunks } from "../../engine/ports/recallBlock.js";
import { apiModelField, getApiModel } from "../../content/apiModel.js";
import "../calls/hookCalls.js";
import "../../domain/rules/prompt/calls/domainCalls.js";

const webAi = createWebAi();

function inscribeModelCfg(apiCfg) {
  const model = apiCfg.extractionModels?.INSCRIPTION || apiCfg.extractionModel || getApiModel(apiCfg);
  return { ...apiCfg, [apiModelField(apiCfg)]: model, thinkingMode: "off", maxTokens: 800 };
}

function parseInscription(res) {
  if (typeof res?.data?.inscription === "string") return res.data.inscription;
  let js = (res?.text || "").replace(/```json\s*|```\s*/g, "").trim();
  const i0 = js.indexOf("{"), i1 = js.lastIndexOf("}");
  if (i0 >= 0 && i1 > i0) js = js.slice(i0, i1 + 1);
  try { return JSON.parse(cleanJsonString(js))?.inscription || ""; } catch { return ""; }
}

// 来历原文精确取：prose 段落库里含器物名的最早一段（取不到传空，
// prompt 侧已钉死「无来历不得编造」）。
async function originTextFor(itemName) {
  try {
    const chunks = await getAllProseChunks();
    const hit = (chunks || [])
      .filter((c) => typeof c?.rawText === "string" && itemName && c.rawText.includes(itemName))
      .sort((a, b) => (a.turn - b.turn) || ((a.seq || 0) - (b.seq || 0)))[0];
    return hit ? hit.rawText.slice(0, 120) : "";
  } catch { return ""; }
}

export function useInscribeWeapon({ apiCfg, addLog }) {
  return useCallback(async (item) => {
    if (!item?.id) return;
    const epoch = getGameEpoch();
    const stale = () => isGameEpochStale(epoch);
    const state0 = gameStore.getState();
    // 系统闸：入口之外再复核——非 ready/已觉醒/不在背包直接拒，AI 一票没有。
    if (!awakenableWeapons(state0).some((w) => w.id === item.id)) {
      addLog([{ t: "sys", text: "  这件兵器还未到觉醒的时候。" }]);
      return;
    }
    const ledgerEntry = state0.varTree?.世界?.器物谱?.[item.id] || {};
    const originText = await originTextFor(item.name);
    if (stale()) return;
    const payload = {
      name: item.name, category: item.category,
      wins: ledgerEntry.wins || 0, nemesisKills: ledgerEntry.nemesisKills || 0,
      originText, inscribeCfg: inscribeModelCfg(apiCfg),
    };
    const playerName = state0.char?.name || "";
    let inscription = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await withAI("item.inscription", payload, { ai: webAi, apiCfg });
        if (stale()) return;
        const candidate = String(parseInscription(res) || "").trim();
        if (validateInscription(candidate, { playerName }).ok) { inscription = candidate; break; }
      } catch {
        if (stale()) return;
      }
    }
    if (!inscription) {
      // 校验连败/调用失败：静默不升级（系统账零变化），只留一句回味。
      addLog([{ t: "sys", text: `  你抚着「${item.name}」半晌，灵性浮动却未成形——铭文一事，暂且搁下。` }]);
      return;
    }
    if (stale()) return;
    // 落账走单一写边界：plan 在最新 state 上复核全部前置（幂等/脱下/已醒不重复升）。
    applyResult(featureCtx(), () => {
      const result = planInscriptionUpgrade(gameStore.getState(), item.id, inscription);
      if (!result) return { logs: [{ t: "sys", text: "  铭文未成——兵器灵性已经另有归属。" }] };
      applyResult(featureCtx(), result);
    }, { feature: "items.inscribe" });
  }, [apiCfg, addLog]);
}
