import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractTerms, segmentToSpaceString } from "./ftsTokenizer.mjs";
import { createHubStore } from "./hubCore.mjs";
import { createHubServer, _resetWriteRateBuckets } from "./server.mjs";

describe("ftsTokenizer", () => {
  it("extracts 2-4 char Chinese n-grams, filters stop words, and keeps long names and ASCII", () => {
    const terms = extractTerms("少侠在客栈见到了旁白中的赫连铸，递出「衔尾蛇门环」A2信物");
    assert.equal(terms.has("少侠"), false);
    assert.equal(terms.has("旁白"), false);
    assert.equal(terms.has("赫连铸"), true);
    assert.equal(terms.has("衔尾蛇门环"), true);
    assert.equal(terms.has("门环"), true);
    assert.equal(terms.has("a2"), true);
    const joined = segmentToSpaceString("阿青递来羊皮卷", ["阿青"]);
    assert.ok(joined.includes("阿青"));
    assert.ok(joined.includes("羊皮卷"));
  });
});

describe("hubCore saves and optimistic rev concurrency", () => {
  it("increments rev on valid write and returns 409 on stale expectedRev without overwriting", () => {
    const store = createHubStore(":memory:");
    const first = store.putSave("space_1", "slot_auto", { expectedRev: 0, payloadEnc: "enc_v1", updatedAt: 100 });
    assert.deepEqual(first, { ok: true, status: 200, spaceId: "space_1", slotId: "slot_auto", rev: 1, updatedAt: 100 });

    const second = store.putSave("space_1", "slot_auto", { expectedRev: 1, payloadEnc: "enc_v2", updatedAt: 200 });
    assert.equal(second.rev, 2);

    const conflict = store.putSave("space_1", "slot_auto", { expectedRev: 1, payloadEnc: "stale_write", updatedAt: 300 });
    assert.equal(conflict.ok, false);
    assert.equal(conflict.status, 409);
    assert.equal(conflict.currentRev, 2);
    assert.equal(store.getSave("space_1", "slot_auto").payloadEnc, "enc_v2");
    store.close();
  });
});

describe("hubCore prose_chunks idempotency, FTS5 + vector RRF, and neighbor expansion", () => {
  it("deduplicates retried batches via UNIQUE(space_id, batch_id, chunk_id)", () => {
    const store = createHubStore(":memory:");
    const batch = [
      { chunkId: "b1_5_1", turn: 5, location: "鱼定村", witnesses: ["主角", "才旦"], entities: ["才旦"], rawText: "才旦擦拭着猎刀。" },
      { chunkId: "b1_5_2", turn: 5, location: "鱼定村", witnesses: ["主角", "才旦"], entities: ["才旦"], rawText: "门口铜铃轻响。" },
    ];
    const r1 = store.appendProseChunks("space_1", "batch_1", batch);
    const r2 = store.appendProseChunks("space_1", "batch_1", batch);
    assert.equal(r1.inserted, 2);
    assert.equal(r2.inserted, 0);
    store.close();
  });

  it("filters by space/turn/witnesses, ranks via FTS5 BM25 + embedding cosine RRF, and attaches ±1 neighbors", () => {
    const store = createHubStore(":memory:");
    store.appendProseChunks("space_1", "batch_a", [
      { chunkId: "b1_3_1", turn: 3, location: "鱼定村", witnesses: ["主角", "才旦"], entities: ["才旦"], rawText: "前段铺垫：晨雾未散，才旦在石阶旁生火。", embedding: [0.9, 0.1], embeddingModel: "emb-v1" },
      { chunkId: "b1_3_2", turn: 3, location: "鱼定村", witnesses: ["主角", "才旦"], entities: ["才旦", "赫连铸"], rawText: "赫连铸把一枚衔尾蛇门环塞进暗格。", embedding: [0.95, 0.05], embeddingModel: "emb-v1" },
      { chunkId: "b1_3_3", turn: 3, location: "鱼定村", witnesses: ["主角", "才旦"], entities: ["才旦"], rawText: "后段收尾：他压低嗓音叮嘱莫声张。", embedding: [0.85, 0.15], embeddingModel: "emb-v1" },
      { chunkId: "b1_3_4", turn: 3, location: "鱼定村", witnesses: ["主角", "白狼"], entities: ["赫连铸"], rawText: "私密对话：赫连铸另有秘令，但才旦当时不在场。", embedding: [1, 0], embeddingModel: "emb-v1" },
      { chunkId: "b1_9_1", turn: 9, location: "鱼定村", witnesses: ["*"], entities: ["赫连铸"], rawText: "未来回合：赫连铸现身。", embedding: [1, 0], embeddingModel: "emb-v1" },
    ]);
    store.appendProseChunks("space_2", "batch_other", [
      { chunkId: "b2_3_1", turn: 3, location: "鱼定村", witnesses: ["*"], entities: ["赫连铸"], rawText: "串档数据：赫连铸在此。", embedding: [1, 0], embeddingModel: "emb-v1" },
    ]);

    const res = store.queryProseChunks("space_1", {
      query: "赫连铸",
      viewer: "才旦",
      maxTurn: 5,
      queryEmbedding: [1, 0],
      queryEmbeddingModel: "emb-v1",
      topK: 2,
      neighborRadius: 1,
    });
    assert.equal(res.hits[0].chunkId, "b1_3_2");
    const returnedIds = res.results.map((r) => r.chunkId);
    assert.deepEqual(returnedIds, ["b1_3_1", "b1_3_2", "b1_3_3"]);
    assert.equal(returnedIds.includes("b1_3_4"), false);
    assert.equal(returnedIds.includes("b1_9_1"), false);
    assert.equal(returnedIds.includes("b2_3_1"), false);
    store.close();
  });
});

describe("向量模型/维度元数据过滤", () => {
  it("不同 model/dim 不参与向量排序但 FTS 仍可召回；无元数据旧行只做关键词", () => {
    const store = createHubStore(":memory:");
    store.appendProseChunks("space_1", "batch_m", [
      // 同模型同维度：应参与向量
      { chunkId: "m_1_1", turn: 1, witnesses: ["*"], entities: [], rawText: "同模型段落提到青铜印。", embedding: [1, 0], embeddingModel: "emb-v1" },
      // 不同模型：向量不参与，但 rawText 有关键词应走 FTS
      { chunkId: "m_1_2", turn: 1, witnesses: ["*"], entities: [], rawText: "异模型段落也提到青铜印。", embedding: [1, 0], embeddingModel: "emb-v2" },
      // 同模型不同维度：不参与向量
      { chunkId: "m_1_3", turn: 1, witnesses: ["*"], entities: [], rawText: "异维度段落无关键词。", embedding: [1, 0, 0], embeddingModel: "emb-v1", embeddingDim: 3 },
      // 无元数据旧行：只做关键词
      { chunkId: "m_1_4", turn: 1, witnesses: ["*"], entities: [], rawText: "旧行无元数据提到青铜印。", embedding: [1, 0] },
    ]);

    // 向量相似度只有 m_1_1 合格；FTS 命中 m_1_1/m_1_2/m_1_4
    const res = store.queryProseChunks("space_1", {
      query: "青铜印",
      viewer: "主角",
      queryEmbedding: [1, 0],
      queryEmbeddingModel: "emb-v1",
      topK: 10,
      neighborRadius: 0,
    });
    const byId = new Map(res.hits.map((h) => [h.chunkId, h]));
    // 异模型/无元数据行 similarity 必须为 null（未参与向量排序）
    assert.equal(byId.get("m_1_1").similarity > 0, true);
    assert.equal(byId.get("m_1_2")?.similarity ?? null, null);
    assert.equal(byId.get("m_1_4")?.similarity ?? null, null);
    // 但 FTS 仍召回它们（bm25 非 null）
    assert.equal(typeof byId.get("m_1_2")?.bm25, "number");
    assert.equal(typeof byId.get("m_1_4")?.bm25, "number");
    // 异维度行无关键词、也不进向量 → 不出现
    assert.equal(byId.has("m_1_3"), false);

    // 换模型查询：emb-v1 的向量全部不参与
    const res2 = store.queryProseChunks("space_1", {
      query: "青铜印",
      viewer: "主角",
      queryEmbedding: [1, 0],
      queryEmbeddingModel: "emb-v2",
      topK: 10,
      neighborRadius: 0,
    });
    const byId2 = new Map(res2.hits.map((h) => [h.chunkId, h]));
    assert.equal(byId2.get("m_1_1")?.similarity ?? null, null);
    assert.equal(byId2.get("m_1_2")?.similarity > 0, true);

    // 未申报模型：向量整体关闭，FTS 照常
    const res3 = store.queryProseChunks("space_1", {
      query: "青铜印",
      viewer: "主角",
      queryEmbedding: [1, 0],
      topK: 10,
      neighborRadius: 0,
    });
    assert.equal(res3.hits.every((h) => h.similarity === null), true);
    assert.equal(res3.hits.length >= 3, true);
    store.close();
  });
});

describe("force 语义、单槽删除与 serverRev 别名", () => {
  it("PUT force:true 跳过 rev 冲突覆盖；409 带 serverRev 别名", () => {
    const store = createHubStore(":memory:");
    store.putSave("sp", "s1", { expectedRev: 0, payloadEnc: "v1", updatedAt: 1 });
    store.putSave("sp", "s1", { expectedRev: 1, payloadEnc: "v2", updatedAt: 2 });
    //  stale expectedRev → 409 且同时给 serverRev/currentRev
    const conflict = store.putSave("sp", "s1", { expectedRev: 1, payloadEnc: "stale", updatedAt: 3 });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.serverRev, 2);
    assert.equal(conflict.currentRev, 2);
    // force 覆盖：rev 单调递增到 3，payload 被替换
    const forced = store.putSave("sp", "s1", { expectedRev: 99, payloadEnc: "v3", updatedAt: 4, force: true });
    assert.equal(forced.ok, true);
    assert.equal(forced.rev, 3);
    assert.equal(store.getSave("sp", "s1").payloadEnc, "v3");
    store.close();
  });

  it("DELETE 单槽：rev 冲突 409、force 强删、无存档幂等成功", () => {
    const store = createHubStore(":memory:");
    store.putSave("sp", "s1", { expectedRev: 0, payloadEnc: "v1", updatedAt: 1 });
    const conflict = store.deleteSave("sp", "s1", { expectedRev: 5 });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.serverRev, 1);
    assert.equal(store.getSave("sp", "s1") !== null, true);
    const forced = store.deleteSave("sp", "s1", { force: true });
    assert.equal(forced.deleted, 1);
    assert.equal(store.getSave("sp", "s1"), null);
    const again = store.deleteSave("sp", "s1", { force: true });
    assert.equal(again.deleted, 0);
    assert.equal(again.idempotent, true);
    store.close();
  });
});

describe("prose seq 列邻段（导入戳/下划线 branchId 不断邻段）", () => {
  it("seq 列优先于 chunkId 拆尾：带导入戳后缀与下划线 branchId 的 id 邻段照常", () => {
    const store = createHubStore(":memory:");
    // branchId 含下划线 + 导入戳后缀：拆尾段完全不可靠（尾段是 impXXX 或乱序数字）
    store.appendProseChunks("sp", "batch_seq", [
      { chunkId: "b_root_x_3_1_impabc", turn: 3, seq: 1, witnesses: ["*"], entities: [], rawText: "邻段一：晨雾。" },
      { chunkId: "b_root_x_3_2_impabc", turn: 3, seq: 2, witnesses: ["*"], entities: [], rawText: "邻段二：青铜印现世。" },
      { chunkId: "b_root_x_3_3_impabc", turn: 3, seq: 3, witnesses: ["*"], entities: [], rawText: "邻段三：人声渐起。" },
      { chunkId: "b_root_x_3_9_impabc", turn: 3, seq: 9, witnesses: ["*"], entities: [], rawText: "远段：不该被连带。" },
    ]);
    const res = store.queryProseChunks("sp", {
      query: "青铜印",
      viewer: "主角",
      topK: 1,
      neighborRadius: 1,
    });
    const ids = res.results.map((r) => r.chunkId);
    assert.equal(ids.includes("b_root_x_3_1_impabc"), true);
    assert.equal(ids.includes("b_root_x_3_2_impabc"), true);
    assert.equal(ids.includes("b_root_x_3_3_impabc"), true);
    assert.equal(ids.includes("b_root_x_3_9_impabc"), false);
    store.close();
  });
});

describe("时间线谱系过滤（branchVisible 同口径）", () => {
  it("lineage+currentTurn 传入时：旧未来/别分支/无 branchId 一律不可见，seq 边界生效", () => {
    const store = createHubStore(":memory:");
    store.appendProseChunks("sp", "batch_tl", [
      // 头分支 b_head（upTo:null）：turn<=currentTurn 可见
      { chunkId: "x1", turn: 5, seq: 1, branchId: "b_head", witnesses: ["*"], entities: [], rawText: "头分支历史提到青铜印。" },
      { chunkId: "x2", turn: 8, seq: 2, branchId: "b_head", witnesses: ["*"], entities: [], rawText: "头分支未来提到青铜印。" },
      // 非头分支 b_old（upTo:6, upToSeq:3）
      { chunkId: "x3", turn: 5, seq: 1, branchId: "b_old", witnesses: ["*"], entities: [], rawText: "旧分支截断前提到青铜印。" },
      { chunkId: "x4", turn: 6, seq: 3, branchId: "b_old", witnesses: ["*"], entities: [], rawText: "旧分支边界seq3提到青铜印。" },
      { chunkId: "x5", turn: 6, seq: 4, branchId: "b_old", witnesses: ["*"], entities: [], rawText: "旧分支被撤seq4提到青铜印。" },
      { chunkId: "x6", turn: 7, seq: 5, branchId: "b_old", witnesses: ["*"], entities: [], rawText: "旧分支被撤未来提到青铜印。" },
      // 谱系外分支
      { chunkId: "x7", turn: 5, seq: 1, branchId: "b_other", witnesses: ["*"], entities: [], rawText: "别分支提到青铜印。" },
      // 无 branchId
      { chunkId: "x8", turn: 5, seq: 1, witnesses: ["*"], entities: [], rawText: "无branchId提到青铜印。" },
    ]);
    const lineage = [
      { b: "b_old", upTo: 6, upToSeq: 3 },
      { b: "b_head", upTo: null },
    ];
    const res = store.queryProseChunks("sp", {
      query: "青铜印", viewer: "主角", lineage, currentTurn: 6, topK: 20, neighborRadius: 0,
    });
    const ids = res.results.map((r) => r.chunkId);
    assert.equal(ids.includes("x1"), true);  // 头分支 turn5<=6
    assert.equal(ids.includes("x2"), false); // 头分支 turn8>6 未来
    assert.equal(ids.includes("x3"), true);  // 旧分支 turn5<upTo6
    assert.equal(ids.includes("x4"), true);  // 旧分支 turn6=upTo seq3<=upToSeq3
    assert.equal(ids.includes("x5"), false); // seq4>upToSeq3 被撤
    assert.equal(ids.includes("x6"), false); // turn7>upTo6
    assert.equal(ids.includes("x7"), false); // 谱系外
    assert.equal(ids.includes("x8"), false); // 无 branchId
    store.close();
  });

  it("lineage 未传时退回 maxTurn 宽松路径（兼容老调用）", () => {
    const store = createHubStore(":memory:");
    store.appendProseChunks("sp", "batch_loose", [
      { chunkId: "y1", turn: 5, witnesses: ["*"], entities: [], rawText: "宽松路径提到青铜印。" },
    ]);
    const res = store.queryProseChunks("sp", { query: "青铜印", viewer: "主角", maxTurn: 9, topK: 5, neighborRadius: 0 });
    assert.equal(res.results.length, 1);
    store.close();
  });
});

describe("WO-20B1 谱系条件下推 SQL（cap 不再先截取）", () => {
  const lineage = [
    { b: "b_old", upTo: 6, upToSeq: 3 },
    { b: "b_head", upTo: null },
  ];

  it("别分支高评分副本挤满 cap 时，本分支低评分仍命中", () => {
    const store = createHubStore(":memory:");
    // 25 条别分支副本，关键词高频重复评分更高；topK=1 时 cap=max(4,20)=20，
    // 下推前 20 个候选全被别分支占满，本分支那条永远进不了 visibleById 过滤。
    const copies = [];
    for (let i = 0; i < 25; i++) {
      copies.push({ chunkId: `dup_${i}`, turn: 5, seq: i, branchId: "b_other", witnesses: ["*"], entities: [], rawText: "青铜印青铜印青铜印青铜印青铜印青铜印青铜印青铜印。" });
    }
    copies.push({ chunkId: "mine_1", turn: 5, seq: 1, branchId: "b_head", witnesses: ["*"], entities: [], rawText: "角落里静静躺着一枚青铜印。" });
    store.appendProseChunks("sp", "batch_cap", copies);
    const res = store.queryProseChunks("sp", {
      query: "青铜印", viewer: "主角", lineage, currentTurn: 6, topK: 1, neighborRadius: 0,
    });
    const ids = res.results.map((r) => r.chunkId);
    assert.deepEqual(ids, ["mine_1"]); // 本分支唯一可见命中——别分支 25 条全被 SQL 谱系滤掉
    store.close();
  });

  it("同 turn upToSeq 边界在 SQL 层生效：seq 边界内可见、超界不可见、无 seq 老数据兼容可见", () => {
    const store = createHubStore(":memory:");
    store.appendProseChunks("sp", "batch_seq", [
      { chunkId: "s_in", turn: 6, seq: 3, branchId: "b_old", witnesses: ["*"], entities: [], rawText: "边界内提到青铜印。" },
      { chunkId: "s_out", turn: 6, seq: 4, branchId: "b_old", witnesses: ["*"], entities: [], rawText: "越界提到青铜印。" },
      { chunkId: "s_legacy", turn: 6, branchId: "b_old", witnesses: ["*"], entities: [], rawText: "老数据无seq提到青铜印。" },
    ]);
    const res = store.queryProseChunks("sp", {
      query: "青铜印", viewer: "主角", lineage, currentTurn: 6, topK: 10, neighborRadius: 0,
    });
    const ids = res.results.map((r) => r.chunkId);
    assert.equal(ids.includes("s_in"), true);
    assert.equal(ids.includes("s_out"), false);
    assert.equal(ids.includes("s_legacy"), true); // seq IS NULL 兼容
    store.close();
  });

  it("无 branchId 在 SQL 层不可见（cap 也救不回来）", () => {
    const store = createHubStore(":memory:");
    store.appendProseChunks("sp", "batch_nobid", [
      { chunkId: "nobid_1", turn: 5, seq: 1, witnesses: ["*"], entities: [], rawText: "青铜印青铜印青铜印青铜印青铜印青铜印青铜印青铜印青铜印。" },
      { chunkId: "head_1", turn: 5, seq: 1, branchId: "b_head", witnesses: ["*"], entities: [], rawText: "角落一枚青铜印。" },
    ]);
    const res = store.queryProseChunks("sp", {
      query: "青铜印", viewer: "主角", lineage, currentTurn: 6, topK: 5, neighborRadius: 0,
    });
    const ids = res.results.map((r) => r.chunkId);
    assert.deepEqual(ids, ["head_1"]);
    store.close();
  });

  it("location+lineage 同 filter：跨地点同分支不可见、同地点别分支不可见", () => {
    const store = createHubStore(":memory:");
    store.appendProseChunks("sp", "batch_loc", [
      { chunkId: "loc_yes", turn: 5, seq: 1, branchId: "b_head", location: "客栈", witnesses: ["*"], entities: [], rawText: "客栈里提到青铜印。" },
      { chunkId: "loc_no", turn: 5, seq: 1, branchId: "b_head", location: "野外", witnesses: ["*"], entities: [], rawText: "野外提到青铜印青铜印青铜印青铜印。" },
      { chunkId: "loc_otherbranch", turn: 5, seq: 1, branchId: "b_other", location: "客栈", witnesses: ["*"], entities: [], rawText: "客栈别分支青铜印青铜印青铜印。" },
    ]);
    const res = store.queryProseChunks("sp", {
      query: "青铜印", viewer: "主角", location: "客栈", lineage, currentTurn: 6, topK: 5, neighborRadius: 0,
    });
    const ids = res.results.map((r) => r.chunkId);
    assert.deepEqual(ids, ["loc_yes"]);
    store.close();
  });

  it("viewer 不可见仍过滤（witnesses 留 JS 层语义不变）", () => {
    const store = createHubStore(":memory:");
    store.appendProseChunks("sp", "batch_viewer", [
      { chunkId: "secret_1", turn: 5, seq: 1, branchId: "b_head", witnesses: ["老孙"], entities: [], rawText: "老孙私下提到青铜印。" },
      { chunkId: "open_1", turn: 5, seq: 2, branchId: "b_head", witnesses: ["*"], entities: [], rawText: "众人面前提到青铜印。" },
    ]);
    const res = store.queryProseChunks("sp", {
      query: "青铜印", viewer: "主角", lineage, currentTurn: 6, topK: 5, neighborRadius: 0,
    });
    const ids = res.results.map((r) => r.chunkId);
    assert.deepEqual(ids, ["open_1"]);
    store.close();
  });

  it("upTo 数字字符串容错：与 JS coercion 同口径不丢分支", () => {
    const store = createHubStore(":memory:");
    store.appendProseChunks("sp", "batch_str", [
      { chunkId: "str_in", turn: 5, seq: 1, branchId: "b_old", witnesses: ["*"], entities: [], rawText: "数字字符串分支提到青铜印。" },
    ]);
    const res = store.queryProseChunks("sp", {
      query: "青铜印", viewer: "主角",
      lineage: [{ b: "b_old", upTo: "6", upToSeq: "3" }, { b: "b_head", upTo: null }],
      currentTurn: 6, topK: 5, neighborRadius: 0,
    });
    assert.deepEqual(res.results.map((r) => r.chunkId), ["str_in"]);
    store.close();
  });

  it("纯 FTS/向量 RRF/邻段不回归：lineage 下推后 RRF 排序与邻段扩展照常", () => {
    const store = createHubStore(":memory:");
    store.appendProseChunks("sp", "batch_rrf", [
      { chunkId: "r1", turn: 5, seq: 1, branchId: "b_head", witnesses: ["*"], entities: [], rawText: "先一句闲笔。" },
      { chunkId: "r2", turn: 5, seq: 2, branchId: "b_head", witnesses: ["*"], entities: [], rawText: "青铜印在此出世。", embedding: [1, 0, 0], embeddingModel: "m", embeddingDim: 3 },
      { chunkId: "r3", turn: 5, seq: 3, branchId: "b_head", witnesses: ["*"], entities: [], rawText: "后一句闲笔。" },
    ]);
    const res = store.queryProseChunks("sp", {
      query: "青铜印", viewer: "主角", lineage, currentTurn: 6, topK: 1, neighborRadius: 1,
      queryEmbedding: [1, 0, 0], queryEmbeddingModel: "m", queryEmbeddingDim: 3,
    });
    assert.equal(res.hits.length, 1);
    assert.equal(res.hits[0].chunkId, "r2");
    // results 摊平 hits+邻段：锚点前后 ±1 邻段照常带出
    const ids = res.results.map((r) => r.chunkId);
    assert.equal(ids.includes("r1"), true);
    assert.equal(ids.includes("r2"), true);
    assert.equal(ids.includes("r3"), true);
    store.close();
  });
});

describe("DELETE 收紧与 force 严格布尔", () => {
  it("非 force 缺/非法 expectedRev → 400 不删；force:'false' 字符串不生效", () => {
    const store = createHubStore(":memory:");
    store.putSave("sp", "s1", { expectedRev: 0, payloadEnc: "v1", updatedAt: 1 });
    const missing = store.deleteSave("sp", "s1", {});
    assert.equal(missing.status, 400);
    assert.equal(store.getSave("sp", "s1") !== null, true);
    const nullRev = store.deleteSave("sp", "s1", { expectedRev: null });
    assert.equal(nullRev.status, 400);
    // 匹配才删
    const ok = store.deleteSave("sp", "s1", { expectedRev: 1 });
    assert.equal(ok.deleted, 1);
    // force 严格 true：字符串 "false"/"1" 不生效
    store.putSave("sp", "s2", { expectedRev: 0, payloadEnc: "v2", updatedAt: 1 });
    const strForce = store.putSave("sp", "s2", { expectedRev: 99, payloadEnc: "evil", updatedAt: 2, force: "1" });
    assert.equal(strForce.status, 409);
    assert.equal(store.getSave("sp", "s2").payloadEnc, "v2");
    store.close();
  });
});

describe("邻段 seq 优先级（稀疏 seq 不被顺序放行）", () => {
  it("两侧都有显式 seq 时只按 seq 距离：seq 差 5 即使数组相邻也不连带", () => {
    const store = createHubStore(":memory:");
    store.appendProseChunks("sp", "batch_sparse", [
      { chunkId: "z1", turn: 3, seq: 2, witnesses: ["*"], entities: [], rawText: "锚点段：青铜印。" },
      { chunkId: "z2", turn: 3, seq: 7, witnesses: ["*"], entities: [], rawText: "远seq段：数组相邻但seq差5。" },
      { chunkId: "z3", turn: 3, seq: 3, witnesses: ["*"], entities: [], rawText: "近seq段：seq差1应连带。" },
    ]);
    const res = store.queryProseChunks("sp", { query: "青铜印", viewer: "主角", topK: 1, neighborRadius: 1 });
    const ids = res.results.map((r) => r.chunkId);
    assert.equal(ids.includes("z1"), true);
    assert.equal(ids.includes("z3"), true);  // seq 差 1
    assert.equal(ids.includes("z2"), false); // seq 差 5，数组顺序不得放行
    store.close();
  });
});

describe("rev tombstone（删后重建高水位）", () => {
  it("删除单槽后重建从 highwater+1 起；旧 expectedRev 写/删碰不到新一代", () => {
    const store = createHubStore(":memory:");
    store.putSave("sp", "s1", { expectedRev: 0, payloadEnc: "gen1", updatedAt: 1 });
    assert.equal(store.getSave("sp", "s1").rev, 1);
    store.deleteSave("sp", "s1", { expectedRev: 1 });
    // 重建：rev 不是 1，是 highwater+1=2
    const reborn = store.putSave("sp", "s1", { expectedRev: 0, payloadEnc: "gen2", updatedAt: 2 });
    assert.equal(reborn.rev, 2);
    // 旧设备拿删除前 expectedRev=1 写 → 409 碰不到新一代
    const staleWrite = store.putSave("sp", "s1", { expectedRev: 1, payloadEnc: "evil", updatedAt: 3 });
    assert.equal(staleWrite.status, 409);
    assert.equal(store.getSave("sp", "s1").payloadEnc, "gen2");
    // 旧 expectedRev=1 删 → 409
    const staleDel = store.deleteSave("sp", "s1", { expectedRev: 1 });
    assert.equal(staleDel.status, 409);
    assert.equal(store.getSave("sp", "s1") !== null, true);
    // 再删再建：高水位累计——rev 到 3
    store.deleteSave("sp", "s1", { expectedRev: 2 });
    const third = store.putSave("sp", "s1", { expectedRev: 0, payloadEnc: "gen3", updatedAt: 4 });
    assert.equal(third.rev, 3);
    store.close();
  });
});

describe("embeddingDim 校验", () => {
  it("写入显式 dim 与向量长度不一致 → 400 不落库；查询 dim 不一致也 400", () => {
    const store = createHubStore(":memory:");
    assert.throws(
      () => store.appendProseChunks("sp", "b", [{ chunkId: "d1", turn: 1, witnesses: ["*"], rawText: "x", embedding: [1, 0], embeddingModel: "m", embeddingDim: 3 }]),
      (err) => err.status === 400,
    );
    // 未显式 dim：按实际长度落库，正常召回
    store.appendProseChunks("sp", "b", [{ chunkId: "d2", turn: 1, witnesses: ["*"], entities: [], rawText: "维度测试青铜印。", embedding: [1, 0], embeddingModel: "m" }]);
    assert.throws(
      () => store.queryProseChunks("sp", { query: "青铜印", viewer: "v", queryEmbedding: [1, 0], queryEmbeddingModel: "m", queryEmbeddingDim: 5 }),
      (err) => err.status === 400,
    );
    const ok = store.queryProseChunks("sp", { query: "青铜印", viewer: "v", queryEmbedding: [1, 0], queryEmbeddingModel: "m" });
    assert.equal(ok.hits.length >= 1, true);
    store.close();
  });
});

describe("邻段组内排序与跨 batch 幂等", () => {
  it("乱序插入时锚点邻段组内仍按 seq 排序（不按 rowid）", () => {
    const store = createHubStore(":memory:");
    // 乱序插入：rowid 顺序 o9,o2,o3,o1 与 seq 完全脱节。
    // 只有 o2 含查询词做锚点，o1/o3 作为 ±1 邻段被连带——组内必须按 seq 1,2,3 返回。
    store.appendProseChunks("sp", "batch_ord", [
      { chunkId: "o3", turn: 3, seq: 3, witnesses: ["*"], entities: [], rawText: "后段无关键词甲。" },
      { chunkId: "o2", turn: 3, seq: 2, witnesses: ["*"], entities: [], rawText: "锚点段青铜印。" },
      { chunkId: "o1", turn: 3, seq: 1, witnesses: ["*"], entities: [], rawText: "前段无关键词乙。" },
    ]);
    const res = store.queryProseChunks("sp", { query: "青铜印", viewer: "v", topK: 1, neighborRadius: 1 });
    const ids = res.results.map((r) => r.chunkId);
    assert.deepEqual(ids, ["o1", "o2", "o3"]);
    store.close();
  });

  it("跨 batch 同 chunkId 幂等（UNIQUE(space_id, chunk_id)）：重发不重复", () => {
    const store = createHubStore(":memory:");
    const chunk = { chunkId: "cb1", turn: 1, witnesses: ["*"], entities: [], rawText: "跨batch段青铜印。" };
    const r1 = store.appendProseChunks("sp", "batch_a", [chunk]);
    const r2 = store.appendProseChunks("sp", "batch_b", [chunk]);
    assert.equal(r1.inserted, 1);
    assert.equal(r2.inserted, 0);
    const res = store.queryProseChunks("sp", { query: "青铜印", viewer: "v", topK: 10, neighborRadius: 0 });
    assert.equal(res.results.filter((r) => r.chunkId === "cb1").length, 1);
    store.close();
  });
});

describe("hub token 鉴权", () => {
  it("无 token/错 token → 401；/health 公开；缺 MEMORY_HUB_TOKEN 拒绝启动", async () => {
    // 缺 token 且无宽松旗标 → 抛错拒绝启动
    const oldEnv = process.env.MEMORY_HUB_TOKEN;
    const oldAllow = process.env.ALLOW_INSECURE_LOCAL_ONLY;
    delete process.env.MEMORY_HUB_TOKEN;
    delete process.env.ALLOW_INSECURE_LOCAL_ONLY;
    assert.throws(() => createHubServer({ dbPath: ":memory:" }), /MEMORY_HUB_TOKEN/);
    if (oldEnv !== undefined) process.env.MEMORY_HUB_TOKEN = oldEnv;
    if (oldAllow !== undefined) process.env.ALLOW_INSECURE_LOCAL_ONLY = oldAllow;

    _resetWriteRateBuckets();
    const { server } = createHubServer({ dbPath: ":memory:", token: "test-admin-token" });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;
    try {
      // /health 公开
      const health = await fetch(`${base}/health`);
      assert.equal(health.status, 200);
      // 无 token → 401
      const noTok = await fetch(`${base}/api/spaces/spX/saves`);
      assert.equal(noTok.status, 401);
      // 错 token → 401
      const badTok = await fetch(`${base}/api/spaces/spX/saves`, { headers: { "x-memory-hub-token": "wrong" } });
      assert.equal(badTok.status, 401);
      // E1：管理员 token 读不到玩家正文/列表——即使值正确也 401
      const adminTok = await fetch(`${base}/api/spaces/spX/saves`, { headers: { "x-memory-hub-token": "test-admin-token" } });
      assert.equal(adminTok.status, 401);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe("E1 空间分凭证", () => {
  it("POST /api/space 发证只一次、库内只存哈希；跨空间读写删一律 401；claim 兼容；429 生效", async () => {
    _resetWriteRateBuckets();
    const { server, store } = createHubServer({ dbPath: ":memory:", token: "test-admin-token" });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;
    const admin = { "x-memory-hub-token": "test-admin-token" };
    try {
      // 创建空间需管理员凭证；无凭证 401
      const noAuth = await fetch(`${base}/api/space`, { method: "POST" });
      assert.equal(noAuth.status, 401);
      const createRes = await fetch(`${base}/api/space`, { method: "POST", headers: admin });
      assert.equal(createRes.status, 200);
      const created = await createRes.json();
      assert.ok(created.spaceId.startsWith("sp_"));
      assert.equal(typeof created.token, "string");
      assert.equal(typeof created.createdAt, "number");
      // 库内只存 SHA-256——明文凭证绝不落库
      const row = store.db.prepare("SELECT token_hash FROM spaces WHERE space_id = ?").get(created.spaceId);
      assert.ok(row.token_hash);
      assert.notEqual(row.token_hash, created.token);
      assert.equal(row.token_hash.length, 64);
      const spaceAuth = { "x-memory-hub-token": created.token };

      // 空间自己的凭证可写可读
      const put = await fetch(`${base}/api/spaces/${created.spaceId}/saves/slot1`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...spaceAuth },
        body: JSON.stringify({ expectedRev: 0, payloadEnc: "cipher", updatedAt: 1 }),
      });
      assert.equal(put.status, 200);
      const list = await fetch(`${base}/api/spaces/${created.spaceId}/saves`, { headers: spaceAuth });
      assert.equal(list.status, 200);

      // 第二个空间：跨空间读/写/删一律 401
      const create2 = await fetch(`${base}/api/space`, { method: "POST", headers: admin });
      const other = await create2.json();
      const otherAuth = { "x-memory-hub-token": other.token };
      const xRead = await fetch(`${base}/api/spaces/${created.spaceId}/saves`, { headers: otherAuth });
      assert.equal(xRead.status, 401);
      const xWrite = await fetch(`${base}/api/spaces/${created.spaceId}/saves/slot9`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...otherAuth },
        body: JSON.stringify({ expectedRev: 0, payloadEnc: "x", updatedAt: 1 }),
      });
      assert.equal(xWrite.status, 401);
      const xDel = await fetch(`${base}/api/space/${created.spaceId}`, { method: "DELETE", headers: otherAuth });
      assert.equal(xDel.status, 401);
      // 反向同样隔离
      const xRead2 = await fetch(`${base}/api/spaces/${other.spaceId}/saves`, { headers: spaceAuth });
      assert.equal(xRead2.status, 401);

      // 管理员凭证不能代替空间凭证读写删玩家数据
      const adminRead = await fetch(`${base}/api/spaces/${created.spaceId}/saves/slot1`, { headers: admin });
      assert.equal(adminRead.status, 401);
      const adminDel = await fetch(`${base}/api/space/${created.spaceId}`, { method: "DELETE", headers: admin });
      assert.equal(adminDel.status, 401);

      // 运维端点：meta 不含正文；rotate 后旧凭证失效新凭证生效
      const meta = await fetch(`${base}/api/spaces/${created.spaceId}/meta`, { headers: admin });
      assert.equal(meta.status, 200);
      const metaJson = await meta.json();
      assert.equal(metaJson.saveCount, 1);
      assert.equal(metaJson.payloadEnc, undefined);
      const metaNoAdmin = await fetch(`${base}/api/spaces/${created.spaceId}/meta`, { headers: spaceAuth });
      assert.equal(metaNoAdmin.status, 401);
      const rotate = await fetch(`${base}/api/spaces/${created.spaceId}/rotate-token`, { method: "POST", headers: admin });
      assert.equal(rotate.status, 200);
      const rotated = await rotate.json();
      const staleAuth = await fetch(`${base}/api/spaces/${created.spaceId}/saves`, { headers: spaceAuth });
      assert.equal(staleAuth.status, 401);
      const freshAuth = await fetch(`${base}/api/spaces/${created.spaceId}/saves`, { headers: { "x-memory-hub-token": rotated.token } });
      assert.equal(freshAuth.status, 200);

      // 无 write-claim（复审必修）：任意写不能 claim 未登记空间——一律 401
      _resetWriteRateBuckets();
      const claimTok = { "x-memory-hub-token": "legacy-shared-token" };
      const claimPut = await fetch(`${base}/api/spaces/spLegacy/saves/slot1`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...claimTok },
        body: JSON.stringify({ expectedRev: 0, payloadEnc: "c", updatedAt: 1 }),
      });
      assert.equal(claimPut.status, 401);
      // 该空间仍无凭证行——「先写即占」不存在
      assert.equal(store.spaceTokenHash("spLegacy"), null);

      // 最小安全迁移：管理员 rotate-token 为 legacy 空间 upsert 一次性新凭证
      const provLegacy = await fetch(`${base}/api/spaces/spLegacy/rotate-token`, { method: "POST", headers: admin });
      assert.equal(provLegacy.status, 200);
      const legacyJson = await provLegacy.json();
      assert.equal(legacyJson.spaceId, "spLegacy");
      const legacyAuth = { "x-memory-hub-token": legacyJson.token };
      const legacyPut = await fetch(`${base}/api/spaces/spLegacy/saves/slot1`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...legacyAuth },
        body: JSON.stringify({ expectedRev: 0, payloadEnc: "c", updatedAt: 1 }),
      });
      assert.equal(legacyPut.status, 200);
      // provision 后 admin token 仍读不到正文
      const adminReadLegacy = await fetch(`${base}/api/spaces/spLegacy/saves/slot1`, { headers: admin });
      assert.equal(adminReadLegacy.status, 401);

      // 错误凭证写也计入限流（前置计数，不看凭证对错）
      _resetWriteRateBuckets();
      let wrongLast = 0;
      for (let i = 0; i < 61; i += 1) {
        const r = await fetch(`${base}/api/spaces/${created.spaceId}/saves/slot1`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-memory-hub-token": "wrong-cred" },
          body: JSON.stringify({ expectedRev: 0, payloadEnc: "c", updatedAt: i, force: true }),
        });
        wrongLast = r.status;
      }
      assert.equal(wrongLast, 429);

      // create/rotate 也计入限流
      _resetWriteRateBuckets();
      let createLast = 0;
      for (let i = 0; i < 61; i += 1) {
        const r = await fetch(`${base}/api/space`, { method: "POST", headers: admin });
        createLast = r.status;
      }
      assert.equal(createLast, 429);

      // 429：同一 IP 每分钟写超 60 次返 429
      _resetWriteRateBuckets();
      let lastStatus = 0;
      for (let i = 0; i < 61; i += 1) {
        const r = await fetch(`${base}/api/spaces/${created.spaceId}/saves/slot1`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-memory-hub-token": rotated.token },
          body: JSON.stringify({ expectedRev: -1, payloadEnc: "c", updatedAt: i, force: true }),
        });
        lastStatus = r.status;
      }
      assert.equal(lastStatus, 429);
      _resetWriteRateBuckets();
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

describe("HTTP server, DELETE /api/space/:spaceId + VACUUM, and API key rejection", () => {
  it("physically deletes space data + FTS entries and runs VACUUM on DELETE /api/space/:spaceId", async () => {
    const dir = mkdtempSync(join(tmpdir(), "qucuo-hub-"));
    const dbPath = join(dir, "hub.sqlite");
    _resetWriteRateBuckets();
    const { server, store } = createHubServer({ dbPath, token: "test-hub-token" });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;
    let auth = { "x-memory-hub-token": "test-hub-token" };

    try {
      // E1：空间数据不再认管理员 token——先 rotate provision 出 spA 的空间凭证
      const prov = await fetch(`${base}/api/spaces/spA/rotate-token`, { method: "POST", headers: auth });
      assert.equal(prov.status, 200);
      const provJson = await prov.json();
      auth = { "x-memory-hub-token": provJson.token };

      const saveRes = await fetch(`${base}/api/spaces/spA/saves/slot1`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ expectedRev: 0, payloadEnc: "cipherA", updatedAt: 1 }),
      });
      assert.equal(saveRes.status, 200);

      const badSave = await fetch(`${base}/api/spaces/spA/saves/slot1`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ expectedRev: 0, payloadEnc: "stale", updatedAt: 2 }),
      });
      assert.equal(badSave.status, 409);

      const proseRes = await fetch(`${base}/api/spaces/spA/prose`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({
          batchId: "batch1",
          chunks: [{ chunkId: "c1", turn: 1, witnesses: ["*"], rawText: "大雪封山，青铜古印现世。" }],
        }),
      });
      assert.equal(proseRes.status, 200);

      const keyReject = await fetch(`${base}/api/spaces/spA/prose`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": "sk-secret" },
        body: JSON.stringify({ batchId: "b2", chunks: [] }),
      });
      assert.equal(keyReject.status, 400);

      const authReject = await fetch(`${base}/api/spaces/spA/prose`, {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: "Bearer sk-secret" },
        body: JSON.stringify({ batchId: "b3", chunks: [] }),
      });
      assert.equal(authReject.status, 400);

      const bodyKeyReject = await fetch(`${base}/api/spaces/spA/prose`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ batchId: "b4", chunks: [], config: { Authorization: "Bearer x" } }),
      });
      assert.equal(bodyKeyReject.status, 400);

      // PUT force 覆盖（玩家显式裁决路径）
      const forcePut = await fetch(`${base}/api/spaces/spA/saves/slot1`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ expectedRev: 99, payloadEnc: "forced", updatedAt: 5, force: true }),
      });
      assert.equal(forcePut.status, 200);
      // DELETE 单槽：先 409（expectedRev 不符），再 force 强删，再幂等
      const delConflict = await fetch(`${base}/api/spaces/spA/saves/slot1?expectedRev=99`, { method: "DELETE", headers: auth });
      assert.equal(delConflict.status, 409);
      const delConflictJson = await delConflict.json();
      assert.equal(typeof delConflictJson.serverRev, "number");
      const delForce = await fetch(`${base}/api/spaces/spA/saves/slot1?force=1`, { method: "DELETE", headers: auth });
      assert.equal(delForce.status, 200);
      assert.equal(store.getSave("spA", "slot1"), null);
      const delAgain = await fetch(`${base}/api/spaces/spA/saves/slot1?force=1`, { method: "DELETE", headers: auth });
      assert.equal(delAgain.status, 200);
      // 重存一份供整space删除计数
      await fetch(`${base}/api/spaces/spA/saves/slot1`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ expectedRev: 0, payloadEnc: "cipherA2", updatedAt: 6 }),
      });

      const delRes = await fetch(`${base}/api/space/spA`, { method: "DELETE", headers: auth });
      assert.equal(delRes.status, 200);
      const delJson = await delRes.json();
      assert.equal(delJson.deletedSaves, 1);
      assert.equal(delJson.deletedChunks, 1);
      assert.equal(delJson.vacuumed, true);

      assert.equal(store.getSave("spA", "slot1"), null);
      const ftsLeft = store.db.prepare("SELECT count(*) AS n FROM prose_fts WHERE prose_fts MATCH ?").get('"青铜"');
      assert.equal(ftsLeft.n, 0);
      const freelist = store.db.prepare("PRAGMA freelist_count").get();
      assert.equal(freelist.freelist_count, 0);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      rmSync(dir, { recursive: true, force: true });
    }
  });
});


// ── 复审必修钉测试 ─────────────────────────────────────────────
it("wipe 后旧设备低 expectedRev 写不进新一代（deleteSpace 批量 tombstone）", async () => {
  const store = createHubStore(":memory:");
  store.putSave("sp1", "slotA", { expectedRev: 0, payloadEnc: "v1" });
  store.putSave("sp1", "slotA", { expectedRev: 1, payloadEnc: "v2" }); // rev=2
  store.putSave("sp1", "slotB", { expectedRev: 0, payloadEnc: "x" });  // rev=1
  store.deleteSpace("sp1");
  // 主人重建：从 tombstone 高水位 +1 起（slotA high=2 → 3；slotB high=1 → 2）
  const a = store.putSave("sp1", "slotA", { expectedRev: 0, payloadEnc: "new-gen" });
  assert.equal(a.rev, 3);
  // 旧设备带 wipe 前的 expectedRev=1 醒来推送——必须 409 写不进新一代
  const stale = store.putSave("sp1", "slotA", { expectedRev: 1, payloadEnc: "pre-wipe" });
  assert.equal(stale.status, 409);
  assert.equal(store.getSave("sp1", "slotA").payloadEnc, "new-gen");
  // slotB 同样受保护（低 rev 撞代场景）
  const b = store.putSave("sp1", "slotB", { expectedRev: 0, payloadEnc: "newB" });
  assert.equal(b.rev, 2);
  const staleB = store.putSave("sp1", "slotB", { expectedRev: 1, payloadEnc: "pre-wipe-B" });
  assert.equal(staleB.status, 409);
  store.close();
});

it("ALLOW_INSECURE_LOCAL_ONLY + 非 loopback HOST 拒绝启动", async () => {
  const { createHubServer } = await import("./server.mjs");
  const oldInsecure = process.env.ALLOW_INSECURE_LOCAL_ONLY;
  const oldHost = process.env.HOST;
  const oldToken = process.env.MEMORY_HUB_TOKEN;
  process.env.ALLOW_INSECURE_LOCAL_ONLY = "1";
  delete process.env.MEMORY_HUB_TOKEN;
  try {
    process.env.HOST = "0.0.0.0";
    assert.throws(() => createHubServer({ dbPath: ":memory:" }), /非 loopback/);
    process.env.HOST = "127.0.0.1";
    assert.doesNotThrow(() => {
      const { server } = createHubServer({ dbPath: ":memory:" });
      server.close();
    });
    delete process.env.HOST; // 缺省按 loopback 放行
    assert.doesNotThrow(() => {
      const { server } = createHubServer({ dbPath: ":memory:" });
      server.close();
    });
  } finally {
    if (oldInsecure === undefined) delete process.env.ALLOW_INSECURE_LOCAL_ONLY; else process.env.ALLOW_INSECURE_LOCAL_ONLY = oldInsecure;
    if (oldHost === undefined) delete process.env.HOST; else process.env.HOST = oldHost;
    if (oldToken === undefined) delete process.env.MEMORY_HUB_TOKEN; else process.env.MEMORY_HUB_TOKEN = oldToken;
  }
});

// ── WO-20D hasProseAfter 跨设备恢复探测 ─────────────────────────────
describe("hasProseAfter 探测端点口径", () => {
  const seedBranch = (store) => {
    store.appendProseChunks("sp", "batch_ha", [
      { chunkId: "b1_5_1", turn: 5, seq: 1, branchId: "b1", witnesses: ["*"], entities: [], rawText: "五回合一段。" },
      { chunkId: "b1_5_3", turn: 5, seq: 3, branchId: "b1", witnesses: ["*"], entities: [], rawText: "五回合三段。" },
      { chunkId: "b1_8_1", turn: 8, seq: 1, branchId: "b1", witnesses: ["*"], entities: [], rawText: "八回合未来段。" },
      { chunkId: "b2_9_1", turn: 9, seq: 1, branchId: "b2", witnesses: ["*"], entities: [], rawText: "别分支未来段。" },
      { chunkId: "b1_10x", turn: 10, branchId: "b1", witnesses: ["*"], entities: [], rawText: "无 seq 老数据段。" },
    ]);
  };

  it("turn>afterTurn 命中 true；afterTurn 之后无段 false", () => {
    const store = createHubStore(":memory:");
    seedBranch(store);
    assert.equal(store.hasProseAfter("sp", { branchId: "b1", afterTurn: 5, afterSeq: 3 }).hasFuture, true); // turn 8/10 在未来
    assert.equal(store.hasProseAfter("sp", { branchId: "b1", afterTurn: 10, afterSeq: 99 }).hasFuture, false);
    store.close();
  });

  it("同 turn seq 边界：seq>afterSeq 才算未来，seq NULL 老数据不算", () => {
    const store = createHubStore(":memory:");
    seedBranch(store);
    // afterSeq=2：seq3 同回合为未来
    assert.equal(store.hasProseAfter("sp", { branchId: "b1", afterTurn: 5, afterSeq: 2 }).hasFuture, true);
    // 排除 turn8/10 影响单独验证 seq 口径：afterTurn=5 afterSeq=3 时 seq1/seq3 都不算，
    // 但 turn8 段在——用只含同回合段的孤立库验 seq 边界
    const s2 = createHubStore(":memory:");
    s2.appendProseChunks("sp", "b_seq", [
      { chunkId: "x5_1", turn: 5, seq: 1, branchId: "bx", witnesses: ["*"], entities: [], rawText: "a" },
      { chunkId: "x5_3", turn: 5, seq: 3, branchId: "bx", witnesses: ["*"], entities: [], rawText: "b" },
      { chunkId: "x5_noseq", turn: 5, branchId: "bx", witnesses: ["*"], entities: [], rawText: "c" },
    ]);
    assert.equal(s2.hasProseAfter("sp", { branchId: "bx", afterTurn: 5, afterSeq: 3 }).hasFuture, false); // seq3 不超 3、无 seq 不算
    assert.equal(s2.hasProseAfter("sp", { branchId: "bx", afterTurn: 5, afterSeq: 2 }).hasFuture, true);  // seq3>2
    assert.equal(s2.hasProseAfter("sp", { branchId: "bx", afterTurn: 5, afterSeq: 1 }).hasFuture, true);
    s2.close();
    store.close();
  });

  it("别 branch 段不算；无 branchId/空串直接 false", () => {
    const store = createHubStore(":memory:");
    seedBranch(store);
    assert.equal(store.hasProseAfter("sp", { branchId: "b3", afterTurn: 1, afterSeq: 0 }).hasFuture, false); // b3 不存在
    assert.equal(store.hasProseAfter("sp", { branchId: "", afterTurn: 1, afterSeq: 0 }).hasFuture, false);
    assert.equal(store.hasProseAfter("sp", { branchId: null, afterTurn: 1, afterSeq: 0 }).hasFuture, false);
    // b2 自身 turn9 是未来——确认分支隔离不是误判
    assert.equal(store.hasProseAfter("sp", { branchId: "b2", afterTurn: 5, afterSeq: 0 }).hasFuture, true);
    store.close();
  });
});
