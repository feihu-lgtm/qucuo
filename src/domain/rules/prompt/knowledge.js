// 信息领域·知识系统（代码驱动 / AI 只当被调用的填词工具）
// ==================================================================
// 设计立场（按 Yaotian 的要求，比"AI提议+系统裁决"更进一步）：
//   "谁知道什么事、传到哪、几回合淡忘"这套账，**完全由游戏代码确定性推演**，
//   不交给主 AI 每轮拍脑袋。AI 在这套系统里退化成一个"按需生成一句话"的工具——
//   只有当代码需要某件事的**文字描述**、而账上还没有时，才单独发一个小 prompt
//   问 AI 要一句话，收下存进账里。这就是 agents 式分工：代码是主 agent（调度、
//   记账、推演），AI 是被主 agent 按需调用的子例程。
//
// 参照传统非 AI 游戏的成熟范式（见 qucuo-index 第五节调研）：
//   · 矮人要塞：每个人存一张"知识项 + 是否知道"的表；默认白纸一张；
//     知识经 目击/传闻/告知 传播；传闻带时间戳会淡忘；亲历的不忘。
//   · 只钉"关键事实"，不给每个 NPC 记流水账（避免膨胀 / 过度工程）。
//
// 数据落在 varTree.世界.知识领域，随存档持久化。全部纯函数，返回新 varTree。

// 途径 → 是否会随时间淡忘。亲历/剧本/被明确告知的，记牢；道听途说的，会忘。
const 会淡忘途径 = { 传闻: true, 目击: false, 告知: false, 剧本: false };

// 代码写死的推演参数（可调）：
import { random } from "../../../utils/rng.js";
import { buildPrompt } from "./buildPrompt.js";
import { allFactSummaries, ensureRoot, KROOT, writeRoot } from "./knowledgeRoot.js";
import "./calls/sideCalls.js";

// allFactSummaries 已搬到 knowledgeRoot.js（见该文件开头），这里转出，旧引用不用改。
export { allFactSummaries };

const KNOWLEDGE_PARAMS = {
  传闻默认忘却回合: 40,   // 传闻途径得知后，多少回合没被再次强化就淡忘
  同框传播概率: 0.35,     // 同一场景里，知情者每回合把某事实传给未知者的概率
  单事实同框最多传播: 1,  // 一个事实一回合最多新扩散给几个人，防止一轮全知道
};

// 登记一条事实（剧本基底或运行时新增都走这里）。已存在则不覆盖（幂等）。
// fact: { id, 摘要?, 忘却回合数?, 标签?, 知晓者?: [{name, 途径}] }
export function registerFact(varTree, fact, currentTurn) {
  if (!fact || !fact.id) return varTree;
  const 领域 = JSON.parse(JSON.stringify(ensureRoot(varTree)));
  if (领域.事实[fact.id]) return varTree; // 已有，不重复登记
  const 知晓者 = {};
  for (const k of (fact.知晓者 || [])) {
    知晓者[k.name] = { 途径: k.途径 || "剧本", 得知回合: currentTurn };
  }
  领域.事实[fact.id] = {
    id: fact.id,
    摘要: fact.摘要 || "",                                 // 空串 = 待 AI 补一句话
    忘却回合数: fact.忘却回合数 ?? KNOWLEDGE_PARAMS.传闻默认忘却回合,
    标签: fact.标签 || "",
    诞生回合: currentTurn,
    知晓者,
  };
  return writeRoot(varTree, 领域);
}

// 灌入剧本基底事实（游戏初始化时调用一次）。
export function seedKnowledge(varTree, seeds, currentTurn = 0) {
  let vt = varTree;
  for (const s of (seeds || [])) vt = registerFact(vt, s, currentTurn);
  return vt;
}

// 目击：把当前在场者标记为"亲眼见到/亲历"某事实（记牢，不淡忘）。
// 设置某事实的一句话摘要（AI 填词的结果由外层写回这里）。
export function setFactSummary(varTree, factId, 摘要) {
  const 领域 = JSON.parse(JSON.stringify(ensureRoot(varTree)));
  if (!领域.事实[factId]) return varTree;
  领域.事实[factId].摘要 = (摘要 || "").trim();
  return writeRoot(varTree, 领域);
}

// ── 每回合确定性推演（核心）──
// 1) 淡忘：传闻途径得知、且超过忘却回合数的知晓者，从名单剔除（他忘了）。
// 2) 传播：同一场景内，某事实的知情者按概率把它扩散给同场景的未知者（记为传闻途径）。
// 返回 { varTree, 待补摘要 }。待补摘要是"此刻在场者涉及、但还没有一句话描述"的事实 id 列表，
// 供外层决定是否点 AI 补词。
export function evolveKnowledge(varTree, { roomNpcNames = [], currentTurn = 0, rng = random } = {}) {
  const 领域 = JSON.parse(JSON.stringify(ensureRoot(varTree)));
  const present = roomNpcNames.filter(Boolean);

  for (const fid of Object.keys(领域.事实)) {
    const f = 领域.事实[fid];

    // 1) 淡忘
    for (const name of Object.keys(f.知晓者)) {
      const k = f.知晓者[name];
      if (会淡忘途径[k.途径] && f.忘却回合数 != null) {
        if (currentTurn - k.得知回合 >= f.忘却回合数) delete f.知晓者[name];
      }
    }

    // 2) 同框传播：在场的知情者 → 在场的未知者
    const 在场知情 = present.filter(n => f.知晓者[n]);
    const 在场未知 = present.filter(n => !f.知晓者[n]);
    if (在场知情.length && 在场未知.length) {
      let spread = 0;
      for (const target of 在场未知) {
        if (spread >= KNOWLEDGE_PARAMS.单事实同框最多传播) break;
        if (rng() < KNOWLEDGE_PARAMS.同框传播概率) {
          f.知晓者[target] = { 途径: "传闻", 得知回合: currentTurn };
          spread++;
        }
      }
    }
  }

  // 待补摘要：在场者里有人涉及（知情）、但事实还没有一句话描述的
  const 待补摘要 = [];
  for (const fid of Object.keys(领域.事实)) {
    const f = 领域.事实[fid];
    if (!f.摘要 && present.some(n => f.知晓者[n])) 待补摘要.push(fid);
  }

  return { varTree: writeRoot(varTree, 领域), 待补摘要 };
}

function isTreeRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function equalTreeValue(a, b) {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b)
      && a.length === b.length
      && a.every((value, index) => equalTreeValue(value, b[index]));
  }
  if (!isTreeRecord(a) || !isTreeRecord(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length
    && aKeys.every((key) => Object.hasOwn(b, key) && equalTreeValue(a[key], b[key]));
}

function applyTreeChanges(base, changed, latest) {
  if (equalTreeValue(base, changed)) return latest;
  if (isTreeRecord(base) && isTreeRecord(changed)) {
    const result = isTreeRecord(latest) ? { ...latest } : {};
    const keys = new Set([...Object.keys(base), ...Object.keys(changed)]);
    for (const key of keys) {
      const hadBase = Object.hasOwn(base, key);
      const hasChanged = Object.hasOwn(changed, key);
      const hasLatest = Object.hasOwn(result, key);
      if (!hasChanged) {
        if (hadBase && (!hasLatest || equalTreeValue(result[key], base[key]))) delete result[key];
        continue;
      }
      if (!hadBase) {
        if (!hasLatest) result[key] = changed[key];
        continue;
      }
      result[key] = applyTreeChanges(base[key], changed[key], result[key]);
    }
    return result;
  }
  return equalTreeValue(base, latest) ? changed : latest;
}

export function applyKnowledgeTreeDiff(baseTree, evolvedTree, latestTree) {
  return applyTreeChanges(baseTree || {}, evolvedTree || {}, latestTree || {});
}

// 查某人知道哪些事实（返回 [{id, 摘要, 途径}]）。
// 组装注入主剧情 prompt 的"信息域"硬约束块：列出此刻在场人物对各关键事实的知情状态。
// 只列"至少有一个在场者知情"的事实（无人知情的不占篇幅）。没有则返回空串。
export function buildInfoDomainBlock(varTree, roomNpcNames = []) {
  const 领域 = ensureRoot(varTree);
  const present = roomNpcNames.filter(Boolean);
  if (!present.length) return "";
  const lines = [];
  for (const fid of Object.keys(领域.事实)) {
    const f = 领域.事实[fid];
    const 知情 = present.filter(n => f.知晓者[n]);
    if (!知情.length) continue;                       // 在场没人知道这事，略过
    const 不知 = present.filter(n => !f.知晓者[n]);
    const 摘要 = f.摘要 || "（内容待定）";
    let line = `- 事实「${摘要}」：知情者 ${知情.join("、")}`;
    if (不知.length) line += `；在场但不知情 ${不知.join("、")}`;
    lines.push(line);
  }
  if (!lines.length) return "";
  return `\n\n【信息域·关键事实认知（系统裁定，硬约束）】在场人物对关键事实的知情状态如下，由系统确定性推演。NPC 言行必须与此严格一致：列"知情"者可自然表现出知道；列"不知情"或未列出者，本轮绝不能表现出知道，也不能刚听说就当作早已知晓。\n${lines.join("\n")}`;
}

// 全知视角读取：不看"谁在场""谁知情"，直接把账本里所有已经有摘要的事实原样列出。
// 专供"旁白"这种设定上跳出信息隔离、本就该知道游戏里发生一切的角色使用——
// 普通 NPC 走 buildInfoDomainBlock（受限于在场+知情），旁白走这个（全量、无门槛）。
// 只排除"待补摘要"（摘要还是空串）的事实，那些本来就没内容可给。
// limit 控制最多带几条，太长的账本只取最近发生的若干条，避免 prompt 无限膨胀。

// 为"待补摘要"的事实，构造问 AI 要一句话描述的子请求（外层拿去调 callModel）。
// 返回 { system, messages, maxTokens }。cue 是这条事实的线索（id/标签/触发语境）。
// 这是"召不回旧事时"的纯现编兜底路径。
export function factSummaryRequest(cue) {
  const { system, messages, maxTokens } = buildPrompt("fact.summary", { cue });
  return { system, messages, maxTokens };
}

// 内容层优先路径：先从向量库召回"真发生过的相关旧事"，把这些旧事**作为素材**交给 AI
// 归纳成一句话。要求 AI 只依据素材、不得编造素材里没有的情节——保证这句描述有据可查、
// 勾连真实剧情，而非空口现编。recallTexts 为召回到的若干旧事文本。
export function factSummaryRequestFromRecall(cue, recallTexts) {
  const { system, messages, maxTokens } = buildPrompt("fact.summaryFromRecall", { cue, recallTexts });
  return { system, messages, maxTokens };
}
