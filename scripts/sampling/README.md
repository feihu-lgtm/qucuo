# A4 真实放行采样基建

修复 S7 五处失真：空输入、目标不在场、时间窗串 lane、缺原始留底、尾章计数错；外加采样存档开局满血 fixture。

## 组成

| 文件 | 作用 |
|---|---|
| `proxy.mjs` | 留底代理：注入真实口令（不落盘），按 `x-qucuo-lane/turn/trace` 请求头归属，全量记 `ai_calls.jsonl`（脱敏，无 auth 头）；CORS 预检显式放行三个归属头 |
| `templates.mjs` | 模板化序列：回合输入按在场实况（NPC/背包/出口/地上物）填充模板槽位；十四种 kind 配额、free_act 十 outcome、settle 三类、群聊、条件动作 |
| `collect.mjs` | playwright 采集驱动：lane 分片并发、真实完成检测、输入校验（非空字符串否则中止不进入付费采样）、每回合写 `window.__qucuoSampling` 归属标签 |
| `postprocess.mjs` | 后处理：按 trace 头归属；intake schema 合格率；尾章按主叙事输出是否含 `---SEAL---` 分判官/群聊两线统计可解析率；kind/outcome 实际分布对配额，缺口如实列出 |
| `scanPack.mjs` | 打包前口令/密钥扫描（命中即拒包）；`ai_calls*.jsonl` 原件必须进包，派生文件不能替代 |
| `verifyCors.mjs` | CORS 预检实证：stub 上游+代理+无头浏览器，验证自定义头经预检放行且归属留底齐全（已通过） |

## 跑一批

```bash
# 0. 口令（只写本机文件，绝不进仓/artifact）
mkdir -p ~/.sampling && echo 'KEY=sk-...' > ~/.sampling/keyline && chmod 600 ~/.sampling/keyline

# 1. 起代理
node scripts/sampling/proxy.mjs &

# 2. 采集（单调用+影子，满血情境；injured 为原重伤存档，两组分开统计）
SAMPLING_MODE=single SAMPLING_SCENARIO=fullhp \
SAMPLING_LANE=0 SAMPLING_LANES=1 SAMPLING_TURNS=205 \
  node scripts/sampling/collect.mjs

# 3. 后处理
node scripts/sampling/postprocess.mjs

# 4. 扫描+打包（扫描不过拒绝打包）
node scripts/sampling/scanPack.mjs
```

## 配额口径（lane-aware 全局调度）

- 配额是**全局账**不是单 lane 账：模板按 target 展开成实例全局编号，`instanceIndex % lanes` 分配到各 lane（`buildLaneQueue`），多 lane 并发无重无漏。
- lanes×turns 容量：实例总数 228（talk12+move12+inspect12+take10+give12+trade12+steal10+duel10+appease10+learn10+invite10+use_item10+equip10+free_act60+settle15+群聊5+条件5）是**全局总账**，不是每 lane 都要跑这么多。例：8 lane 时每 lane 队列仅 28/29 条，`SAMPLING_TURNS=30` 即覆盖全部；单 lane 全量才需要 228。`SAMPLING_TURNS` 超本 lane 队列长度自动截断（`targetTurns=min`），多退少不补。
- 十四种 kind 每类 ≥10 回合；free_act 十种 outcome 每类 ≥5；settle 三类、群聊、条件动作各 ≥5——意图层达标有测试（1/4/8 lane 模拟）。
- **实际** kind 分布由后处理从 intake 响应实测，缺口写进 `a4_report.json` 的 `quotaGaps`，不粉饰。
- 槽位缺料（没有合适的人/物）在**同 lane 队列**内换下一条可填实例（缺料实例后移再试），跳过原因记进 exports 的 `skippedLog`。

## 调用链分类口径（postprocess）

按 system prompt 稳定标识分类，不靠长度/流式猜：
- `intake`：含「前哨听意员」；`narrative_group`：含「【群聊回响】」；`narrative_judge`：含「【判官定案】」；`narrative_plain`：含「你是MUD引擎」的其余调用；其余一律 `other`（状态提取/分类/小调用）。
- **SEAL 分母只含 narrative_judge + narrative_group**——提取器落 other 绝不进分母；单调用 narrative_plain 无 SEAL 契约也不进（判官管线只在 extractionEnabled 双调用下激活 SEAL）。
- intake schema 合格率分母 = 全部 intake 调用（解析失败也计入）；合格 = 可解析 + actions 非空 + kind 全在十四枚举 + 每动作带 text/target。

## 注意事项

- 自定义请求头触发 CORS 预检——预检到的是本代理（预检放行三头），上游中转永不见这些头。已用 `verifyCors.mjs` 实证通过。
- 代理入站验签：令牌在 `~/.sampling/proxy.token`（0600，首启自动生成），collect 自动读用；无令牌一律 403，本机其他进程不能蹭配额。
- 导出前 `drainShadowTasks(60000)` 收口，聚合 JSON 内嵌 `stageCounts`/`pendingAtExport`——影子死了/丢了/在途分得清。
- trace 含批次 runId（`rXXX`），同目录重跑不串账。
- 归属是按头的尽力而为：影子判官 fire-and-forget 可能跨回合尾巴，头的 turn 归属以发起时为准，比时间窗/文本推断严格占优。
