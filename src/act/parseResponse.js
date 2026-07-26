import { extractMvuBlock } from "../mvu.js";
import { cleanJsonString } from "../apiConfig.js";

// 解析一次原始返回 → { p, mvuCommands, dealResult }；p._truncated 表示只救回了部分完整行。
// 纯解析层：不写任何状态，结构化结果交回 act 统一提交。
export const parseMainResponse = (rawText) => {
  // 赌石谈价：先抠出末尾 <deal>{...}</deal> 结算标签（在 JSON 解析之前，因它是 JSON 外的尾巴），
  // 抠完把标签从文本里剔除，剩下的照常走主叙事解析。
  let dealResult = null;
  let rawForParse = rawText;
  const dealMatch = typeof rawText === "string" && rawText.match(/<deal>\s*([\s\S]*?)\s*<\/deal>/i);
  if (dealMatch) {
    try { dealResult = JSON.parse(dealMatch[1].replace(/[\x00-\x1f]/g, " ").trim()); } catch (_) { dealResult = null; }
    rawForParse = rawText.replace(/<deal>[\s\S]*?<\/deal>/gi, "").trim();
  }
  const { cleanText: raw, commands } = extractMvuBlock(rawForParse);
  let js = raw.replace(/```json\s*|```\s*/g, "").trim();
  const i0 = js.indexOf("{"), i1 = js.lastIndexOf("}");
  if (i0 >= 0 && i1 > i0) js = js.slice(i0, i1 + 1);
  js = js.replace(/\r?\n/g, " ").replace(/[\x00-\x1f]/g, " ");
  js = cleanJsonString(js);
  let parsed;
  try { parsed = JSON.parse(js); } catch (_) {
    const nm = js.match(/"output"\s*:\s*\[(.*?)\]/s);
    if (nm) { try { parsed = { output: JSON.parse("[" + nm[1] + "]") }; } catch (__) { parsed = null; } }
    // 截断救援：从 "output":[ 之后只抓闭合完整的字符串，丢掉末尾半句
    if (!parsed) {
      const oi = js.search(/"output"\s*:\s*\[/);
      if (oi >= 0) {
        const after = js.slice(js.indexOf("[", oi) + 1);
        const strs = after.match(/"(?:[^"\\]|\\.)*"/g);
        if (strs && strs.length) { try { parsed = { output: strs.map(s => JSON.parse(s)), _truncated: true }; } catch (__) { parsed = null; } }
      }
    }
    if (!parsed) {
      const nm2 = js.match(/"narrative"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (nm2) { parsed = { output: [nm2[1]] }; }
    }
    if (!parsed) {
      const clean = (raw || "").trim();
      // 区分两种"没解析出 JSON"：
      //   ① AI 干脆没写 JSON，直接吐了一句纯文本——通常是"打断拒答"（玩家问系统元问题时，
      //      narrator.js 要求只回一句、本轮到此为止）或纯口语应答。原始返回里根本没有 '{' 或
      //      "output" 的痕迹，说明这不是坏掉的 JSON、是 AI 有意为之。截断的 JSON 一定以 '{' 开头
      //      （截的是尾巴不是头），所以"完全没有 '{'"能可靠地把这两种情况分开。这种直接当作干净
      //      的旁白正文展示，不加"格式异常"吓人（此前会把一句正常的打断硬套上错误前缀）。
      //   ② 确实是残缺/畸形的 JSON（有 '{' 或 "output" 碎片但拼不出来）——保留"格式异常"提示 + 原文供排查。
      const looksLikeBrokenJson = /[{}]|"output"\s*:/.test(clean);
      if (clean && !looksLikeBrokenJson) {
        parsed = { output: clean.split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 6) };
      } else if (clean) {
        parsed = { output: [`（引擎回应格式异常，原始内容）${clean.slice(0, 300)}`] };
      } else {
        parsed = { output: ["（旁白一时语塞，似是被这荒僻之地的信号阻隔——可重新输入试试，或打开「📋 Pipeline」查看这次请求究竟发生了什么）"] };
      }
    }
  }
  return { p: parsed, mvuCommands: commands, dealResult };
};
