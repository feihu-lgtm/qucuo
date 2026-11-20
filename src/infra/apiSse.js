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
    const { done, value } = await reader.read();
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
