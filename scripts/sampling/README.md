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

## 配额口径

- 十四种 kind 每类 ≥10 回合；free_act 十种 outcome 每类 ≥5；settle 三类、群聊、条件动作各 ≥5。
- 采集时按模板意图追踪配额（模板 target 含 2 余量抵消 skip/误分类）；**实际** kind 分布由后处理从 intake 响应实测，缺口写进 `a4_report.json` 的 `quotaGaps`，不粉饰。
- 槽位缺料（没有合适的人/物）换下一条模板，跳过原因记进 exports 的 `skippedLog`。

## 注意事项

- 自定义请求头触发 CORS 预检——预检到的是本代理（预检放行三头），上游中转永不见这些头。已用 `verifyCors.mjs` 实证通过。
- 归属是按头的尽力而为：影子判官 fire-and-forget 可能跨回合尾巴，头的 turn 归属以发起时为准，比时间窗/文本推断严格占优。
