# server/memory-hub（WO-20 独立记忆与存档同步后端）

纯 Node 内置依赖实现（`node:sqlite` + SQLite FTS5 + `node:http`），无需额外 `npm install`。要求 Node.js `>= 22.5.0`。

## 本地启动

```bash
cd server/memory-hub
MEMORY_HUB_TOKEN=本地开发token PORT=8787 MEMORY_HUB_DB=./memory-hub.sqlite npm start
```

## 鉴权与威胁模型（生产必读，E1 按空间分凭证）

- **空间凭证**：每个空间有独立随机凭证，创建时只返回一次，库内只存 SHA-256（明文绝不落库/不落日志）。
  所有空间数据路径（`/api/spaces/:spaceId/*` 与单数 `DELETE /api/space/:spaceId`）只认该空间自己的凭证——
  跨空间读/写/删一律 `401`。
- **管理员凭证**：`MEMORY_HUB_TOKEN` 降为纯运维凭证，只能用于 `POST /api/space`（创建空间）、
  `POST /api/spaces/:spaceId/rotate-token`（旋转凭证，新凭证同样只返回一次）、
  `GET /api/spaces/:spaceId/meta`（只返回计数/时间戳，**绝不返回存档或段落正文**）。
  管理员凭证**不能**读/写/删任何空间的玩家数据。
- **无 write-claim**：普通写请求绝不自动登记空间凭证（防「先写即占」）。**legacy 空间迁移**：
  管理员用 `POST /api/spaces/:spaceId/rotate-token` 为该 spaceId provision 一次性新凭证
  （未登记空间 upsert 凭证行，已登记则旋转；此操作不读正文），转交用户替换客户端「空间凭证」。
  旧客户端 cloudUrl/spaceId/hubToken 三件套字段、URL 形状、unbound 降级不变，只需换新凭证值。
- **写限流**：同一来源 IP 每 60 秒最多 60 次写请求（PUT/POST/DELETE；query/has-after 属读不限），
  超出返回 `429`。限流在鉴权与业务路由**之前**统一计数——无论凭证对错、空间存在与否都计入，
  创建空间/旋转凭证全覆盖。内存滑动窗口，键取 socket 地址（不盲信 `x-forwarded-for`；
  反代部署需自行保证 socket 地址可信或前置限流）。
- 凭证头仍走 `x-memory-hub-token`，与任何模型 key 无关；`Authorization`/`x-api-key` 等 header 依然拒收。
- `MEMORY_HUB_TOKEN` 缺失**拒绝启动**。唯一例外：显式 `ALLOW_INSECURE_LOCAL_ONLY=1` 的本机开发
  （此时跳过全部鉴权，必须自行确保只 bind loopback）。
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
- `POST /api/space`：创建空间（管理员凭证），返回 `{spaceId, token, createdAt}`——`token` 只出现这一次
- `POST /api/spaces/:spaceId/rotate-token`：旋转空间凭证（管理员凭证），新凭证同样只返回一次
- `GET /api/spaces/:spaceId/meta`：空间元信息（管理员凭证；只含 saveCount/chunkCount/createdAt，无正文）
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
原文段落上行/查询已落地（WO-19/20 PR-B）：`src/infra/proseUplink.js` 复用 cloud 队列模式——
本地 IndexedDB 段落库写成功后 enqueue，批量 POST `/api/spaces/<spaceId>/prose`；队列内按 chunkId 去重，
幂等由服务端 `UNIQUE(space_id, chunk_id)` + INSERT OR IGNORE 兜底；断网/5xx/环境类 4xx（401/403/404/409/429）
退避重发，确定形状坏 400/422 移 dead-letter 队列（cap 200 可打捞），413 超限批次动态减半、单段超限进 dead-letter；
unbound 队列保留静默等待。云端 chunkId 是上行身份不保证等于本地 IndexedDB id——legacy 迁移段（id 无分支前缀）
按 `${branchId}::${id}` 命名空间化，防重读再迁移时新旧分支互吞；查询消费方按 branchId/turn/seq/原文对照。查询客户端 `hubQueryProse` 走纯 FTS 路径：lineage+currentTurn 谱系参数直通
canonical，绝不携带 embedding 字段。**明文口径（有意）**：prose 段服务端要建 FTS 索引必须明文上送——
威胁模型与存档相反，存档密文 at-rest、prose 明文对 hub 运营方可见，witnesses 元数据供可见性过滤；
prose 路径绝不触碰存档密钥/密文。嵌入向量管线仍不做（后续工单）。

## ✅ WO-20C：客户端召回已接云查询（recallProse 合并）

客户端 `recallProse`（engine/ports/recallBlock.js）在 `driver==="cloud"` 且绑定完整且 **lineage 非空** 时，
与本地词法召回并行发起 `/prose/query`（1.5s 短超时，失败/超时/非 2xx/坏形状一律静默降级本地结果，绝不阻断回合）；
无 lineage 绝不退 maxTurn 云查（防跨时间线串味），local/file/未绑定零网络。合并纯函数
`src/domain/rules/memory/cloudRecallMerge.js`：本地是新鲜权威（上行有 debounce，近段可能未上行）在前，
云端补跨设备/已同步历史在后，按 **turn+规范化文本** 去重（不按 id——云端 chunkId 带 `${branchId}::` 命名空间
与本地 IndexedDB id 形状不同），witnesses 客户端再过滤一次（不信任服务端已过滤），文本按当前 viewer
现剥心理，总条数 topK 封顶。**威胁模型补记**：查询文本（含玩家输入与上下文词）与命中的明文段落一样
会发往 hub，对 hub 运营方可见——与上行明文同一有意口径；查询绝不携带 embedding/queryEmbedding 字段。

## ✅ WO-20D：has-after 恢复探测端点

`POST /api/spaces/<spaceId>/prose/has-after`（auth 同 prose）：body `{branchId, afterTurn, afterSeq}`，
只答该 branch 是否存在 `turn>afterTurn` 或 `turn=afterTurn && seq>afterSeq` 的 chunk（seq NULL 老数据不算，
与客户端 reconcile 同口径），返回 `{hasFuture}`；`(space_id, branch_id, turn)` 索引直查参数化 SQL。
用途：跨设备恢复——prose 段不随存档走，新设备本地无 chunks 时本地 reconcile 判不出原设备
在同分支的云端后续；客户端 proseReconcile 在模糊场景（v1/裸包导入或头分支本地零段）探测，
true 分叉、false 不分叉、**失败/超时/非 2xx 保守分叉（宁可产生空分支，不可串弃坑时间线）**；
有完整本地段落库佐证时不探测不分叉，local driver 零请求。

## ✅ WO-20B1：谱系/地点过滤已下推 SQL（原 known limitation 消除）

FTS 候选的谱系（branch_id/turn/seq 边界）与 location 条件已下推进 `queryProseChunks` 的动态 SQL——
候选 cap（`Math.max(topK*4, 20)`）不再先于谱系截取，别分支/旧未来高评分副本挤占 topK 候选的问题
在服务端消除。`buildLineageSql` 与 `branchVisibleServer` 严格同口径（head upTo=null 按 currentTurn、
非头 turn<upTo 恒可见、turn=upTo 按 upToSeq/seq IS NULL 兼容、无 branchId 不可见；同分支重复条目
按 JS find 语义只认第一条）。viewer 的 witnesses JSON 数组嵌套仍留 JS 层过滤（形状不变），cap 后的
visibleById 过滤只挡 witnesses。API body/response 形状不变，客户端零改动。

## ⚠ pre-release schema 不兼容声明

本服务尚未发布。`UNIQUE(space_id, chunk_id)`、branch_id/seq/embedding 元数据列等均为终审后契约——
老 dev 库的 `UNIQUE(space_id, batch_id, chunk_id)` 约束无法原地变更，**请直接删除旧 sqlite 文件重建**，
不要把重复段落当合法数据迁移。
