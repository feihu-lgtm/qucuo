PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- rev tombstone：删除单槽后记录该槽历史最高 rev——重建从 highwater+1 起，
-- 旧设备拿删除前的 expectedRev 永远碰不到新一代。
CREATE TABLE IF NOT EXISTS save_tombstones (
  space_id TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  high_rev INTEGER NOT NULL,
  PRIMARY KEY (space_id, slot_id)
);

CREATE TABLE IF NOT EXISTS saves (
  space_id TEXT NOT NULL,
  slot_id TEXT NOT NULL,
  rev INTEGER NOT NULL,
  payload_enc TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (space_id, slot_id)
);

CREATE TABLE IF NOT EXISTS prose_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  space_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  chunk_id TEXT NOT NULL,
  turn INTEGER NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  witnesses_json TEXT NOT NULL,
  entities_json TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  public_text TEXT NOT NULL,
  terms_segmented TEXT NOT NULL,
  embedding_blob BLOB,
  embedding_model TEXT,
  embedding_dim INTEGER,
  seq INTEGER,
  branch_id TEXT,
  UNIQUE (space_id, chunk_id)
);

-- WO-20D：has-after 探测与谱系查询的分支+回合索引
CREATE INDEX IF NOT EXISTS idx_prose_branch_turn ON prose_chunks(space_id, branch_id, turn);

CREATE INDEX IF NOT EXISTS idx_prose_space_turn ON prose_chunks (space_id, turn, id);
CREATE INDEX IF NOT EXISTS idx_prose_space_chunk ON prose_chunks (space_id, chunk_id);

CREATE VIRTUAL TABLE IF NOT EXISTS prose_fts USING fts5(
  terms_segmented,
  content='prose_chunks',
  content_rowid='id',
  tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS prose_chunks_ai AFTER INSERT ON prose_chunks BEGIN
  INSERT INTO prose_fts(rowid, terms_segmented) VALUES (new.id, new.terms_segmented);
END;

CREATE TRIGGER IF NOT EXISTS prose_chunks_ad AFTER DELETE ON prose_chunks BEGIN
  INSERT INTO prose_fts(prose_fts, rowid, terms_segmented) VALUES ('delete', old.id, old.terms_segmented);
END;

CREATE TRIGGER IF NOT EXISTS prose_chunks_au AFTER UPDATE ON prose_chunks BEGIN
  INSERT INTO prose_fts(prose_fts, rowid, terms_segmented) VALUES ('delete', old.id, old.terms_segmented);
  INSERT INTO prose_fts(rowid, terms_segmented) VALUES (new.id, new.terms_segmented);
END;
