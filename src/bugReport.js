// Bug 上报 —— 玩家点一下，把当前这局的对话/日志/状态打包上传到 Supabase 后台，
// 供开发者排查问题。纯前端 GitHub Pages 没有自己的后端，借 Supabase 当"账本"。
//
// 用的是 Supabase 的 REST API（PostgREST），fetch 直连，不引整个 supabase-js 库
// （省几百KB打包体积）。anon key 是设计成可公开放前端的——配合表上的 RLS 策略
// （anyone can insert，不能读），玩家只能提交、读不到任何人的数据，安全。
//
// 对应表结构（在 Supabase SQL Editor 里建）：
//   bug_reports(id, created_at, player_note, game_state, conversation, pipeline_log, version, user_agent)

const SUPABASE_URL = "https://jgijklgbbaszijpfcvdf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnaWprbGdiYmFzemlqcGZjdmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4OTc1OTQsImV4cCI6MjEwMDQ3MzU5NH0.j4bN2kvU-7ffH7wIauxRBmuV_t1htax2-sc3WFY-LCk";

// 提交一条 bug 报告。payload 里各字段都可选，缺了不影响入库。
// 返回 { ok: true } 或 { ok: false, error: "人话错误" }，调用方据此给玩家反馈。
export async function submitBugReport({ playerNote, gameState, conversation, pipelineLog, version }) {
  try {
    const body = {
      player_note: playerNote || "",
      game_state: gameState || null,
      conversation: conversation || null,
      pipeline_log: pipelineLog || null,
      version: version || "",
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000); // 15s 超时（记录可能较大）
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/bug_reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=minimal", // 不需要返回插入的行，省流量
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      // 常见：表没建(404)、RLS 拦截(401/403)、字段不符(400)
      let detail = "";
      try { detail = (await resp.text()).slice(0, 200); } catch { /* ignore */ }
      return { ok: false, error: `上传失败（${resp.status}）${detail ? "：" + detail : ""}` };
    }
    return { ok: true };
  } catch (e) {
    if (e.name === "AbortError") return { ok: false, error: "上传超时，请检查网络后重试" };
    return { ok: false, error: `上传出错：${e.message || e}` };
  }
}
