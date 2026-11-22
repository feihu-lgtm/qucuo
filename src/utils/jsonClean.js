// JSON 容错清洗：AI 经常在 JSON 里混入中文标点、多余逗号、未闭合括号，
// 在 JSON.parse 之前先做一轮清洗，能挽救相当一部分本来会解析失败的响应。
// 参考做法：中文引号/逗号/冒号转英文、去掉行内注释、补全缺失的收尾括号。
export function cleanJsonString(str) {
  if (!str) return str;
  // 中文单引号 → 英文单引号（JSON 字符串用双引号定界，单引号怎么转都无害）
  str = str.replace(/[\u2018\u2019\u201a\u201b\u2032\u2035]/g, "'");
  // 中文标点 → 英文（只处理结构性符号，不动内容里的中文逗号顿号等——
  // 但 JSON 结构外的中文标点本就不该出现在 key/分隔符位置，这里只做最常见的误用修正）
  str = str.replace(/：/g, ":").replace(/，(?=\s*[}\]"])/g, ",");
  // 去掉行内 // 注释（简单启发式，避免误伤字符串内容中的双斜杠）
  str = str.replace(/([^:"])\/\/[^\n]*/g, "$1");
  // 去掉 /* */ 块注释
  str = str.replace(/\/\*[\s\S]*?\*\//g, "");
  // 去掉控制字符
  str = str.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  // 去掉结尾多余逗号（trailing comma），重复执行到不再变化为止
  let prev;
  do { prev = str; str = str.replace(/,\s*([}\]])/g, "$1"); } while (str !== prev);
  str = str.trim();
  // 中文双引号按位置判定：字符串外的结构性中文引号（如模型把 key/值整个用 “”
  // 包起来）转成英文引号挽救解析；字符串**内部**的中文引号是合法内容
  // （如 desc 里 写着“天都”二字），一律保留——此前无差别全转英文，反而把
  // 本来合法的 JSON 砸出未配对引号、解析必挂，提取层整份作废（兽骨变"路遇之物"真凶）。
  // 判据：引号外侧（跳过空白）紧邻 {:,[ 或行首 → 结构性开引号；
  // 内侧紧邻 :,]} 或行尾 → 结构性闭引号；其余视为内容。
  const CN_DQUOTE = /[\u201c\u201d\u201e\u201f\u2033\u2036]/;
  const OPEN_SIDE = /[{[:,]/;   // 结构开引号外侧可能紧邻的符号
  const CLOSE_SIDE = /[}\]:,]/; // 结构闭引号内侧可能紧邻的符号
  let out = "", inString = false, escape = false, braces = 0, brackets = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (escape) { out += c; escape = false; continue; }
    if (inString) {
      if (c === "\\") { escape = true; out += c; continue; }
      if (c === '"') { inString = false; out += c; continue; }
      if (CN_DQUOTE.test(c)) {
        let j = i + 1; while (j < str.length && /\s/.test(str[j])) j++;
        if (j >= str.length || CLOSE_SIDE.test(str[j])) { inString = false; out += '"'; continue; }
      }
      out += c; continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (CN_DQUOTE.test(c)) {
      let j = i - 1; while (j >= 0 && /\s/.test(str[j])) j--;
      if (j < 0 || OPEN_SIDE.test(str[j])) { inString = true; out += '"'; continue; }
      out += c; continue;
    }
    if (c === "{") braces++; else if (c === "}") braces--;
    else if (c === "[") brackets++; else if (c === "]") brackets--;
    out += c;
  }
  str = out;
  // 补全未闭合的括号（流式截断或 maxTokens 用尽时常见）
  while (brackets > 0) { str += "]"; brackets--; }
  while (braces > 0) { str += "}"; braces--; }
  str = str.replace(/,\s*([}\]])/g, "$1");
  return str;
}

