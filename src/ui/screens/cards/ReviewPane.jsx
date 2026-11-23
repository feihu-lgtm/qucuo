// 入册 · 过目定稿（从 CardImportScreen.jsx 拆出）
// 这一层只做分派：开局向导走 ReviewWizard，游戏中常规入册走 ReviewRoster，
// 两边共用的勾选/批量/向导状态与 useReviewOps 的结果留在这里统一喂下去。
// 全字段的排布在 ReviewNpc/ReviewPlayer 里，AI 批操作与「选主角」逻辑收在
// useReviewOps.js；批量控件/进度条/AI 按钮在 ReviewBatch.jsx。
import React, { useState } from "react";
import { normalizePlacement } from "../../../domain/rules/cards/importedRegistry.js";
import { PLANNABLE_DISTRICTS } from "../../../domain/rules/cards/placementPlan.js";
import { useReviewOps } from "./useReviewOps.js";
import ReviewWizard from "./ReviewWizard.jsx";
import ReviewRoster from "./ReviewRoster.jsx";

export default function ReviewPane({
  parsed, result, accent, detail, setDetail, patchNpc, patchPlayer, patchWorld,
  setResult, asPlayer, onBack, onFinish, term, onExpandTerm, apiCfg, cardImage,
  currentDistrict, autoPlace = false,
}) {
  const cur = detail >= 0 ? result.npcs[detail] : null;

  // 哪几个人真的要加入。默认全勾——一张卡扫出来的人多半都是想要的，让玩家取消
  // 个别几个，比让他从零勾起省事。
  const [picked, setPicked] = useState(() => new Set(result.npcs.map((_, i) => i)));
  const allOn = picked.size === result.npcs.length && result.npcs.length > 0;
  const toggleOne = (i) => setPicked(p => {
    const n = new Set(p);
    if (n.has(i)) n.delete(i); else n.add(i);
    return n;
  });
  const toggleAll = () => setPicked(allOn ? new Set() : new Set(result.npcs.map((_, i) => i)));

  // ── 开局向导 · 分步（仅 playerMode）────────────────────────────────────
  // 借鉴「墨色江湖」开局向导骨架：左侧步骤导航 + 主内容区 + 上一步/下一步。
  // 三步：① 选主角 → ② 调主角·选队友 → ③ 确认落册。步骤定义与跳转集中在这，
  // 内容区按 wizardStep 条件渲染。
  const WIZARD_STEPS = ["选主角", "设置主角", "选NPC · 逐个调", "同行 · 落册"];
  const [wizardStep, setWizardStep] = useState(0);
  // 开局同行：Step2 里从「落江湖的 NPC」指定 1 人开局就随队（companion 出战位）。
  // 存名字即可，落册时在 CardImportScreen.finish 里把它单独交给 onImportStarterCompanion。
  const [starterCompanion, setStarterCompanion] = useState(null);
  const stepLabel = WIZARD_STEPS[wizardStep] || "确认落册";
  const canNext = !asPlayer || wizardStep >= 2 || (wizardStep === 0 ? true : true);
  const nextStep = () => setWizardStep(s => Math.min(s + 1, WIZARD_STEPS.length - 1));
  const prevStep = () => setWizardStep(s => Math.max(s - 1, 0));

  const {
    playerFromNpc, bodyBusy, pickPlayerFrom,
    planBusy, planMsg, planProg, planAll,
    equipBusy, equipMsg, equipProg, equipAll,
    dropped,
  } = useReviewOps({ result, setResult, apiCfg, patchNpc, parsed, autoPlace });
  const pickedNpcs = result.npcs.filter((n, i) => picked.has(i) && n.name !== playerFromNpc);
  // 「会真的出现」只统计勾选中的——没勾的人压根不进库，算进去是虚报
  const placedCount = pickedNpcs.filter(x => normalizePlacement(x.placement).mode !== "mention").length;
  // 向导「选 NPC · 逐个调」右栏当前编辑的人：被选为主角的那位不当 NPC 编辑（他走主角档案）
  const curNpc = cur && cur.name !== playerFromNpc ? cur : null;

  // ── 名单批量：不必逐个点开，勾一批人一键设落脚/品阶 ─────────────────────
  // 招式路数因人而异没法一键套（那个逐个点开在右栏 MoveEditor 里定），但落脚与
  // 品阶是最费手的两项——一张卡的人常常同属一个据点、或该整体拔高一档，批量最省事。
  const [batchDistrict, setBatchDistrict] = useState(() =>
    (currentDistrict && PLANNABLE_DISTRICTS.includes(currentDistrict)) ? currentDistrict : PLANNABLE_DISTRICTS[0]);
  // 只改勾选中、且不是被选为主角的那些人
  const forEachPickedNpc = (fn) => setResult(r => ({
    ...r, npcs: r.npcs.map((n, i) => (picked.has(i) && n.name !== playerFromNpc) ? fn(n) : n),
  }));
  const applyBatchPlacement = (mode, district) => forEachPickedNpc(n => {
    let placement;
    if (mode === "resident") placement = { mode: "resident", district, innerRoom: null, weights: {}, timeSlot: [0, 23] };
    else if (mode === "wander") placement = { mode: "wander", district: null, innerRoom: null, weights: district ? { [district]: 75 } : {}, timeSlot: [0, 23] };
    else placement = { mode: "mention", district: null, innerRoom: null, weights: {}, timeSlot: [0, 23] };
    return { ...n, placement, placementWhy: "手动批量设", placementRejected: false };
  });
  const applyBatchTier = (levelCap) => forEachPickedNpc(n => ({ ...n, levelCap }));
  const batchBtn = {
    cursor: "pointer", fontSize: 10.5, padding: "2px 8px", borderRadius: 0,
    border: "1px solid var(--border-deep)", color: "var(--quest-stage-desc)", userSelect: "none",
  };

  const shared = {
    result, accent, detail, setDetail, patchNpc, onBack, onFinish,
    apiCfg, cardImage, currentDistrict,
    picked, toggleOne, pickedNpcs, placedCount,
    batchDistrict, setBatchDistrict, applyBatchPlacement, applyBatchTier, batchBtn,
    planBusy, planMsg, planProg, planAll, equipBusy, equipMsg, equipProg, equipAll, dropped,
  };

  return asPlayer ? (
    <ReviewWizard {...shared}
      parsed={parsed} patchPlayer={patchPlayer} patchWorld={patchWorld} setResult={setResult}
      WIZARD_STEPS={WIZARD_STEPS} wizardStep={wizardStep} setWizardStep={setWizardStep}
      nextStep={nextStep} prevStep={prevStep}
      playerFromNpc={playerFromNpc} bodyBusy={bodyBusy} pickPlayerFrom={pickPlayerFrom}
      curNpc={curNpc} starterCompanion={starterCompanion} setStarterCompanion={setStarterCompanion} />
  ) : (
    <ReviewRoster {...shared}
      term={term} onExpandTerm={onExpandTerm} cur={cur}
      allOn={allOn} toggleAll={toggleAll} />
  );
}
