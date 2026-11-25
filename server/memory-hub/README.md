# server/memory-hub（WO-20 独立记忆与存档同步后端）

纯 Node 内置依赖实现（`node:sqlite` + SQLite FTS5 + `node:http`），无需额外 `npm install`。要求 Node.js `>= 22.5.0`。

## 本地启动

```bash
cd server/memory-hub
PORT=8787 MEMORY_HUB_DB=./memory-hub.sqlite npm start
```

## 运行单测

```bash
node --test server/memory-hub/hubCore.test.mjs
```

## 接口清单

- `GET /health`：健康检查
- `GET /api/spaces/:spaceId/saves`：列出当前空间的存档槽位与 `rev`
- `GET /api/spaces/:spaceId/saves/:slotId`：读取密文存档（`payload_enc`）
- `PUT /api/spaces/:spaceId/saves/:slotId`：带 `expectedRev` 写入存档；版本冲突返回 HTTP `409` 不静默覆盖
- `POST /api/spaces/:spaceId/prose`：批量写入原文段落（`UNIQUE(space_id, batch_id, chunk_id)` 保证断网重发幂等）
- `POST /api/spaces/:spaceId/prose/query`：SQL 过滤 + FTS5 BM25 + 可选 embedding 余弦 RRF + 前后邻段连带召回
- `DELETE /api/space/:spaceId`：物理级联删除存档与段落并执行 `VACUUM`

服务端只存密文快照与分词段落，不接收也不中转任何模型 API Key。
