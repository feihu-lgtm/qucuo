// 访客计数 —— 封面显示"X 位侠客 · 共 Y 人次踏足曲措乡"。
// 纯前端 GitHub Pages 没后端，借已接好的 Supabase（见 bugReport.js 同一个项目）当账本。
//
// 两个口径：
//   · 人次 Y（不去重）：每次进游戏 +1，反映总访问热度。
//   · 侠客数 X（去重）：同一浏览器只算一个人——靠 localStorage 里一个持久 UUID
//     作"访客指纹"，插入 visitors 表；表上 visitor_id 建唯一约束，重复插入被拒
//     （409）即老访客，插入成功即新侠客。前端拿不到真实公网 IP，用本地 UUID 去重
//     是纯前端能落地的等价方案（同设备算一人，比公共计数器的"谁刷都 +1"准得多）。
//
// 全程失败静默降级：任何一步挂了都不显示对应数字，绝不拖累游戏本身。
//
// 需要在 Supabase SQL Editor 建的表 + 策略（一次性）：
//   create table visitors (
//     visitor_id text primary key,           -- 本地 UUID，主键即唯一约束
//     created_at timestamptz default now()
//   );
//   create table hits (
//     id bigint generated always as identity primary key,
//     visitor_id text,                        -- 记是谁访问的，供"今日活跃侠客"去重
//     created_at timestamptz default now()
//   );
//   alter table visitors enable row level security;
//   alter table hits     enable row level security;
//   create policy "anon insert visitors" on visitors for insert to anon with check (true);
//   create policy "anon count visitors"  on visitors for select to anon using (true);
//   create policy "anon insert hits"     on hits     for insert to anon with check (true);
//   create policy "anon count hits"      on hits     for select to anon using (true);
// （select 只为了 count(*)，读不到别人的具体 id 也无所谓——这里本就只暴露总数）

const SUPABASE_URL = "https://jgijklgbbaszijpfcvdf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnaWprbGdiYmFzemlqcGZjdmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4OTc1OTQsImV4cCI6MjEwMDQ3MzU5NH0.j4bN2kvU-7ffH7wIauxRBmuV_t1htax2-sc3WFY-LCk";

const H = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
};

// 取/生成本浏览器的持久访客 UUID（localStorage，无痕模式则退回一次性内存值）
function getVisitorId() {
  try {
    let id = localStorage.getItem("qucuo_visitor_id");
    if (!id) {
      id = (crypto?.randomUUID?.() || `v_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      localStorage.setItem("qucuo_visitor_id", id);
    }
    return id;
  } catch {
    return `v_${Date.now()}_${Math.random().toString(36).slice(2)}`; // 无痕：每次新的，只影响自己
  }
}

// 用 PostgREST 的 count 精确统计一张表的行数（HEAD 请求 + Prefer:count=exact，
// 行数在 Content-Range 响应头里，不拉数据本身，省流量）
async function countRows(table, signal) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    method: "HEAD",
    headers: { ...H, "Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0" },
    signal,
  });
  const cr = resp.headers.get("content-range"); // 形如 "0-0/1234" 或 "*/1234"
  if (!cr) return null;
  const total = parseInt(cr.split("/")[1], 10);
  return Number.isFinite(total) ? total : null;
}

// 查"今日活跃侠客"：今天(本地日界)来过的不同人数(按 visitor_id 去重，含老侠客重来)。
// PostgREST 不直接支持 count(distinct)，故拉今天所有 hits 的 visitor_id 列表在前端去重。
// 数据量是"今天的访问次数"，通常几十到几百行，可接受；失败返回 null。
async function countTodayActive(signal) {
  // 今天 0 点（本地时区）的 ISO 时间，作为 created_at 下界
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const since = midnight.toISOString();
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/hits?select=visitor_id&created_at=gte.${encodeURIComponent(since)}`,
    { headers: H, signal });
  if (!resp.ok) return null;
  const rows = await resp.json();
  if (!Array.isArray(rows)) return null;
  const uniq = new Set(rows.map(r => r.visitor_id).filter(Boolean));
  return uniq.size;
}

// 主入口：登记本次访问并取回 { visitors, hits, todayActive }（任一失败则该项为 null）。
export async function registerVisit() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  const result = { visitors: null, hits: null, todayActive: null };
  const vid = getVisitorId();

  const sessionCounted = (() => {
    try { return sessionStorage.getItem("qucuo_hit_counted") === "1"; } catch { return false; }
  })();

  try {
    // 1) 去重侠客：插入本地 UUID，成功=新侠客，409(唯一冲突)=老访客，都算"来过"
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/visitors`, {
        method: "POST",
        headers: { ...H, "Prefer": "return=minimal,resolution=ignore-duplicates" },
        body: JSON.stringify({ visitor_id: vid }),
        signal: ctrl.signal,
      });
    } catch { /* 插入失败不影响计数读取 */ }

    // 2) 人次：本会话没记过才插一行 hits（带上 visitor_id，供"今日活跃"去重统计）
    if (!sessionCounted) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/hits`, {
          method: "POST",
          headers: { ...H, "Prefer": "return=minimal" },
          body: JSON.stringify({ visitor_id: vid }),
          signal: ctrl.signal,
        });
        try { sessionStorage.setItem("qucuo_hit_counted", "1"); } catch { /* ignore */ }
      } catch { /* ignore */ }
    }

    // 3) 读三个数（并发）：累计人次、去重侠客总数、今日活跃侠客
    const [h, v, t] = await Promise.all([
      countRows("hits", ctrl.signal).catch(() => null),
      countRows("visitors", ctrl.signal).catch(() => null),
      countTodayActive(ctrl.signal).catch(() => null),
    ]);
    result.hits = h;
    result.visitors = v;
    result.todayActive = t;
  } catch { /* 整体失败：保持 null，调用方静默不显示 */ }
  finally { clearTimeout(timer); }

  return result;
}
