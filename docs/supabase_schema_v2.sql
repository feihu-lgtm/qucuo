-- 曲措乡 Bug 上报系统 v2：拆分成两张表
-- bug_reports：一次上报的基本信息（原有字段，去掉了 pipeline_log）
-- pipeline_calls：这次上报附带的每一次 AI 调用，一行一条，用 report_id 关联回 bug_reports
--
-- 迁移说明：如果 bug_reports 表已存在且带 pipeline_log 字段，这份 SQL 不会删除旧表/旧数据，
-- 只是新建 pipeline_calls 表 + 在 bug_reports 上删掉 pipeline_log 列（历史数据里那一列的
-- 旧记录会连带丢失，如果需要保留旧数据，先手动导出 pipeline_log 内容再执行这份 SQL）。

-- ── 主表：一次上报的基本信息 ──
create table if not exists bug_reports (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  player_note text,
  game_state jsonb,
  conversation jsonb,
  version text,
  user_agent text
);

-- 如果是从旧版迁移过来、表已存在，去掉不再需要的 pipeline_log 列
alter table bug_reports drop column if exists pipeline_log;

alter table bug_reports enable row level security;

drop policy if exists "anyone can insert bug reports" on bug_reports;
create policy "anyone can insert bug reports"
  on bug_reports for insert
  to anon
  with check (true);

-- ── 明细表：每一次 AI 调用单独一行 ──
create table if not exists pipeline_calls (
  id bigint generated always as identity primary key,
  report_id bigint references bug_reports(id) on delete cascade,
  seq bigint,                  -- 全局递增序号，同一次上报内按顺序排列，前端生成
  call_label text,             -- 用途标签，如"主叙事""状态提取(COMBAT)""事实摘要"
  system_prompt text,          -- 完整 system prompt 原文
  user_message text,           -- 完整用户输入原文（多条 user 消息时按顺序拼接）
  response text,               -- AI 完整原始回复，含 <mvu> 块原文，不额外拆解
  success boolean,             -- 这次调用是否成功
  error_message text,          -- 失败时的错误信息，成功则为空
  model text,                  -- 模型名，如 gemini-2.5-pro
  duration_ms bigint,          -- 耗时（毫秒）
  created_at timestamptz default now()
);

-- 按 report_id 查询是最常见的操作（"查这次上报关联的所有调用"），建索引加速
create index if not exists idx_pipeline_calls_report_id on pipeline_calls(report_id);
-- 按 seq 排序展示也常用
create index if not exists idx_pipeline_calls_report_seq on pipeline_calls(report_id, seq);

alter table pipeline_calls enable row level security;

drop policy if exists "anyone can insert pipeline calls" on pipeline_calls;
create policy "anyone can insert pipeline calls"
  on pipeline_calls for insert
  to anon
  with check (true);

-- 常用查询示例（后台自己用，不是前端跑的）：
-- 查某次上报的所有调用，按顺序排列：
--   select * from pipeline_calls where report_id = 123 order by seq asc;
-- 查所有"主叙事"类型的调用（最近50条）：
--   select * from pipeline_calls where call_label = '主叙事' order by created_at desc limit 50;
-- 查某次上报 + 关联的所有调用（一次查完）：
--   select r.*, c.* from bug_reports r
--   left join pipeline_calls c on c.report_id = r.id
--   where r.id = 123 order by c.seq asc;
