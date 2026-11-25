PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

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
  UNIQUE (space_id, batch_id, chunk_id)
);

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
