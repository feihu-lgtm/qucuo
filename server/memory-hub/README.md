# server/memory-hub（WO-20 独立记忆与存档同步后端）

纯 Node 内置依赖实现（`node:sqlite` + SQLite FTS5 + `node:http`），无需额外 `npm install`。要求 Node.js `>= 22.5.0`。

## 本地启动

```bash
cd server/memory-hub
MEMORY_HUB_TOKEN=本地开发token PORT=8787 MEMORY_HUB_DB=./memory-hub.sqlite npm start
```

## 鉴权与监听（生产必读）

- 除 `GET /health` 外所有 `/api/*` 必须带 hub 专用凭证头 `x-memory-hub-token`（与任何模型 key 无关；
  `Authorization`/`x-api-key` 等 header 依然拒收）。
- `MEMORY_HUB_TOKEN` 缺失**拒绝启动**。唯一例外：显式 `ALLOW_INSECURE_LOCAL_ONLY=1` 的本机开发
  （此时必须自行确保只 bind loopback）。
- 默认 listen host 是 `127.0.0.1`。生产暴露公网：显式 `HOST=0.0.0.0` + 强随机 `MEMORY_HUB_TOKEN`，
  并建议前置 TLS 反代。

## rev tombstone（删除语义）

单槽删除会记录该槽历史最高 rev（`save_tombstones` 高水位）。空槽重建从 highwater+1 起——
旧设备持删除前的过期 expectedRev 写/删永远碰不到新一代。

**客户端适配映射（WO-19 seam 对接硬约束）**：客户端本地 `rev` 计数器**不是**直接用作 CAS `expectedRev`——适配层必须把「服务端上次确认返回的 `serverRev`」作为下一次推送的 `expectedRev`（本地计数只作参考），并把快照 `value` 封装成 `payloadEnc` 不透明密文串上送；明文快照直发会被服务端拒绝。


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
- `POST /api/spaces/:spaceId/prose`：批量写入原文段落（`UNIQUE(space_id, chunk_id)` 保证断网重发/跨 batch 重发幂等；batch_id 仍记录用于追踪）
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

**适配层已落地（WO-19/20 PR-A）**：`src/infra/cloudProtocol.js` 是客户端 protocol adapter——
storageDriver 全部云端调用经它翻译成 canonical 契约：
URL `<host>/api/spaces/<spaceId>/saves/<slotId>`（wipe 重写为 `DELETE /api/space/<spaceId>`）、
形状 `{expectedRev, payloadEnc}`、鉴权 `x-memory-hub-token` 必带。
rev 语义：客户端本地计数器不作 CAS 依据——per-key serverRev 台账（首写 expectedRev=0、成功记响应 rev），
按 `spaceId::slot` 命名空间隔离（换空间不串账）。409 一律进冲突登记等玩家显式裁决——包括首次错位
（裁决收紧：自动对齐无法区分迁移与新设备真多端冲突，误覆盖不可逆；迁移代价只是玩家点一次
「本地覆盖云端」）。玩家裁决 keep_cloud 时台账对齐服务端 rev，后续续写以此为 expectedRev。
force 仍只能玩家显式「本地覆盖云端」触发。
另注：浏览器跨源直连需部署方用同源反代或为 hub 自行加 CORS——hub 本身不应答 OPTIONS preflight，
服务端零改动是本阶段硬约束；hosted 一键云若成行再另立服务端小单。
加密：payloadEnc 是 WebCrypto AES-GCM 密文串 `v1.<ivB64>.<ctB64>`，密钥首用生成存 localStorage
（不离开客户端）；**换设备密钥恢复未做**——换机后无法解密云端快照，恢复链路随后续工单。
绑定三件套（cloudUrl/spaceId/hubToken）缺一即 unbound 优雅降级，队列不推不丢。
原文段落上行/查询与嵌入向量管线仍未做（PR-B 后续）。

## ⚠ pre-release schema 不兼容声明

本服务尚未发布。`UNIQUE(space_id, chunk_id)`、branch_id/seq/embedding 元数据列等均为终审后契约——
老 dev 库的 `UNIQUE(space_id, batch_id, chunk_id)` 约束无法原地变更，**请直接删除旧 sqlite 文件重建**，
不要把重复段落当合法数据迁移。
