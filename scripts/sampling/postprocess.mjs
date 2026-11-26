// A4 后处理：按 x-qucuo-trace 头归属（不再时间窗/文本推断），
// 统计 intake schema 合格率、kind 实际分布对配额、尾章可解析率/校验通过率、usage 汇总。
// 尾章口径：主叙事输出含 ---SEAL--- 为尾章调用；按调用链分判官尾章/群聊尾章分别统计。
//
// 用法：node scripts/sampling/postprocess.mjs [artifactsDir] [scenario_mode_lane 前缀过滤]
//   默认读 ~/.sampling/artifacts，汇总所有 *_turns.jsonl 与 ai_calls.jsonl。
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ART = process.argv[2] || `${process.env.HOME}/.sampling/artifacts`;

function loadJsonl(path) {
  try {
    return readFileSync(path, "utf8").split("\n").filter((l) => l.trim())
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

function callText(c) {
  const r = c.response;
  if (r && typeof r === "object") {
    try { return r.choices[0].message.content || ""; } catch { return ""; }
  }
  const raw = c.sseRaw || "";
  if (raw) {
    const parts = [];
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (t.startsWith("data:") && t.slice(5).trim() !== "[DONE]") {
        try {
          const d = JSON.parse(t.slice(5).trim()).choices?.[0]?.delta || {};
          if (d.content) parts.push(d.content);
        } catch { /* 半行忽略 */ }
      }
    }
    return parts.join("");
  }
  return "";
}

function callUsage(c) {
  if (c.usage) return c.usage;
  // 兜底：sseRaw 末段 usage 行（proxy 正常已提取进 c.usage，这里是双保险）
  for (const line of (c.sseRaw || "").split("\n")) {
    if (line.startsWith("data:") && !line.includes("[DONE]")) {
      try {
        const d = JSON.parse(line.slice(5).trim());
        if (d?.usage) return d.usage;
      } catch { /* 忽略 */ }
    }
  }
  return {};
}

// 调用链分类：按 system prompt 稳定标识，绝不靠长度/流式猜——
// 提取器等小调用落 other，永远不进 SEAL 分母。
//   intake：前哨听意员（intakeTurn.js）
//   narrative_group：【群聊回响】尾章块（judgeRuleBlock.js，双调用群聊专属）
//   narrative_judge：【判官定案】铁律块（judgeRuleBlock.js，双调用判官链主叙事）
//   narrative_plain：其余带 MUD 引擎身份块的长调用（单调用主叙事等，SEAL 不适用）
//   other：状态提取/分类/小调用——不进任何叙事统计
export function classifyCall(c) {
  const req = JSON.stringify(c.request || {});
  if (req.includes("前哨听意员")) return "intake";
  if (req.includes("【群聊回响】")) return "narrative_group";
  if (req.includes("【判官定案】")) return "narrative_judge";
  if (req.includes("你是MUD引擎")) return "narrative_plain";
  return "other";
}

function parseJson(text) {
  const m = (text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

const VALID_KINDS = new Set(["talk", "move", "inspect_container", "take", "give", "trade", "steal", "duel", "appease", "learn", "invite", "use_item", "equip", "free_act"]);

function sanitize(s) {
  return String(s)
    .replace(/sk-[A-Za-z0-9_\-]{8,}/g, "sk-***REDACTED***")
    .replace(/(Bearer\s+)[A-Za-z0-9_\-.]+/g, "$1***REDACTED***");
}

export function postprocess(artDir = ART) {
  const files = readdirSync(artDir);
  const turnFiles = files.filter((f) => f.endsWith("_turns.jsonl"));
  const calls = loadJsonl(join(artDir, "ai_calls.jsonl"));
  // 归属索引：trace → calls
  const byTrace = new Map();
  const unattributed = [];
  for (const c of calls) {
    if (c.trace) {
      if (!byTrace.has(c.trace)) byTrace.set(c.trace, []);
      byTrace.get(c.trace).push(c);
    } else unattributed.push(c);
  }

  const groups = {};
  for (const tf of turnFiles) {
    const groupKey = tf.replace(/_turns\.jsonl$/, "").replace(/_lane\d+$/, "");
    groups[groupKey] ||= { turns: [], lanes: 0 };
    groups[groupKey].turns.push(...loadJsonl(join(artDir, tf)));
    groups[groupKey].lanes++;
  }

  const report = { generatedAt: new Date().toISOString(), unattributedCalls: unattributed.length, groups: {} };
  for (const [key, g] of Object.entries(groups)) {
    const usage = { prompt: 0, completion: 0, reasoning: 0 };
    const kindsDist = {};
    const outcomeDist = {};
    let intakeTotal = 0, intakeSchemaOk = 0, intakeCalls = 0;
    const chainCounts = {};
    // 尾章两线：判官尾章 / 群聊尾章——按 system prompt 链路特征分桶
    const seal = {
      judge: { total: 0, hasSeal: 0, parseOk: 0 },
      group: { total: 0, hasSeal: 0, parseOk: 0 },
    };
    const lat = { intake: [], narrative: [] };
    let attributedCalls = 0, turnsWithCalls = 0;

    for (const t of g.turns) {
      const tcalls = t.trace ? (byTrace.get(t.trace) || []) : [];
      if (tcalls.length) turnsWithCalls++;
      attributedCalls += tcalls.length;
      for (const c of tcalls) {
        const txt = callText(c);
        const chain = classifyCall(c);
        const u = callUsage(c);
        const det = u.completion_tokens_details || {};
        usage.prompt += u.prompt_tokens || 0;
        usage.completion += u.completion_tokens || 0;
        usage.reasoning += det.reasoning_tokens || 0;
        chainCounts[chain] = (chainCounts[chain] || 0) + 1;
        if (chain === "intake") {
          intakeCalls++;
          if (c.ms) lat.intake.push(c.ms);
          // 分母=所有 intake 调用：解析失败/字段缺失都计入不合格，不虚增合格率
          intakeTotal++;
          const pj = parseJson(txt);
          const actions = pj && Array.isArray(pj.actions) ? pj.actions.filter((a) => a && typeof a === "object") : null;
          const kinds = actions ? actions.map((a) => a.kind) : [];
          // schema 合格口径：可解析 + actions 非空 + kind 全在十四枚举 + 每动作带 text/target 必填键
          const ok = !!actions && kinds.length > 0 && kinds.every((k) => VALID_KINDS.has(k))
            && actions.every((a) => typeof a.text === "string" && typeof a.target === "string");
          if (ok) intakeSchemaOk++;
          for (const k of kinds) if (VALID_KINDS.has(k)) kindsDist[k] = (kindsDist[k] || 0) + 1;
          if (actions) {
            for (const a of actions) {
              if (a?.kind === "free_act" && a.outcome) outcomeDist[a.outcome] = (outcomeDist[a.outcome] || 0) + 1;
            }
          }
        } else if (chain === "narrative_judge" || chain === "narrative_group") {
          if (c.ms) lat.narrative.push(c.ms);
          // 尾章口径：只有判官/群聊链主叙事被要求写 ---SEAL---，分母只含这两类——
          // 提取器/小调用落 other 绝不进分母；单调用 narrative_plain 无 SEAL 契约也不进。
          const bucket = chain === "narrative_group" ? seal.group : seal.judge;
          bucket.total++;
          if (txt.includes("---SEAL---")) {
            bucket.hasSeal++;
            const sealPart = txt.split("---SEAL---")[1] || "";
            if (parseJson(sealPart)) bucket.parseOk++;
          }
        } else if (chain === "narrative_plain") {
          if (c.ms) lat.narrative.push(c.ms);
        }
      }
    }

    const med = (arr) => arr.length ? arr.sort((a, b) => a - b)[Math.floor(arr.length / 2)] : null;
    // 配额核对：kind 每类≥10、free_act outcome 每类≥5
    const quotaGaps = [];
    for (const k of VALID_KINDS) {
      if ((kindsDist[k] || 0) < 10) quotaGaps.push(`kind:${k}=${kindsDist[k] || 0}<10`);
    }
    for (const o of ["无", "伤损", "得财", "破费", "调息", "修习", "服用", "受寒中毒", "醉酒", "其他"]) {
      if ((outcomeDist[o] || 0) < 5) quotaGaps.push(`outcome:${o}=${outcomeDist[o] || 0}<5`);
    }
    report.groups[key] = {
      turns: g.turns.length, lanes: g.lanes,
      turnsWithCalls, attributedCalls, chainCounts,
      usage,
      intake: {
        calls: intakeCalls, parsed: intakeTotal, schemaOk: intakeSchemaOk,
        passRate: intakeTotal ? +(intakeSchemaOk / intakeTotal).toFixed(4) : null,
      },
      seal: {
        judge: { ...seal.judge, sealRate: seal.judge.total ? +(seal.judge.hasSeal / seal.judge.total).toFixed(4) : null, parseRate: seal.judge.hasSeal ? +(seal.judge.parseOk / seal.judge.hasSeal).toFixed(4) : null },
        group: { ...seal.group, sealRate: seal.group.total ? +(seal.group.hasSeal / seal.group.total).toFixed(4) : null, parseRate: seal.group.hasSeal ? +(seal.group.parseOk / seal.group.hasSeal).toFixed(4) : null },
      },
      latencyMsMedian: { intake: med(lat.intake), narrative: med(lat.narrative) },
      kindsDistribution: Object.fromEntries(Object.entries(kindsDist).sort((a, b) => b[1] - a[1])),
      outcomeDistribution: outcomeDist,
      quotaGaps,
    };
  }
  const outPath = join(artDir, "a4_report.json");
  writeFileSync(outPath, sanitize(JSON.stringify(report, null, 2)));
  return report;
}

if (process.argv[1] && process.argv[1].endsWith("postprocess.mjs")) {
  const r = postprocess();
  console.log(JSON.stringify(Object.fromEntries(Object.entries(r.groups).map(([k, g]) => [k, {
    turns: g.turns, intakePassRate: g.intake.passRate,
    judgeSealRate: g.seal.judge.sealRate, quotaGaps: g.quotaGaps.length,
  }])), null, 2));
}
