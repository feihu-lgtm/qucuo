// 日总结（大纸条）· 记忆系统远景层
// ------------------------------------------------------------------
// 小纸条(note.js)管"想起相关往事"，靠向量语义捞；日总结管"垫底的连续背景"，
// 不向量化、按时间从近到远塞进预算、塞不下丢最老。设计见 docs/交接_借鉴总结系统.md 第 2 节。
//
// 触发：曲措乡 24 回合 = 1 天，跨天时后台另开一次独立 AI 调用，重读刚过去这一天
// 攒下的原料（各来源小纸条文本），归纳成几句连贯的日志。存进 varTree.世界.日总结，
// 随存档走（先塞 varTree，破 5MB 再考虑迁 IDB）。
//
// 本模块只提供纯函数（请求构造 + 存取），实际 AI 调用与 setVarTree 由 MudRPG 编排，
// 便于 debug.mjs 单测、也便于降级（AI 失败就不写，缺一天日总结无伤大雅）。

export const MAX_DAY_SUMMARIES = 14; // 最多留最近 14 天，超出丢最老（远景垫底，够用即可）

// 纯函数：构造日总结的 AI 请求（system + messages）。materialLines 为这一天攒下的
// 小纸条文本数组（已按时间序）。要求 AI 用说书人口吻归纳成 2-4 句连贯白描，只记事实脉络。
export function buildDaySummaryRequest(dayLabel, materialLines) {
  const material = (materialLines || []).filter(Boolean).map((t, i) => `${i + 1}. ${t}`).join("\n");
  const system = "你是曲措乡这个武侠世界的说书人。现在要把主角某一天里发生的零散事记，归纳成一段连贯、简练的日志，供日后当作背景垫底回顾。用白话古文、章回说书人口吻，2-4 句话，只写事实脉络（去了何处、遇见何人、做成或没做成什么、结下或了断什么），按时间先后串成一段通顺的话，不要罗列、不要编造原料里没有的事、不要写心理活动。直接输出这段话，不要 JSON、不要标题、不要多余解释。";
  const user = `【${dayLabel}·这一天的零散事记】\n${material || "（这一天并无值得记述之事）"}\n\n请归纳成一段连贯的当日日志。`;
  return { system, messages: [{ role: "user", content: user }] };
}

// 纯函数：把新的一条日总结并进 varTree.世界.日总结，并裁到 MAX_DAY_SUMMARIES 条（丢最老）。
// 返回新的 varTree（浅拷贝）。entry: { day, label, text, turn }。
export function appendDaySummary(varTree, entry) {
  const 世界 = { ...(varTree.世界 || {}) };
  const list = [...(世界.日总结 || []), entry];
  世界.日总结 = list.slice(-MAX_DAY_SUMMARIES);
  return { ...varTree, 世界 };
}

// 纯函数：取最近 n 条日总结，拼成注入 prompt 的「远景」文本块。无则返回空串。
export function buildDistantViewBlock(varTree, n = 5) {
  const list = (varTree.世界?.日总结 || []).slice(-n);
  if (!list.length) return "";
  const body = list.map(s => `· ${s.label ? `〔${s.label}〕` : ""}${s.text}`).join("\n");
  return "\n\n[远景·前些时日的经历梗概，作背景垫底，行文时不必逐条复述，只用于保持前后连贯]\n" + body;
}
