// ── 判官尾章/开庭前仲裁（S4 纯搬家：原 runTurn.js 两段原样移入，零行为变化）──
import { verifySealAndMaterialize } from "../../domain/rules/effects/sealVerifier.js";
import { validateEmergenceSeal } from "../../domain/rules/npc/npcEmergence.js";
import { recordSealMetric } from "../ports/releaseMetrics.js";
import { withAI } from "../ports/withAI.js";
import { getGameStateTime } from "./judgePhase.js";

// ── WO-13 尾章校对与落账编译（S4 纯搬家：原 runTurn.js 判官尾章段原样移入）──
// verifyJudgeTail(…)：漏写锚点系统补句、穿帮告警、fills 编译进 materializeFacts、
// 涌现校验/放行指标/SEAL 兜底接线全在原位。返回 { judgeEffects, narrativeText, p }——
// narrativeText/p 在段内原位重写过，调用方接回（与搬家前赋值语义一致）。
export function verifyJudgeTail({ ctx, deps, judgeVerdict, sealParts, narrativeText, rawFull, p, addLog, trace }) {
  let judgeEffects = null;
  if (judgeVerdict && deps.judgePipelineActive) {
    // 状态袋一律以 getGameState 实录为准（deps 里的 inv/char 在部分链路是空壳，
    // 空背包进 materializeFacts 会让 changes.inv 只含新货、把真背包整包抹掉）。
    const live = ctx.getGameState?.() || {};
    const stateForFacts = {
      time: getGameStateTime(ctx, deps),
      inv: live.inv || deps.inv || [], room: live.room || deps.room, char: live.char || deps.char,
      skills: live.skills || deps.skills || [],
      exp: live.exp ?? 0, pot: live.pot ?? 0,
      flags: live.flags || deps.flags || [],
      varTree: live.varTree, companionState: live.companionState,
      claimedMilestones: live.claimedMilestones,
      effectiveSpecialNow: deps.effectiveSpecialNow,
    };
    // 涌现校验必须以模型原始正文为准——系统补锚短句（patchedScreen）不能替模型
    // 完成「正文真实出现」的登场证据，所以在补写发生前先存一份原文。
    const rawNarrative = narrativeText || rawFull;
    const verified = verifySealAndMaterialize({
      sealText: sealParts?.sealText || "",
      screenText: rawNarrative,
      verdict: judgeVerdict,
      anchorIds: (sealParts?.anchors || []).map((a) => a.id),
      state: stateForFacts,
      luck: deps.char?.special?.气运 ?? 0,
      turn: stateForFacts.time,
    });
    if (verified.missingAnchors.length) {
      const before = narrativeText || "";
      const patched = verified.screenText.startsWith(before) ? verified.screenText.slice(before.length) : "";
      narrativeText = verified.screenText;
      // 正文已上屏（流式/非流式皆然）——系统补写的事实短句以旁白行追补落地，不篡改原文
      if (patched.trim()) addLog([{ t: "desc", text: "  " + patched.trim() }]);
    }
    for (const warning of verified.warnings) {
      trace("尾章校对", "warn", warning);
      addLog([{ t: "sys", text: `  ⚠ ${warning}` }]);
    }
    // SEAL respondedNpcs 兜底接线：系统推导（intake talk target）优先——推导非空时
    // SEAL 不覆盖；推导为空（intake 失败/未列 actions）时模型自证作为低可信兜底进 p，
    // 在场过滤仍由 talkKnow 统一执行，不得用于 pact 自证（见 docs）。
    if (!(deps.derivedRespondedNpcs || []).length && Array.isArray(verified.sealData?.respondedNpcs) && verified.sealData.respondedNpcs.length) {
      p = { ...p, respondedNpcs: verified.sealData.respondedNpcs };
    }
    // 涌现过渡复接：SEAL 申报的传闻/登场经五路校验后接回 p——recordRumors、
    // materializeEmergence、fixateNpcs、writeRoom 原管线接管；数值仍由系统侧定量。
    const emergenceCheck = validateEmergenceSeal(verified.sealData, {
      screenText: rawNarrative,
      varTree: live.varTree || deps.varTree || {},
      roomNpcs: (live.room || deps.room)?.npcs || [],
      playerName: (live.char || deps.char)?.name || "",
    });
    for (const note of emergenceCheck.notes) trace("涌现校验", "info", note);
    for (const warning of emergenceCheck.warnings) {
      trace("涌现校验", "warn", warning);
      addLog([{ t: "sys", text: `  ⚠ ${warning}` }]);
    }
    if (emergenceCheck.mentionedNewNpcs.length) {
      p = { ...p, mentionedNewNpcs: emergenceCheck.mentionedNewNpcs };
    }
    if (emergenceCheck.emergedNpc) {
      // materializeNpc 只替换不新增——先把最小形状并入 room.npcs 让原管线替换固化；
      // 不编造数值/随身物/id，战斗数据由 fixateNpcs/materializeEmergence 定量。
      const roomNpcs = [...(p.room?.npcs || [])];
      if (!roomNpcs.some((n) => n?.name === emergenceCheck.emergedNpc.name)) {
        roomNpcs.push({ name: emergenceCheck.emergedNpc.name, brief: emergenceCheck.emergedNpc.description.slice(0, 15) });
      }
      p = {
        ...p,
        emergedNpcName: emergenceCheck.emergedNpc.name,
        emergedNpcDescription: emergenceCheck.emergedNpc.description,
        room: { ...(p.room || {}), npcs: roomNpcs },
      };
    }
    // 放行指标在涌现校验之后统一记录——锚到了但尾章没填空（unfilledWarrants）、
    // 声明新 NPC 被 emergence 拒绝（rejections）都必须计入 failed，早记会漏。
    recordSealMetric({
      epoch: String(ctx.proseEpoch ?? "default"),
      cfg: deps.apiCfg,
      chain: "judge",
      sealText: sealParts?.sealText || "",
      sealData: verified.sealData,
      warnings: verified.warnings,
      missingAnchors: verified.missingAnchors,
      rejectedAffixes: verified.rejectedAffixes,
      unfilledWarrants: verified.unfilledWarrants,
      emergenceRejections: emergenceCheck.rejections,
    });
    judgeEffects = { verdict: judgeVerdict, sealReport: verified, materialized: verified.materialized };
    trace("尾章校对", "pass", `锚点齐 ${judgeVerdict.facts.length - verified.missingAnchors.length}/${judgeVerdict.facts.length}，编译券 ${Object.keys(verified.materialized?.receipts || {}).length}，facts 落盘 ${verified.facts.length} 条`, {
      structured: {
        seal: verified.sealData,
        anchors: sealParts?.anchors || [], missingAnchors: verified.missingAnchors,
        warnings: verified.warnings, rejectedAffixes: verified.rejectedAffixes,
        unfilledWarrants: verified.unfilledWarrants,
        facts: verified.facts, receipts: verified.materialized?.receipts || [],
      },
    });
  }
  return { judgeEffects, narrativeText, p };
}



// ── WO-15 窄过渡：赔罪（appease）开庭前仲裁（S4 纯搬家：原 runTurn.js 原样移入）──
// 旧 settleTurn 在叙事前跑就是为了把裁定注入叙事——正文必须与系统落账同向，
// 否则会出现"正文写已消气但系统零写入"的穿帮。裁定结果经 deps.appeaseVerdict
// 流入 buildSysBase 的 settle 叙事铁律。玩家原话优先取 settleOptions.attempt
// （按钮/路由生成的 cmd 是模板句，无法判断诚意）。
export async function runAppeaseVerdict({ ctx, deps, opts, cmd, ai, apiCfg, isSettle, trace }) {
  // 流入 buildSysBase 的 settle 叙事铁律。玩家原话优先取 settleOptions.attempt
  // （按钮/路由生成的 cmd 是模板句，无法判断诚意）。
  let appeaseVerdict = null;
  // WO-16F-F3：判官路已裁 appease 时不再调 turn.appease（双调用）；单调用老路
  // （extractionEnabled=false，判官不激活）仍靠它，行为不变。
  if (apiCfg.extractionEnabled && isSettle && opts.settleKind === "appease" && opts.settleNpc && !deps.judgePipelineActive) {
    const npcName = typeof opts.settleNpc === "string" ? opts.settleNpc : opts.settleNpc?.name || "";
    const npcState = (deps.varTree?.角色 || ctx.memory?.varTreeLatest?.角色 || {})[npcName] || {};
    const anger = npcState.生气状态 || {};
    try {
      const appeaseRes = await withAI(
        "turn.appease",
        {
          cfg: deps.apiCfg,
          npc: npcName,
          reason: anger.reason || "",
          attemptText: opts.attempt || cmd,
          attemptKind: "求和赔罪",
          personality: npcState.性情 || "",
          affection: npcState.好感度,
        },
        { ai, apiCfg: deps.apiCfg, throwOnError: false },
      );
      if (ctx.isStale?.()) return { stale: true };
      const choice = appeaseRes?.data?.choice;
      appeaseVerdict = { choice, npc: npcName };
      if (choice === "奏效") trace("赔罪仲裁", "pass", `${npcName}消了气（系统落账：生气解除+好感+3）`);
      else trace("赔罪仲裁", "skip", `${npcName}未消气（${choice || "判不了"}），本轮零写入`);
    } catch (error) {
      trace("赔罪仲裁", "fail", `裁决异常：${error?.message || error}，本轮零写入`);
      appeaseVerdict = { choice: null, npc: npcName };
    }
    deps.appeaseVerdict = appeaseVerdict;
  }
  return { appeaseVerdict, stale: false };
}


// ── WO-16A memory 过渡（无 AI 摘要）（S4 纯搬家：原 runTurn.js 原样移入）──
// 双调用判官回合 p.memory 恒空——改用系统模板串入账，保证删旧提取后事实账本/日总结不断档。
// ① 判官 facts 非空：取首条事实的模板串（op+npc/itemName+reason 拼句）；
// ② 纯搭话无 facts：「玩家对X说：原文≤30字截断」；其余自由行动不留账
// （无事实本就不该入账）。原文段落记忆库归 WO-17，这里只是过渡。
// 返回 memoryText 或 ""——调用方在原闸门（!isSettle && !p.memory）后接线，与搬家前同序。
export function composeJudgeMemory({ judgeVerdict, deps, judgeEffects, isTalk, ctx, cmd }) {
  if (!(judgeVerdict && deps.judgePipelineActive)) return "";
    const first = (judgeVerdict.facts || [])[0];
    let memoryText = "";
    if (first) {
      const parts = [first.op, first.npc || first.itemName || "", first.reason || first.detail || ""].filter(Boolean);
      memoryText = parts.join("·").slice(0, 50);
    } else if ((judgeEffects?.materialized?.receipts || []).some((r) => r?.kind === "grant_item")) {
      // WO-16C：条件拾取券在判官 verdict 里刻意无 facts（双证据齐备才合成），
      // memory 模板读 verdict 会漏记路遇拾取——改用落盘回执作事实源，
      // 回执存在即真实入包（拒捡/撞名丢弃均无回执）。
      const grant = judgeEffects.materialized.receipts.find((r) => r?.kind === "grant_item");
      memoryText = `拾得${grant.item?.name || "路遇之物"}`.slice(0, 50);
    } else if (isTalk) {
      const target = (deps.derivedRespondedNpcs || [])[0] || ctx.talkTarget || "";
      memoryText = `${target ? `玩家对${target}说` : "玩家说"}：${String(cmd).slice(0, 30)}`.slice(0, 50);
    }
    return memoryText;
  return "";
}
