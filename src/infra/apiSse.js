// SSE 通用读取器：解析 "data: {...}" 格式的流，遇到 [DONE] 停止。
// 每解析出一个合法 JSON 事件就调用一次 onEvent(parsedObject)。
export async function readSSE(res, onEvent) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";
  const handleLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const dataStr = trimmed.slice(5).trim();
    if (!dataStr || dataStr === "[DONE]") return;
    try { onEvent(JSON.parse(dataStr)); } catch { /* 跳过无法解析的单条事件，不影响后续流 */ }
  };
  while (true) {
    let chunk;
    try {
      chunk = await reader.read();
    } catch (e) {
      const err = new Error(`流式传输中途断开：${e?.message || e}`);
      err.code = "network";
      throw err;
    }
    const { done, value } = chunk;
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop(); // 保留最后一行（可能不完整）到下一轮
    for (const line of lines) handleLine(line);
  }
  // 流结束后，缓冲区里可能还残留最后一个"没有以换行收尾"的事件——
  // 某些中转站（尤其假流式）最后一段不补换行，若不 flush 就会丢掉尾部内容，造成"莫名截断"。
  if (buf) buf.split("\n").forEach(handleLine);
}

// 剥离思考内容：把 <think>/<thinking> 块（含被截断未闭合的尾巴）从文本里去掉，
// 防止模型把思考过程漏进正文。对齐姬侠传/墨染两家的响应端处理。
export function stripReasoning(text) {
  if (!text) return text;
  let t = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").replace(/<think>[\s\S]*?<\/think>/gi, "");
  // 未闭合的思考起始标签：从它开始到结尾一并丢弃
  const m = t.match(/<think(?:ing)?>[\s\S]*$/i);
  if (m) t = t.slice(0, m.index);
  return t.trim();
}
