// WO-13 尾章校对器：说书人正文写完后的 ---SEAL--- 尾章是唯一能填空的地方。
// 三条铁律：
//   1) 判官每条 facts 锚点是否均已落文——漏写由系统模板补一行事实短句兜底；
//   2) 穿帮检测——已不在某 NPC 身上的器物名被该 NPC 拔出使用，告警；
//   3) fills 与 warrants 送 WO-10 编译，spontaneousPact 校验通过后并入 facts，
//      最终调用 materializeFacts 产出可经 commitRound 落盘的 { changes, patches, receipts, logs }。
// 纯函数，禁 Date.now/Math.random。

import { compileEmergentItem } from "./compileEmergentItem.js";
import { compileEmergentSkill } from "./compileEmergentSkill.js";
import { materializeFacts } from "./materializeFacts.js";

// 从尾章缓冲里提取 JSON：SEAL 标记后第一行（或第一个 { 到结尾）单线 JSON。
export function parseSealJson(sealText) {
  const raw = String(sealText || "").trim();
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

const USE_VERBS = /拔|挥|抡|抽|刺|砍|舞|擎|操/;

// 穿帮检测：TRANSFER_ITEM 把器物从 NPC 手上转走后，正文里该 NPC 还在用它。
function detectMismatch(screenText, facts) {
  const warnings = [];
  for (const fact of facts || []) {
    if (fact?.op !== "TRANSFER_ITEM" || !fact.itemName || !fact.from || fact.from === "player") continue;
    for (const line of String(screenText || "").split("\n")) {
      if (line.includes(fact.from) && line.includes(fact.itemName) && USE_VERBS.test(line)) {
        warnings.push(`穿帮嫌疑：「${fact.itemName}」已不在${fact.from}身上，正文仍写其使用：${line.trim().slice(0, 40)}`);
        break;
      }
    }
  }
  return warnings;
}

// 漏写锚点兜底：系统模板补一行事实短句（绝不改写剧情，只补事实落地）。
function fallbackLine(fact) {
  if (fact.itemName && fact.op === "TRANSFER_ITEM") {
    const to = fact.to === "player" ? "少侠" : fact.to;
    const from = fact.from === "player" ? "少侠" : fact.from;
    return `（${from}把「${fact.itemName}」交到${to}手上。）`;
  }
  if (fact.op === "GRANT_ITEM" && fact.itemName) return `（少侠得了「${fact.itemName}」。）`;
  if (fact.op === "MUTATE_SOCIAL" && fact.npc) return `（${fact.npc}心里记下这一笔。）`;
  return `（${fact.id} 之事已成定局。）`;
}

// pact 校验：_npc 须在场/已回应、promise 非空、deadlineHours 为正数。
function validPact(pact, { npcNames = [] } = {}) {
  if (!pact || typeof pact !== "object") return null;
  if (!pact.npc || !pact.promise) return null;
  if (!Number.isFinite(pact.deadlineHours) || pact.deadlineHours <= 0) return null;
  // 只认判官在场名册（reactionGuides）：respondedNpcs 与 pact 同出模型一人之口，
  // 拿它当佐证等于让提案者自证——幽灵角色会被写进契约。
  if (npcNames.length && !npcNames.includes(pact.npc)) return null;
  return { npc: pact.npc, promise: String(pact.promise), deadlineHours: pact.deadlineHours, rewardHint: pact.rewardHint || "" };
}

// 主编排：尾章解析 → 锚点核对 → 穿帮检测 → 编译 → pact 并入 → materializeFacts。
// verdict: judgeTurn 输出；screenText: 锚点已剥的正文；anchorIds: 正文里实际出现过的锚点 id 列表。
export function verifySealAndMaterialize({
  sealText, screenText, verdict, anchorIds = [], state = {}, luck = 0, turn = 0,
} = {}) {
  const facts = [...(verdict?.facts || [])];
  const warrants = [...(verdict?.warrants || [])];
  const warnings = [];
  const notes = [];

  const sealData = parseSealJson(sealText);
  if (String(sealText || "").trim() && !sealData) {
    warnings.push("尾章 JSON 解析失败，天机券无法填空");
  }

  // 铁律一：facts 锚点落文核对，漏写补系统模板短句
  let patchedScreen = String(screenText || "");
  const seen = new Set(anchorIds);
  const missingAnchors = [];
  for (const fact of facts) {
    if (!fact.id) continue;
    if (!seen.has(fact.id)) {
      missingAnchors.push(fact.id);
      patchedScreen += (patchedScreen.endsWith("\n") || !patchedScreen ? "" : "\n") + fallbackLine(fact);
    }
  }
  if (missingAnchors.length) notes.push(`漏写锚点 ${missingAnchors.join("、")}，系统补写事实短句`);

  // 铁律二：穿帮检测（只告警不改文）
  warnings.push(...detectMismatch(patchedScreen, facts));

  // 铁律三：fills + warrants 送 WO-10 编译
  const fills = sealData?.fills || {};
  const compiledWarrants = {};
  const rejectedAffixes = [];
  // 尾章失职券（放行指标用）：正文埋了锚/券非条件，尾章却没填空——
  // 模型自己的 SEAL 没尽责，必须计失败。条件券正文未埋锚的作废是叙事合法跳过，不计入。
  const unfilledWarrants = [];
  for (const warrant of warrants) {
    const fill = fills[warrant.warrantId];
    // WO-16C 条件券双证据：①正文出现对应 F 锚点 且 ②fill 可编译，缺一即作废
    // 零落账——绝不走普通 facts 的漏锚补写（否则正文没捡系统硬塞，自相矛盾）。
    if (warrant.conditional) {
      const anchored = warrant.factId && seen.has(warrant.factId);
      if (!anchored) {
        notes.push(`${warrant.warrantId} 条件券正文未埋锚（叙事此刻不宜拾取），券作废`);
        continue;
      }
      if (!fill) {
        notes.push(`${warrant.warrantId} 条件券正文已埋锚但尾章未填空，券作废`);
        unfilledWarrants.push(warrant.warrantId);
        continue;
      }
    } else if (!fill) {
      notes.push(`${warrant.warrantId} 尾章未填空，该券作废`);
      unfilledWarrants.push(warrant.warrantId);
      continue;
    }
    // 形状防线：name 必须是非空字符串——模型失控吐出对象时，
    // 铸进实例会让 UI 把对象当文本渲染直接炸 React。
    if (typeof fill.name !== "string" || !fill.name.trim()) {
      warnings.push(`${warrant.warrantId} 尾章填空的名字不是字符串，该券作废`);
      continue;
    }
    const compiled = warrant.op === "BESTOW_SKILL"
      ? compileEmergentSkill(warrant, fill)
      : compileEmergentItem(warrant, fill, { luck });
    if (!compiled) {
      warnings.push(`${warrant.warrantId} 编译失败（${fill?.name || "无名"}）`);
      continue;
    }
    if (compiled.rejectedAffix) rejectedAffixes.push(warrant.warrantId);
    compiledWarrants[warrant.warrantId] = compiled;
    if (warrant.factId) compiledWarrants[warrant.factId] = compiled;
    if (warrant.conditional && warrant.factId) {
      // 双证据齐备：合成 GRANT_ITEM fact 进 materializeFacts（锚点已在文中，无需补写）
      facts.push({
        id: warrant.factId, op: "GRANT_ITEM",
        itemName: typeof fill.name === "string" ? fill.name.trim() : "",
        from: "", to: "player", witnesses: ["主角"],
      });
      notes.push(`${warrant.warrantId} 条件券双证据齐备，合成事实 ${warrant.factId} 落账`);
    }
  }

  // spontaneousPact 校验并入 facts
  if (verdict?.allowSpontaneousPact && sealData?.spontaneousPact) {
    const pact = validPact(sealData.spontaneousPact, {
      npcNames: (verdict.reactionGuides || []).map((g) => g.npc),
    });
    if (pact) {
      facts.push({
        id: `pact_${turn}_${facts.length + 1}`, op: "BIND_OR_SETTLE_PACT",
        npc: pact.npc, promise: pact.promise, deadlineHours: pact.deadlineHours,
        rewardHint: pact.rewardHint, witnesses: ["主角", pact.npc],
      });
    } else {
      warnings.push("spontaneousPact 校验未过（npc 不在场/期限非法/承诺为空），未并入");
    }
  }

  // 落盘编译：materializeFacts 纯函数产出 changes/patches/receipts/logs
  const materialized = materializeFacts(state, facts, compiledWarrants);

  return {
    sealData,
    screenText: patchedScreen,
    missingAnchors,
    warnings,
    notes,
    rejectedAffixes,
    unfilledWarrants,
    facts,
    materialized,
  };
}
