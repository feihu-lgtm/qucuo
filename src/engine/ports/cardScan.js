// 导卡扫卡编排：四阶段扫描管线 + 预切模板直出（从 cardScan.js 主体保留）。
// 阶段1 骨架+六字段  阶段2 分批抽 NPC  阶段3 主角/主角定  阶段4 单条物理层条目
// 智能模型力尽的回合：fetch 检测 + 预算规划，预切模板直出兜底。

import * as store from "../../infra/scanStore.js";
import { estimateMs, bucketStatus } from "../../domain/rules/cards/rateLimiter.js";
import { buildStage1, buildStage2, buildStage3, buildStage4 } from "../../domain/rules/cards/scanPrompts.js";
import { callWithRetry } from "./cardScan/scanCalls.js";
import { buildPersonGroups } from "./cardScan/personGroups.js";
import { normalizeStage2, fallbackNpc, normalizeStage3, fallbackPlayer } from "./cardScan/scanNormalize.js";

const DEFAULT_BATCH_SIZE = 4;

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
