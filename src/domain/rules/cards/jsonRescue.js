// 模型返回的 JSON 救援解析（从 scanPrompts.js 拆出）
// ============================================================================
// ── JSON 救援解析 ─────────────────────────────────────────────────────────────

/**
 * 免费反代很可能吞掉 responseMimeType，模型也可能不听话加围栏或说两句闲话。
 * 所以不能直接 JSON.parse，按三层救援：
 *   1. 直接 parse
 *   2. 剥 markdown 围栏后 parse
 *   3. 截取首个 { 或 [ 到末个 } 或 ] 之间的片段 parse
 * 三层都失败才算失败，由调用方决定重试还是降级。
 */
// 截断救援：数组开了头但没闭合（被 maxTokens 切断在半路）。找到最后一个「刚
// 闭合的顶层对象」，丢掉后面残缺的那半个，补上右括号。
//
// 【为什么要自己扫而不是 lastIndexOf("}")】条目里有嵌套对象（落脚规划的
// weights 就是），最后一个 } 很可能是嵌套那层的。形如
//   [{"name":"甲",...},{"name":"乙","weights":{"锦官
// 的输入，lastIndexOf 会截到「锦官」前面那个不存在的位置，补出来的还是坏 JSON。
// 括号计数 + 字符串内不计数才能定位到数组内的顶层边界。
//
// 【为什么值得救】批量规划一次六人，截断通常发生在最后一两个人身上。救回来意味着
// 前四五个人的规划还在，跟 cardScan 那边「一批失败不该让前面白丢」同一个道理。
function salvageTruncatedArray(text) {
  const start = text.indexOf("[");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false, lastGood = -1;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === "\"") { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return null;      // 数组本来就闭合，用不着救
      if (depth === 1 && ch === "}") lastGood = i;   // 数组内一个顶层对象刚收尾
    }
  }
  return lastGood > start ? text.slice(start, lastGood + 1) + "]" : null;
}

export function parseJsonLoose(text) {
  if (typeof text !== "string" || !text.trim()) {
    const e = new Error("模型没有返回内容");
    e.code = "EMPTY";
    throw e;
  }
  const attempts = [];

  attempts.push(text.trim());

  // 剥围栏：```json ... ``` 或 ``` ... ```
  const fence = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence) attempts.push(fence[1].trim());

  // 只有开围栏、没有闭围栏（模型忘了收尾，或收尾那几个字被截掉了）
  const openOnly = text.replace(/^\s*```(?:json|JSON)?\s*/i, "").replace(/\s*```\s*$/, "");
  if (openOnly !== text) attempts.push(openOnly.trim());

  // 被截断的数组，救回已经完整的那几条。
  //
  // 【为什么要排在「截取最外层括号」之前】那一步是 {} 优先于 []，而对
  //   [{"name":"甲","mode":"mention"},{"name":"乙","mo
  // 这种截断输入，它会先截出第一个 {...} 并**成功**解析成单个对象。调用方拿到的
  // 就不是数组了——sanitizePlacementPlan 收到非数组直接返回空，救援等于白做。
  // 这一条是写测试时才发现的，三条用例全挂在这个顺序上。
  //
  // 【为什么加 expectsArray 条件而不是无脑提前】有的阶段返回的本来就是单个对象，
  // 而对象里若嵌着数组（形如 {"list":[…}），无条件提前会让救援从内层 [ 开始，
  // 救出一个丢了外层 key 的数组片段——形状对不上，比失败更糟。只在正文本身以
  // [ 开头时才认为期望数组。
  const salvaged = salvageTruncatedArray(text);
  const expectsArray = text.trim().startsWith("[") || openOnly.trim().startsWith("[");
  if (salvaged && expectsArray) attempts.push(salvaged);

  // 截取最外层括号
  for (const [open, close] of [["{", "}"], ["[", "]"]]) {
    const a = text.indexOf(open);
    const b = text.lastIndexOf(close);
    if (a >= 0 && b > a) attempts.push(text.slice(a, b + 1));
  }

  if (salvaged && !expectsArray) attempts.push(salvaged);

  let lastErr = null;
  for (const cand of attempts) {
    try {
      const v = JSON.parse(cand);
      if (v && typeof v === "object") return v;
    } catch (err) { lastErr = err; }
  }

  // 区分两种失败，因为它们的补救办法完全相反：
  //   TRUNCATED —— 确实在输出 JSON，但被 maxTokens 截断了（有 { 或 [ 却没闭合）。
  //                 拆小批次或调大 maxTokens 能解决，值得再花额度。
  //   NOT_JSON  —— 模型压根没在输出 JSON（回了"抱歉"之类）。这是模型能力或
  //                 提示词的问题，拆小一百次也一样，必须熔断别再烧额度。
  // 实测教训：不区分的话，一批 4 人全失败会一路拆到 1 人、连重试共烧 7 次调用，
  // 三批就是 21 次——预算 4 次的活干成了 21 次，额度全花在必定失败的重试上。
  //
  // 【为什么也要看 [】原来只查 {。而截断可能早到只吐出了围栏加一个左方括号
  //（思考模型把额度吃光时就是这样），那时 indexOf("{") 是 -1，会被误判成
  // NOT_JSON 熔断，提示玩家"模型压根没在输出 JSON"——补救方向正好相反。
  const opener = Math.min(
    ...[text.indexOf("{"), text.indexOf("[")].filter(i => i >= 0),
    Infinity);
  const tail = text.trimEnd();
  const looksTruncated = opener !== Infinity
    && !tail.endsWith("}") && !tail.endsWith("]");
  const e = new Error(looksTruncated
    ? `输出被截断（写到第 ${text.length} 字断掉），把 maxTokens 调大或拆小批次`
    : `模型返回的不是合法 JSON：${lastErr?.message || "未知原因"}`);
  e.code = looksTruncated ? "TRUNCATED" : "NOT_JSON";
  e.raw = text.slice(0, 400);
  throw e;
}
