// 入册审改 · 玩家页 AI 补全三组动作（从 ReviewPlayer.jsx 拆出）
// ============================================================================
// aiScanBody：粘贴一段描写 → AI 拆成体貌字段（公开层＋私密层）补全，只合并不覆盖。
// aiScanSkills：读主角人设 + 卡的性格/招式线索，产 1-3 门武学（覆盖现有）。
// aiScanEquip：借 carryPlan 把主角当一个人配 2-4 件随身物（覆盖现有 carry）。
// 三只共用一个 aiMsg 提示位；忙碌态各自独立。

import { useState } from "react";
import { BODY_PUBLIC, BODY_PRIVATE } from "./widgets.jsx";
import { parseJsonLoose, buildStage3 } from "../../../domain/rules/cards/scanPrompts.js";
import { callCardModel } from "../../../engine/ports/cardScan/scanCalls.js";
import { acquire } from "../../../domain/rules/cards/rateLimiter.js";
import { buildSkillPlan, sanitizeSkillPlan, SKILL_PLAN_MAX_TOKENS } from "../../../domain/rules/cards/skillPlan.js";
import { buildCarryPlan, sanitizeCarryPlan, CARRY_PLAN_MAX_TOKENS } from "../../../domain/rules/cards/carryPlan.js";

export default function usePlayerAiScans({ p, tier, bp, priv, onPatch, apiCfg, cardMesExample, cardPersonality }) {
  const [skillBusy, setSkillBusy] = useState(false);
  const [equipBusy, setEquipBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [bodyDesc, setBodyDesc] = useState("");
  const [bodyBusy, setBodyBusy] = useState(false);

  // 私密项原文没写到的 AI 会留空，不编造。
  const aiScanBody = async () => {
    if (bodyBusy || !apiCfg || !bodyDesc.trim()) return;
    setBodyBusy(true); setAiMsg("正在拆解体貌…");
    try {
      await acquire(ms => setAiMsg(`排队 ${Math.ceil(ms / 1000)}s…`));
      const { system, user } = buildStage3(bodyDesc, { cardName: p.name || "玩家" });
      const res = await callCardModel(apiCfg, system, user,
        { maxTokens: 4000, temperature: 0.3, callLabel: "主角体貌拆解" });
      const out = parseJsonLoose(res.text || "");
      const pub = {}, newPriv = {};
      for (const [k] of BODY_PUBLIC) {
        const v = out?.bodyProfile?.[k];
        if (typeof v === "string" && v.trim()) pub[k] = v.trim().slice(0, 40);
      }
      for (const [k] of BODY_PRIVATE) {
        const v = out?.bodyProfilePrivate?.[k];
        if (typeof v === "string" && v.trim()) newPriv[k] = v.trim().slice(0, 40);
      }
      const nPub = Object.keys(pub).length, nPriv = Object.keys(newPriv).length;
      if (nPub + nPriv) {
        onPatch({
          ...(nPub ? { bodyProfile: { ...bp, ...pub } } : {}),
          ...(nPriv ? { bodyProfilePrivate: { ...priv, ...newPriv } } : {}),
        });
        setAiMsg(`拆出公开 ${nPub} 项、私密 ${nPriv} 项，可改`);
      } else {
        setAiMsg("没拆出认得出的字段，换个写法再试");
      }
    } catch (e) {
      setAiMsg(`没成：${String(e?.message || e).slice(0, 60)}`);
    } finally { setBodyBusy(false); }
  };

  // 品阶不超过 tier（跟着内功走的档上限），免得白袍开局就红档神功。
  const aiScanSkills = async () => {
    if (skillBusy || !apiCfg) return;
    setSkillBusy(true); setAiMsg("正在现编武学…");
    try {
      await acquire(ms => setAiMsg(`排队 ${Math.ceil(ms / 1000)}s…`));
      const { system, user } = buildSkillPlan(p, { tier, moveHints: cardMesExample || cardPersonality });
      const res = await callCardModel(apiCfg, system, user,
        { maxTokens: SKILL_PLAN_MAX_TOKENS, temperature: 0.7, callLabel: "主角现编武学" });
      const skills = sanitizeSkillPlan(parseJsonLoose(res.text || ""), { tierCap: tier });
      if (skills.length) { onPatch({ skills }); setAiMsg(`现编了 ${skills.length} 门武学，可自己改`); }
      else setAiMsg("AI 没给出认得出的武学，再点一次试试");
    } catch (e) {
      setAiMsg(`没成：${String(e?.message || e).slice(0, 60)}`);
    } finally { setSkillBusy(false); }
  };

  const aiScanEquip = async () => {
    if (equipBusy || !apiCfg) return;
    setEquipBusy(true); setAiMsg("正在配装备…");
    try {
      await acquire(ms => setAiMsg(`排队 ${Math.ceil(ms / 1000)}s…`));
      const one = [{ name: p.name || "主角", levelCap: tier, brief: "游历江湖的主角", entry: p.persona || "" }];
      const { system, user } = buildCarryPlan(one);
      const res = await callCardModel(apiCfg, system, user,
        { maxTokens: CARRY_PLAN_MAX_TOKENS.batch, temperature: 0.7, callLabel: "主角配装" });
      const plans = sanitizeCarryPlan(parseJsonLoose(res.text || ""), one);
      const items = plans[0]?.items || [];
      if (items.length) { onPatch({ carry: items }); setAiMsg(`配了 ${items.length} 件装备，点物件名看词条`); }
      else setAiMsg("AI 没配出装备，再点一次试试");
    } catch (e) {
      setAiMsg(`没成：${String(e?.message || e).slice(0, 60)}`);
    } finally { setEquipBusy(false); }
  };

  return {
    aiMsg, bodyDesc, setBodyDesc,
    bodyBusy, skillBusy, equipBusy,
    aiScanBody, aiScanSkills, aiScanEquip,
  };
}
