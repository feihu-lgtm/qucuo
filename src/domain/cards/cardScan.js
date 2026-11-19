// 卡扫描流水线
// ============================================================================
// 把 cardParse 的解析结果，经 4 个阶段的 AI 调用，补全成可以直接写进游戏的
// NPC / 玩家数据。核心约束是免费反代站 5 次/分钟，所以：
//   · 先 planScan 算清要花几次，在开扫前就告诉玩家要等多久
//   · 每批结果立刻落盘，中断后续跑不重复烧额度
//   · 任何一批失败都降级到兜底值，绝不阻塞导入
//
// 【为什么 AI 扫描是可选的】阶段 0（cardParse + 兜底值）就已经能填满所有必填
// 字段，玩家手改也能完成导入。免费反代随时会 429 或超时，不能让主流程卡在一个
// 可能挂掉的外部服务上。所以 UI 上这是一个按钮，不是一道关。

import { acquire, estimateMs, bucketStatus } from "./rateLimiter.js";
import * as store from "./scanStore.js";
import {
  buildStage1, buildStage2, buildStage3, buildStage4,
  parseJsonLoose, sanitizeSpecial, sanitizeLevelCap, sanitizeAffection,
  sanitizeMilestones, sanitizeBrief, sanitizeGongfu, sanitizeMoves, sanitizeLore,
  BODY_PUBLIC_KEYS, BODY_PRIVATE_KEYS,
  FALLBACK_SPECIAL, FALLBACK_LEVEL_CAP, FALLBACK_MILESTONES, SLOT_DEFAULT_ARCHETYPE, MOVE_SLOTS,
} from "./scanPrompts.js";
import { groupEntriesByKeys, groupToNpcLore } from "./cardParse.js";

export const DEFAULT_BATCH_SIZE = 4;

// 每阶段的输出 token 上限。阶段 2 一批 4 人、每人含七维与四档里程碑，
// 实测约 900~1200 token，给 3000 留足余量；阶段 1 只出短字段但条目可能 36 条。
// 阶段 2 每人多了两档里程碑各两句正文（约 16 句/批），比只出短字段时长一截，
// 3000 会顶到截断，给 4500。
// 阶段 1 改成发条目正文后，输入变长、模型也更容易多话，输出上限跟着提。
// 36 条卡每条一行 kind+why 加上分组，实测约 1500~2500，给 6000 留足。
const STAGE_MAX_TOKENS = { 1: 6000, 2: 4500, 3: 1500, 4: 4000 };

// ── 预算规划（纯计算，不发任何请求）─────────────────────────────────────────────

/**
 * 算清这次扫描要花几次调用、大概等多久。UI 在"开始扫描"按钮旁边显示它。
 * @returns {{calls:number, breakdown:object, alreadyDone:number, estimateMs:number}}
 */
export function planScan(parsed, opts = {}) {
  const { card, npcLoreCandidates, personaCandidate, unclassified } = parsed;
  const md5 = store.fingerprintCard(card);
  const batchSize = opts.batchSize || DEFAULT_BATCH_SIZE;
  const asPlayer = !!opts.asPlayer;

  // 阶段 1 总是要跑（分类与分组是后续阶段的输入）
  const needStage1 = !store.hasStage(md5, 1);

  // 阶段 2 的人数：代码已经分好的 person 组，加上待定条目里可能被 AI 判成人的。
  // 这里按上限估（待定全算人），宁可把预算报高也别让玩家等到一半才发现还要加时间。
  const personCount = opts.selectedPeople
    ? opts.selectedPeople.length
    : (npcLoreCandidates || []).length + (unclassified || []).length;
  const totalBatches = personCount > 0 ? Math.ceil(personCount / batchSize) : 0;
  const doneBatches = store.completedBatches(md5).length;
  const needStage2 = Math.max(0, totalBatches - doneBatches);

  const needStage3 = asPlayer && (personaCandidate || card.fields.description)
    && !store.hasStage(md5, 3) ? 1 : 0;
  const needStage4 = asPlayer && (card.openings || []).length
    && !store.hasStage(md5, 4) ? 1 : 0;

  const calls = (needStage1 ? 1 : 0) + needStage2 + needStage3 + needStage4;

  return {
    md5,
    calls,
    breakdown: {
      stage1: needStage1 ? 1 : 0,
      stage2: needStage2,
      stage3: needStage3,
      stage4: needStage4,
    },
    personCount,
    totalBatches,
    alreadyDone: (store.hasStage(md5, 1) ? 1 : 0) + doneBatches
      + (store.hasStage(md5, 3) ? 1 : 0) + (store.hasStage(md5, 4) ? 1 : 0),
    estimateMs: estimateMs(calls),
    bucket: bucketStatus(),
  };
}

/**
 * 只跑阶段 1（归类＋同人分组＋多人条目＋题材）。
 *
 * 【为什么要能单独跑】原来的顺序是「机器初判 → 玩家勾选名单 → 扫描时才 AI 分类」，
 * 而 buildPersonGroups 最后有一道 selected 过滤——玩家勾的名单在分类之前就定死了，
 * 于是 AI 认出「血角」「三霄」是人也进不了阶段 2，白认一场。
 * 把这一步提前单独跑，玩家就是在已经分好的名单上勾选。
 *
 * 结果写进同一个缓存槽（stage 1），所以之后点「扫一遍」不会重复调用，总预算不变。
 *
 * @returns {{stage1, kindMap:Map<number,string>, whyMap:Map<number,string>,
 *            genre:string, groups:Array, multiPerson:Array, calls:number}}
 */
export async function runClassify(parsed, callModel, cfg, opts = {}) {
  const { card } = parsed;
  const md5 = store.fingerprintCard(card);
  const ctx = {
    onProgress: opts.onProgress,
    onWait: opts.onWait,
    signal: opts.signal || { aborted: false },
  };

  let stage1 = opts.skipCache ? null : store.loadStage(md5, 1);
  let calls = 0;
  if (!stage1) {
    ctx.onProgress?.({ kind: "start", stage: 1, msg: `通读 ${card.entries.length} 条正文，认人与归类` });
    const built = buildStage1(card, card.entries);
    stage1 = await callWithRetry(callModel, cfg, built, opts, ctx);
    calls = 1;
    store.saveStage(md5, 1, stage1);
  } else {
    ctx.onProgress?.({ kind: "info", stage: 1, msg: "这张卡认过了，直接用上次的结果" });
  }

  const kindMap = new Map();
  const whyMap = new Map();
  for (const item of (stage1?.条目 || [])) {
    if (!Number.isInteger(item.i) || !card.entries[item.i]) continue;
    if (!item.kind) continue;
    kindMap.set(item.i, item.kind);
    whyMap.set(item.i, String(item.why || "").slice(0, 24));
  }

  // 把结果落到条目上，UI 与后续阶段都从这里读
  for (const e of card.entries) {
    if (kindMap.has(e.index)) {
      e.kindByAi = kindMap.get(e.index);
      e.kindWhy = whyMap.get(e.index) || "";
    }
  }

  return {
    stage1,
    kindMap, whyMap, calls,
    genre: String(stage1?.题材 || "").slice(0, 30),
    groups: Array.isArray(stage1?.同人分组) ? stage1.同人分组 : [],
    multiPerson: (Array.isArray(stage1?.多人条目) ? stage1.多人条目 : [])
      .filter(m => Number.isInteger(m.i) && card.entries[m.i]),
  };
}

/**
 * 拿分类结果重算「谁是人」。返回的是可直接喂给勾选界面的人物候选。
 * AI 认的优先于机器初判；AI 没表态的条目沿用机器初判。
 */
export function peopleAfterClassify(parsed, kindMap, groups) {
  const kindOverride = kindMap instanceof Map ? kindMap : new Map();
  const people = buildPersonGroups(parsed, { 同人分组: groups || [] }, kindOverride, null);
  // entry 必须带上：调用方（跳过 AI 直接手填那条路）要拿它当人设正文。
  // 只返回 name/len 的话，手填出来的 NPC 会是一个没有任何设定的空壳。
  return people.map(p => ({
    name: p.name,
    aliases: p.aliases,
    entry: p.entry || "",
    len: (p.entry || "").length,
    merged: (p._parts || []).length,
    mergedFrom: p._parts || [],
    from: p._from,          // "ai" = AI 认的同人组，"code" = 按 keys 归的
  }));
}

// ── 单次调用封装 ──────────────────────────────────────────────────────────────

/**
 * 取令牌 → 调模型 → 解析。失败按 code 决定是否重试。
 * 重试也要重新取令牌（重试同样消耗真实额度，不能白嫖）。
 */
async function callOnce(callModel, cfg, built, opts, ctx) {
  const { onWait, signal } = ctx;
  await acquire(onWait, signal);

  const messages = [{ role: "user", content: built.user }];
  const res = await callModel(cfg, built.system, messages, {
    maxTokens: STAGE_MAX_TOKENS[built.stage] || 2000,
    temperature: opts.temperature ?? 0.3,   // 抽取任务要稳，不要发散
    jsonOnly: !built.plainText,             // apiConfig 的 Gemini 分支据此加 responseMimeType
  });

  if (built.plainText) return (res.text || "").trim();
  return parseJsonLoose(res.text);
}

/**
 * 带一次重试的调用。第二次会在提示词末尾追加一句纠正，专治"上次没输出合法 JSON"。
 * 只重试解析类失败；网络类错误交给上层降级——在 5 次/分钟下反复重试网络问题
 * 是在烧额度，不如直接走兜底。
 */
async function callWithRetry(callModel, cfg, built, opts, ctx) {
  try {
    return await callOnce(callModel, cfg, built, opts, ctx);
  } catch (err) {
    if (err.code === "SCAN_ABORTED") throw err;
    // NOT_JSON 不重试：模型压根没在输出 JSON，再问一遍还是一样，纯烧额度。
    // 只有 TRUNCATED（在输出 JSON 但被截断）和 EMPTY（空回复）值得再试一次。
    if (err.code !== "TRUNCATED" && err.code !== "EMPTY") throw err;
    ctx.onProgress?.({ kind: "retry", stage: built.stage, msg: "上次输出不是合法 JSON，重试一次" });
    const fixed = {
      ...built,
      system: built.system + `\n\n【重要】上一次你的输出无法被解析。这一次务必只输出一个完整的 JSON 对象，`
        + `第一个字符是 {，最后一个字符是 }，中间不要有任何围栏、注释或说明文字。`,
    };
    return await callOnce(callModel, cfg, fixed, opts, ctx);
  }
}

// ── 阶段 2 的人物分组 ─────────────────────────────────────────────────────────

/**
 * 合并两个分组来源：
 *   · 代码分组（groupEntriesByKeys）：按 keys 完全相同归组，可靠但只认 keys
 *   · AI 分组（阶段 1 的"同人分组"）：能认出 keys 不同、但正文写的是同一人的情况
 * AI 分组优先，代码分组补漏。
 */
function buildPersonGroups(parsed, stage1, kindOverride, selected) {
  const entries = parsed.card.entries;
  // 【player 条目硬排除】玩家自己绝不能变成一个 NPC。这里用代码初判的 kind，
  // 不看 AI 的覆盖——实测 AI 把整卡条目全判成 person 时，玩家的 <user> 设定条目
  // 会被展开成玩家名字，然后作为一个叫"陈狐飞"的 NPC 混进人物列表。
  const usable = entries.filter(e =>
    !e.dead && !e.flags.includes("TOO_LONG") && e.content && e.kind !== "player");

  // 用 AI 的最终 kind 覆盖代码初判
  const kindOf = (e) => kindOverride?.get(e.index) ?? e.kind;

  const claimed = new Set();
  const groups = [];

  // 先按 AI 的同人分组建组
  for (const g of (stage1?.同人分组 || [])) {
    const idxs = (g.条目 || []).filter(i => Number.isInteger(i) && entries[i]);
    const parts = idxs.map(i => entries[i]).filter(e => usable.includes(e));
    if (!parts.length) continue;
    const keys = Array.from(new Set(parts.flatMap(p => p.keys)));
    // AI 给的人名优先当本名，它比 keys[0] 更可能是真名
    const name = String(g.人名 || "").trim() || keys[0];
    if (!name) continue;
    for (const p of parts) claimed.add(p.index);
    groups.push({
      name,
      keys: [name, ...keys.filter(k => k !== name)],
      parts: parts.slice().sort((a, b) => a.order - b.order),
      merged: parts.length > 1,
      from: "ai",
    });
  }

  // 代码分组补漏：AI 没认领的 person 条目
  const rest = usable.filter(e => !claimed.has(e.index) && e.keys.length && kindOf(e) === "person");
  for (const g of groupEntriesByKeys(rest)) {
    const lore = groupToNpcLore(g, { includeNsfw: false });
    if (!lore) continue;
    groups.push({
      name: lore.name,
      keys: g.keys,
      parts: g.parts,
      merged: g.merged,
      from: "code",
    });
  }

  const picked = selected && selected.length
    ? groups.filter(g => selected.includes(g.name))
    : groups;

  return picked.map(g => ({
    name: g.name,
    aliases: g.keys.filter(k => k !== g.name),
    entry: g.parts.length > 1
      ? g.parts.map(p => `【${p.label}】\n${p.content}`).join("\n")
      : g.parts[0].content,
    _parts: g.parts.map(p => p.label),
    _from: g.from,
  }));
}

// ── 主流程 ────────────────────────────────────────────────────────────────────

/**
 * 跑完整扫描。
 * @param {object} parsed parseCharacterCard 的返回值
 * @param {Function} callModel apiConfig.js 的 callModel，注入进来便于测试替换
 * @param {object} cfg apiConfig
 * @param {object} opts { playerName, asPlayer, batchSize, temperature, onProgress, onWait, signal, skipCache }
 */
export async function runScan(parsed, callModel, cfg, opts = {}) {
  const { card } = parsed;
  const md5 = store.fingerprintCard(card);
  const playerName = opts.playerName || "少侠";
  const asPlayer = !!opts.asPlayer;
  const ctx = {
    onProgress: opts.onProgress,
    onWait: opts.onWait,
    signal: opts.signal || { aborted: false },
  };
  const report = { calls: 0, failures: [], fromCache: [] };

  if (opts.skipCache) store.clearCard(md5);
  store.saveCardMeta(md5, { name: card.name, entries: card.entries.length, bookName: card.bookName });

  // ── 阶段 1 ──
  let stage1 = store.loadStage(md5, 1);
  if (stage1) {
    report.fromCache.push("stage1");
  } else {
    ctx.onProgress?.({ kind: "start", stage: 1, msg: "通读全部条目，判断归类与分组" });
    try {
      const built = buildStage1(card, card.entries);
      stage1 = await callWithRetry(callModel, cfg, built, opts, ctx);
      report.calls++;
      store.saveStage(md5, 1, stage1);
    } catch (err) {
      if (err.code === "SCAN_ABORTED") throw err;
      report.failures.push({ stage: 1, msg: err.message });
      ctx.onProgress?.({ kind: "fail", stage: 1, msg: `归类失败，改用机器初判：${err.message}` });
      stage1 = null;   // 降级：完全用 cardParse 的 KIND_RULES 结果
    }
  }

  // 把 AI 的 kind 落回条目上（保留机器初判作对照，供 UI 显示"AI 改了这条"）
  const kindOverride = new Map();
  for (const item of (stage1?.条目 || [])) {
    if (!Number.isInteger(item.i) || !card.entries[item.i]) continue;
    const e = card.entries[item.i];
    if (item.kind && item.kind !== e.kind) {
      kindOverride.set(item.i, item.kind);
      e.kindByAi = item.kind;
      e.kindWhy = String(item.why || "").slice(0, 20);
    }
  }
  const genre = String(stage1?.题材 || "").slice(0, 30);
  const multiPerson = (stage1?.多人条目 || []).filter(m => Number.isInteger(m.i) && card.entries[m.i]);

  // ── 阶段 2 ──
  // opts.selectedPeople：阶段 1 出来后让玩家勾选要换算哪些人，再跑阶段 2。
  // 不传就全跑。这是省额度最有效的一招——AI 判错几条，玩家取消勾选即可，
  // 不必为一个判错的"礼仪"条目花掉四分之一的批次。
  const people = buildPersonGroups(parsed, stage1, kindOverride, opts.selectedPeople);
  const batchSize = opts.batchSize || DEFAULT_BATCH_SIZE;
  const batches = [];
  for (let i = 0; i < people.length; i += batchSize) batches.push(people.slice(i, i + batchSize));

  const npcs = [];
  // 熔断标志：一旦判定"这个模型/这个反代不吐 JSON"，剩余批次全部直接走兜底。
  // 没有这道闸，一张 3 批的卡在模型不听话时会烧掉 21 次调用（实测），而预算只有 4 次。
  let jsonBroken = false;
  let notJsonHits = 0;

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    const cached = store.loadStage(md5, 2, bi);
    if (cached) {
      report.fromCache.push(`stage2:${bi}`);
      npcs.push(...cached);
      continue;
    }
    if (jsonBroken) {
      const got = batch.map(p => fallbackNpc(p, playerName));
      store.saveStage(md5, 2, got, bi);
      npcs.push(...got);
      continue;
    }
    ctx.onProgress?.({
      kind: "start", stage: 2, batch: bi, total: batches.length,
      msg: `换算人物数据：${batch.map(p => p.name).join("、")}`,
    });

    let got = null;
    // 降级链只有两级，而且只在"疑似被截断"时才降。
    // 【为什么不无脑拆到 1 人】拆小只能解决输出长度问题。如果模型压根不吐 JSON，
    // 拆一百次也一样——那种情况直接熔断，把额度留给还没扫的卡。
    try {
      const built = buildStage2(batch, { playerName, genre });
      const out = await callWithRetry(callModel, cfg, built, opts, ctx);
      report.calls++;
      got = normalizeStage2(out, batch, playerName);
    } catch (err) {
      if (err.code === "SCAN_ABORTED") throw err;
      report.failures.push({ stage: 2, batch: bi, size: batch.length, code: err.code, msg: err.message });

      if (err.code === "NOT_JSON") {
        notJsonHits++;
        // 两次就够判断了。第一次可能是运气，第二次说明这条链路就是不吐 JSON。
        if (notJsonHits >= 2) {
          jsonBroken = true;
          ctx.onProgress?.({
            kind: "fail", stage: 2, batch: bi,
            msg: "模型连续两批都没输出 JSON，停止调用，剩下的全用默认值（额度留着别浪费）",
          });
        } else {
          ctx.onProgress?.({ kind: "fail", stage: 2, batch: bi, msg: `这批没出 JSON，改用默认值：${err.message}` });
        }
      } else if (err.code === "TRUNCATED" && batch.length > 1) {
        // 确实在输出 JSON 只是太长 → 拆成两半重跑，这一步值得花额度
        ctx.onProgress?.({ kind: "fail", stage: 2, batch: bi, msg: "输出被截断，拆成两半重试" });
        try {
          const half = Math.ceil(batch.length / 2);
          const acc = [];
          for (let i = 0; i < batch.length; i += half) {
            const sub = batch.slice(i, i + half);
            const built = buildStage2(sub, { playerName, genre });
            const out = await callWithRetry(callModel, cfg, built, opts, ctx);
            report.calls++;
            acc.push(...normalizeStage2(out, sub, playerName));
          }
          got = acc;
        } catch (err2) {
          if (err2.code === "SCAN_ABORTED") throw err2;
          report.failures.push({ stage: 2, batch: bi, size: 1, code: err2.code, msg: err2.message });
          ctx.onProgress?.({ kind: "fail", stage: 2, batch: bi, msg: `拆小后仍失败，改用默认值：${err2.message}` });
        }
      } else {
        ctx.onProgress?.({ kind: "fail", stage: 2, batch: bi, msg: `这批失败，改用默认值：${err.message}` });
      }
    }

    if (!got) got = batch.map(p => fallbackNpc(p, playerName));
    store.saveStage(md5, 2, got, bi);   // 拿到就存，不攒
    npcs.push(...got);
  }

  // ── 阶段 3 ──
  let player = null;
  if (asPlayer) {
    player = store.loadStage(md5, 3);
    if (player) {
      report.fromCache.push("stage3");
    } else {
      const sources = [
        parsed.personaCandidate,
        card.fields.description,
      ].filter(Boolean).join("\n\n");
      if (sources.trim()) {
        ctx.onProgress?.({ kind: "start", stage: 3, msg: "拆出体貌（公开＋私密）与天赋" });
        try {
          const built = buildStage3(sources, { cardName: card.name });
          const out = await callWithRetry(callModel, cfg, built, opts, ctx);
          report.calls++;
          player = normalizeStage3(out);
          store.saveStage(md5, 3, player);
        } catch (err) {
          if (err.code === "SCAN_ABORTED") throw err;
          report.failures.push({ stage: 3, msg: err.message });
          ctx.onProgress?.({ kind: "fail", stage: 3, msg: `体貌抽取失败，留空由你手填：${err.message}` });
          player = fallbackPlayer();
        }
      } else {
        player = fallbackPlayer();
      }
    }
  }

  // ── 阶段 4 ──
  let opening = null;
  if (asPlayer && (card.openings || []).length) {
    opening = store.loadStage(md5, 4);
    if (opening) {
      report.fromCache.push("stage4");
    } else {
      const idx = Number.isInteger(opts.openingIndex) ? opts.openingIndex : 0;
      const text = card.openings[idx];
      if (text) {
        ctx.onProgress?.({ kind: "start", stage: 4, msg: "把开场白改成本作的人称与文体" });
        try {
          const built = buildStage4(text, { playerName });
          const out = await callWithRetry(callModel, cfg, built, opts, ctx);
          report.calls++;
          opening = { index: idx, original: text, rewritten: out, source: "ai" };
          store.saveStage(md5, 4, opening);
        } catch (err) {
          if (err.code === "SCAN_ABORTED") throw err;
          report.failures.push({ stage: 4, msg: err.message });
          ctx.onProgress?.({ kind: "fail", stage: 4, msg: `改写失败，保留原文：${err.message}` });
          opening = { index: idx, original: text, rewritten: text, source: "original" };
        }
      }
    }
  }

  ctx.onProgress?.({ kind: "done", msg: `扫描完成，实际调用 ${report.calls} 次` });

  return { md5, genre, npcs, player, opening, multiPerson, report, people };
}

// ── 结果清洗 ──────────────────────────────────────────────────────────────────

// AI 输出一律过一遍清洗：数值钳到合法区间、字段截长度、缺项补兜底。
// 每条带 source 标记，UI 据此显示"AI 抽的"还是"默认值"。
function normalizeStage2(out, batch, playerName) {
  const arr = Array.isArray(out?.人物) ? out.人物 : (Array.isArray(out) ? out : []);
  return batch.map((p, i) => {
    const raw = arr.find(x => Number(x?.i) === i) || arr[i] || null;
    if (!raw) return fallbackNpc(p, playerName);
    const brief = sanitizeBrief(raw.brief);
    const levelCap = sanitizeLevelCap(raw.levelCap);
    return {
      name: p.name,
      aliases: p.aliases,
      // entry 是真正注入给说书人的那段，走 AI 重写的凝练版；AI 没出到就拿原卡
      // 正文清洗后顶上（比整段三千字灌进去好，但会残留第二人称，UI 会标出来）。
      // rawEntry 保留原卡正文一字不动，只在审改界面给玩家对照，不进任何 prompt。
      entry: sanitizeLore(raw.人设, { playerName, charName: p.name })
        || sanitizeLore(p.entry, { playerName, charName: p.name }),
      entryFromAi: !!String(raw.人设 || "").trim(),
      rawEntry: p.entry || "",
      brief: brief || sanitizeBrief(p._parts?.[0]) || p.name,
      briefWhy: String(raw.brief_why || "").slice(0, 20),
      levelCap,
      levelCapWhy: String(raw.levelCap_why || "").slice(0, 20),
      special: sanitizeSpecial(raw.special),
      specialWhy: String(raw.special_why || "").slice(0, 20),
      neigong: sanitizeGongfu(raw.neigong, levelCap),
      waigong: sanitizeGongfu(raw.waigong, levelCap),
      gongfuWhy: String(raw.neiwai_why || "").slice(0, 20),
      moves: sanitizeMoves(raw.moves, levelCap),
      movesWhy: String(raw.moves_why || "").slice(0, 20),
      carry: [],          // 卡里没有随身物，默认空 → 运行时走 rollNpcCarry 四池兜底
      portrait: "",       // 立绘由玩家在审改界面挑
      appearance: String(raw.外貌锚点 || "").slice(0, 100),
      attitude: String(raw.初始态度 || "").slice(0, 50),
      affection: sanitizeAffection(raw.好感初值),
      affectionWhy: String(raw.好感初值_why || "").slice(0, 20),
      milestones: sanitizeMilestones(raw.里程碑),
      mergedFrom: p._parts,
      groupedBy: p._from,
      source: "ai",
    };
  });
}

function fallbackNpc(p, playerName) {
  return {
    name: p.name,
    aliases: p.aliases,
    // AI 整批失败，没有凝练版可用，只能拿原卡正文清洗后顶上
    entry: sanitizeLore(p.entry, { playerName, charName: p.name }),
    entryFromAi: false,
    rawEntry: p.entry || "",
    brief: sanitizeBrief(p._parts?.[0]) || p.name,
    briefWhy: "",
    levelCap: FALLBACK_LEVEL_CAP,
    levelCapWhy: "",
    special: { ...FALLBACK_SPECIAL },
    specialWhy: "",
    neigong: sanitizeGongfu(null, FALLBACK_LEVEL_CAP),
    waigong: sanitizeGongfu(null, FALLBACK_LEVEL_CAP),
    gongfuWhy: "",
    moves: sanitizeMoves(null, FALLBACK_LEVEL_CAP),
    movesWhy: "",
    carry: [],
    portrait: "",
    appearance: "",
    attitude: "",
    affection: 0,
    affectionWhy: "",
    milestones: FALLBACK_MILESTONES.map(m => ({ ...m })),
    mergedFrom: p._parts,
    groupedBy: p._from,
    source: "fallback",
  };
}

function normalizeStage3(out) {
  const bp = {};
  for (const k of BODY_PUBLIC_KEYS) {
    bp[k] = String(out?.bodyProfile?.[k] || "").slice(0, 40);
  }
  const bpPriv = {};
  for (const k of BODY_PRIVATE_KEYS) {
    bpPriv[k] = String(out?.bodyProfilePrivate?.[k] || "").slice(0, 40);
  }
  return {
    name: String(out?.name || "").slice(0, 12),
    nameWhy: String(out?.name_why || "").slice(0, 20),
    bodyProfile: bp,
    bodyProfilePrivate: bpPriv,
    special: sanitizeSpecial(out?.special),
    specialWhy: String(out?.special_why || "").slice(0, 20),
    persona: String(out?.persona || "").slice(0, 200),
    missing: [...BODY_PUBLIC_KEYS.filter(k => !bp[k]), ...BODY_PRIVATE_KEYS.filter(k => !bpPriv[k])],
    source: "ai",
  };
}

function fallbackPlayer() {
  const bp = {};
  for (const k of BODY_PUBLIC_KEYS) bp[k] = "";
  const bpPriv = {};
  for (const k of BODY_PRIVATE_KEYS) bpPriv[k] = "";
  return {
    name: "", nameWhy: "",
    bodyProfile: bp,
    bodyProfilePrivate: bpPriv,
    special: { ...FALLBACK_SPECIAL }, specialWhy: "",
    persona: "",
    missing: [...BODY_PUBLIC_KEYS, ...BODY_PRIVATE_KEYS],
    source: "fallback",
  };
}
