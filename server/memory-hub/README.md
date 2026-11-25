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

服务端只存密文快照与分词段落，不接收也不中转任何模型 API Key（body 键名大小写不敏感拦截 + HTTP `Authorization`/`x-api-key` 等 header 拒收）。

## 向量元数据契约（硬要求）

- 写入：`chunks[].embedding` 必须配套 `embeddingModel`（模型名逐字）与可选 `embeddingDim`（缺省取向量长度）。
- 查询：`queryEmbedding` 必须配套 `queryEmbeddingModel`（可选 `queryEmbeddingDim`，缺省取向量长度）。
- 只有模型名逐字相同且维度相等的行参与向量余弦排序；换模型/换维度后的旧向量绝不参与比较。
- 无向量元数据的旧行只做关键词（FTS5）召回，不会被丢弃。

## ⚠ 与 WO-19 客户端 seam 的协议差异（接线前必读）

本服务的存档协议是 `/api/spaces/:spaceId/saves/:slotId` + `{expectedRev, payloadEnc}` 密文信封；
WO-19 客户端（`src/infra/storageDriver.js`）当前写的是 `/saves/<key>` + `{rev, value}` 明文形状。
**两者现在不能直接对接**——WO-19/20 接线前需要统一的协议适配层（路径/rev 字段名/密文封装/409 冲突语义对齐），
在适配层落地前请勿假设客户端已可插用本服务。
