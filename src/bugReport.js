// Bug 上报 —— 玩家点一下，把当前这局的对话/日志/状态打包上传到 Supabase 后台，
// 供开发者排查问题。纯前端 GitHub Pages 没有自己的后端，借 Supabase 当"账本"。
//
// 用的是 Supabase 的 REST API（PostgREST），fetch 直连，不引整个 supabase-js 库
// （省几百KB打包体积）。anon key 是设计成可公开放前端的——配合表上的 RLS 策略
// （anyone can insert，不能读），玩家只能提交、读不到任何人的数据，安全。
//
// v2 拆成两张表（原来 pipeline_log 挤在 bug_reports 里一个 jsonb 数组，开发者要
// 解开一大坨 JSON 才能看清某一次调用；现在每次 AI 调用单独一行，后台直接按行看，
// 每个字段都是纯文本）：
//   bug_reports(id, created_at, player_note, game_state, conversation, version, user_agent)
//   pipeline_calls(id, report_id, seq, call_label, system_prompt, user_message,
//                  response, success, error_message, model, duration_ms, created_at)
// 建表 SQL 见 docs/supabase_schema_v2.sql。

const SUPABASE_URL = "https://jgijklgbbaszijpfcvdf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnaWprbGdiYmFzemlqcGZjdmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4OTc1OTQsImV4cCI6MjEwMDQ3MzU5NH0.j4bN2kvU-7ffH7wIauxRBmuV_t1htax2-sc3WFY-LCk";

// 一次 fetch 到 Supabase REST API 的小封装，统一超时/错误处理。
// returnRepresentation=true 时要求 PostgREST 把插入后的行（含自动生成的 id）返回，
// 供后续需要外键关联的场景使用（比如 bug_reports 插入后要用它的 id 关联 pipeline_calls）。
async function supabasePost(table, body, { returnRepresentation = false, timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": returnRepresentation ? "return=representation" : "return=minimal",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      let detail = "";
      try { detail = (await resp.text()).slice(0, 300); } catch { /* ignore */ }
      return { ok: false, error: `上传失败（${resp.status}）${detail ? "：" + detail : ""}` };
    }
    if (returnRepresentation) {
      try {
        const rows = await resp.json();
        return { ok: true, rows };
      } catch (e) {
        return { ok: false, error: `插入成功但解析返回值失败：${e.message || e}` };
      }
    }
    return { ok: true };
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") return { ok: false, error: "上传超时，请检查网络后重试" };
    return { ok: false, error: `上传出错：${e.message || e}` };
  }
}

// 把 userMessages（callModel 那种 [{role,content}] 数组）拼成一段纯文本，
// 多条消息按顺序标注 role 再拼接，保持可读、不需要再解析结构。
function flattenUserMessages(messages) {
  if (!Array.isArray(messages)) return "";
  return messages.map(m => `[${m.role || "user"}] ${m.content || ""}`).join("\n\n");
}

// 把 getPipelineLog() 返回的原始 pipelineLog 数组（每条含 seq/callLabel/systemPrompt/
// userMessages/response/success/error/model/durationMs），转换成要写进 pipeline_calls
// 表的行数组。report_id 由调用方在拿到 bug_reports 插入结果后再统一补上。
function pipelineEntriesToRows(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map(e => ({
    seq: e.seq ?? null,
    call_label: e.callLabel || "未标注",
    system_prompt: e.systemPrompt || "",
    user_message: flattenUserMessages(e.userMessages),
    response: e.success ? (e.response || "") : "",
    success: !!e.success,
    error_message: e.success ? null : (e.error || ""),
    model: e.model || "",
    duration_ms: e.durationMs ?? null,
  }));
}

// 提交一条 bug 报告。payload 里各字段都可选，缺了不影响入库。
// pipelineLog 传入的是 getPipelineLog() 的原始数组（未分组，函数内部自己拆行）。
// 两步提交：① 插 bug_reports 拿到 report_id；② 若有 pipelineLog，批量插 pipeline_calls
// （每条带上 report_id）。第②步失败不影响第①步已经成功的事实，仍返回 ok:true，
// 只是在返回结果里带一句提示，避免"报告主体明明存进去了，却因为附带日志失败
// 就让玩家以为整个提交都失败了"。
// 返回 { ok: true, pipelineWarning? } 或 { ok: false, error: "人话错误" }。
export async function submitBugReport({ playerNote, gameState, conversation, pipelineLog, version }) {
  const reportBody = {
    player_note: playerNote || "",
    game_state: gameState || null,
    conversation: conversation || null,
    version: version || "",
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };

  const hasPipeline = Array.isArray(pipelineLog) && pipelineLog.length > 0;
  // 只有需要写 pipeline_calls 时才要求返回 id；不带 pipeline 时走原来的轻量路径。
  const reportResult = await supabasePost("bug_reports", reportBody, { returnRepresentation: hasPipeline });
  if (!reportResult.ok) return reportResult;

  if (!hasPipeline) return { ok: true };

  const reportId = reportResult.rows?.[0]?.id;
  if (reportId == null) {
    // 主表插入成功了，但没能拿到 id（比如 RLS 只允许 insert 不允许 select 导致 representation 拿不到）——
    // 报告本体已经存进去，只是没法关联 pipeline_calls，如实告知但不算整体失败。
    return { ok: true, pipelineWarning: "报告已提交，但未能获取关联ID，本次调用日志未上传。" };
  }

  const rows = pipelineEntriesToRows(pipelineLog).map(r => ({ ...r, report_id: reportId }));
  const pipelineResult = await supabasePost("pipeline_calls", rows, { returnRepresentation: false });
  if (!pipelineResult.ok) {
    return { ok: true, pipelineWarning: `报告已提交，但调用日志上传失败：${pipelineResult.error}` };
  }
  return { ok: true };
}

