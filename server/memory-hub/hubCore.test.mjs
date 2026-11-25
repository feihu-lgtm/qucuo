import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractTerms, segmentToSpaceString } from "./ftsTokenizer.mjs";
import { createHubStore } from "./hubCore.mjs";
import { createHubServer } from "./server.mjs";

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
      { chunkId: "b1_3_1", turn: 3, location: "鱼定村", witnesses: ["主角", "才旦"], entities: ["才旦"], rawText: "前段铺垫：晨雾未散，才旦在石阶旁生火。", embedding: [0.9, 0.1] },
      { chunkId: "b1_3_2", turn: 3, location: "鱼定村", witnesses: ["主角", "才旦"], entities: ["才旦", "赫连铸"], rawText: "赫连铸把一枚衔尾蛇门环塞进暗格。", embedding: [0.95, 0.05] },
      { chunkId: "b1_3_3", turn: 3, location: "鱼定村", witnesses: ["主角", "才旦"], entities: ["才旦"], rawText: "后段收尾：他压低嗓音叮嘱莫声张。", embedding: [0.85, 0.15] },
      { chunkId: "b1_3_4", turn: 3, location: "鱼定村", witnesses: ["主角", "白狼"], entities: ["赫连铸"], rawText: "私密对话：赫连铸另有秘令，但才旦当时不在场。", embedding: [1, 0] },
      { chunkId: "b1_9_1", turn: 9, location: "鱼定村", witnesses: ["*"], entities: ["赫连铸"], rawText: "未来回合：赫连铸现身。", embedding: [1, 0] },
    ]);
    store.appendProseChunks("space_2", "batch_other", [
      { chunkId: "b2_3_1", turn: 3, location: "鱼定村", witnesses: ["*"], entities: ["赫连铸"], rawText: "串档数据：赫连铸在此。", embedding: [1, 0] },
    ]);

    const res = store.queryProseChunks("space_1", {
      query: "赫连铸",
      viewer: "才旦",
      maxTurn: 5,
      queryEmbedding: [1, 0],
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

describe("HTTP server, DELETE /api/space/:spaceId + VACUUM, and API key rejection", () => {
  it("physically deletes space data + FTS entries and runs VACUUM on DELETE /api/space/:spaceId", async () => {
    const dir = mkdtempSync(join(tmpdir(), "qucuo-hub-"));
    const dbPath = join(dir, "hub.sqlite");
    const { server, store } = createHubServer({ dbPath });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    try {
      const saveRes = await fetch(`${base}/api/spaces/spA/saves/slot1`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRev: 0, payloadEnc: "cipherA", updatedAt: 1 }),
      });
      assert.equal(saveRes.status, 200);

      const badSave = await fetch(`${base}/api/spaces/spA/saves/slot1`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRev: 0, payloadEnc: "stale", updatedAt: 2 }),
      });
      assert.equal(badSave.status, 409);

      const proseRes = await fetch(`${base}/api/spaces/spA/prose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      const delRes = await fetch(`${base}/api/space/spA`, { method: "DELETE" });
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
