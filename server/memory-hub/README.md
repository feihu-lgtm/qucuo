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
- `PUT /api/spaces/:spaceId/saves/:slotId`：带 `expectedRev` 写入存档；版本冲突返回 HTTP `409`（响应同时给 `serverRev`/`currentRev`）不静默覆盖；`force:true` 跳过冲突检查强制覆盖——**唯一合法触发源是玩家在客户端显式裁决「本地覆盖云端」，自动同步流程绝不许带 force**
- `DELETE /api/spaces/:spaceId/saves/:slotId`：删除单槽；`expectedRev` 不符返回 `409`，`?force=1` 强删；非 force 缺/非法 expectedRev 返回 `400` 不删；槽位不存在时幂等成功（`deleted:0`）
- `POST /api/spaces/:spaceId/prose`：批量写入原文段落（`UNIQUE(space_id, batch_id, chunk_id)` 保证断网重发幂等）
- `POST /api/spaces/:spaceId/prose/query`：SQL 过滤 + FTS5 BM25 + 可选 embedding 余弦 RRF + 前后邻段连带召回
- `DELETE /api/space/:spaceId`：物理级联删除存档与段落并执行 `VACUUM`

服务端只存密文快照与分词段落，不接收也不中转任何模型 API Key（body 键名大小写不敏感拦截 + HTTP `Authorization`/`x-api-key` 等 header 拒收）。

## 段落写入契约补充

- `chunks[].seq`：显式同回合顺序号——邻段连带优先吃它（两侧都有 seq 时只按 seq 距离，
  数组顺序不再放行）。chunkId 拆尾段只是兼容兜底，带导入戳后缀或 branchId 含下划线时拆尾不可靠。
- `chunks[].branchId`：时间线分支 id。查询传 `lineage`+`currentTurn` 时按谱系硬过滤
  （与客户端 `branchVisible` 同口径：branchId 命中谱系；非头 turn<upTo、turn=upTo 按 upToSeq/seq 边界；
  头分支 turn<=currentTurn；无 branchId 一律不可见）。lineage 未传才退回 maxTurn 宽松路径。

## 向量元数据契约（硬要求）

- 写入：`chunks[].embedding` 必须配套 `embeddingModel`（模型名逐字）与可选 `embeddingDim`（缺省取向量长度）。
- 查询：`queryEmbedding` 必须配套 `queryEmbeddingModel`（可选 `queryEmbeddingDim`，缺省取向量长度）。
- 只有模型名逐字相同且维度相等的行参与向量余弦排序；换模型/换维度后的旧向量绝不参与比较。
- 无向量元数据的旧行只做关键词（FTS5）召回，不会被丢弃。

## 与 WO-19 客户端 seam 的对接方式（canonical 协议 + 适配层）

本服务协议是 **canonical 服务端契约**，不迎合已合并的 WO-19 client seam。对接路径：

- URL 映射：WO-19 client 的 `cloudUrl` 可配置为 `<host>/api/spaces/<spaceId>`，其 `/saves/<key>` 拼接即 canonical 的 `/api/spaces/<spaceId>/saves/<slotId>`。
- 形状适配：仍需一层适配层转换 `{rev, value}` ↔ `{expectedRev, payloadEnc}`——
  包括 rev 语义（client 本地递 rev vs server 权威 rev）、密文封装/编码（`payloadEnc` 是不透明密文串，
  client 当前传明文 value）、以及 409 冲突语义对齐（server 已同时返回 `serverRev` 供 client `keep_cloud` 对齐 rev）。
- force 对齐：server 的 `force:true`/`?force=1` 与 client 「本地覆盖云端」裁决一一对应，只能由玩家显式触发。

**在适配层落地前请勿假设客户端已可插用本服务。**
