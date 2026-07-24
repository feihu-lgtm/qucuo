// 任务专属 prompt harness（本轮新增，"档2"方案）
//
// 背景：感叹号面板点击后，此前有两种路径——(A) 送一句话给主叙事AI，AI
// 依然可能不完全按这句话演；(B) questScripts.js 的固定台本，100%确定
// 但只覆盖了已经登记过台本的少数节点。这次要的是第三种：触发本身完全
// 由系统强制判定（不再需要AI自己在 delta.flags_add 里吐出 completionFlag
// 这一步），只是"生成什么样的具体文字"这件事依然交给AI，但AI收到的
// 不是主叙事那套通用system prompt，而是一份只服务于这一个任务节点、
// 把生成范围死死框住的专属prompt。
//
// 关键设计原则：
// 1. 状态变更（好感度/道具/flag等）不依赖这次AI输出——onReach 里已经
//    写死了这一步该产生什么效果，系统在调用AI之前或之后直接应用，跟
//    AI这次具体写了什么文字无关。AI只负责"把已经确定发生的事，写成
//    一段像样的话"，不负责"决定发生什么"。
// 2. 专属prompt要求AI只输出纯文本叙事，不要求输出JSON/flags这类结构化
//    字段——这些都已经由系统层面锁定，让AI去输出反而是多余的自由度，
//    是这次要收紧的东西。
// 3. 如果这次AI调用失败（网络错误等），依然要有兜底——用
//    questScripts.js 里如果登记了台本就退回台本展示，没有登记就退回
//    stage.description 本身作为兜底文字，保证"点了就一定有反馈"这个
//    强制性不会因为AI调用失败而落空。

import { callModel } from "../apiConfig.js";
import { getQuestScript } from "./questScripts.js";

// 构造这次专属调用的 system prompt。故意写得很短、很收窄——不给AI
// "这个世界还有别的什么事" "这个角色除了这句话还能说别的" 这类自由发挥
// 空间，只交代清楚"这一步具体发生了什么，请你把它写成叙事正文"。
function buildHarnessPrompt({ quest, stage, choiceLabel, npcName }) {
  const system = `你是一段极短篇幅武侠叙事的写手，这次只需要完成一件非常
具体的小事——不是自由创作，是把"已经确定发生的一件事"写成一段自然的
叙事正文。

严格限制：
1. 只写这一件事，不要引入这件事之外的情节、不要让其他角色突然登场、
   不要评论世界局势或者铺垫别的伏笔——这些都不是这次的任务。
2. 只输出叙事正文本身（纯文本），不要输出JSON、不要输出任何标记符号、
   不要在末尾附加总结或者说明。
3. 篇幅控制在150-300字，不需要太长，但要把这件事讲清楚、有具体的场景
   和对话，不能只是一句概括。
4. 对话用「」包裹，旁白不加任何标记。
5. 这件事的具体内容和结果已经确定（见下方），你只负责把它演绎成生动
   的文字，不能改变结果、不能让这件事"没有发生"或者"发生了别的事"。`;

  const eventDesc = choiceLabel
    ? `玩家在「${quest.title}」这个情节里，选择了：${choiceLabel}。`
    : `玩家在「${quest.title}」这个情节里，推进到了下一步。`;

  const user = `${eventDesc}
这一步的具体内容：${stage.description}
${npcName ? `涉及的关键人物：${npcName}` : ""}

请把上面这件事写成一段叙事正文，按system prompt的要求来。`;

  return { system, user };
}

// 核心入口：执行一次"专属prompt harness"调用。
// 参数：
//   quest, stage —— 当前任务和stage对象（跟 qucuoQuests.js 里的结构一致）
//   choiceLabel  —— 如果这一步是分支选择（stage.choices 命中的某一项），
//                   传入该选项的 label；不是分支节点则传 null
//   apiCfg       —— 当前的API配置（复用主引擎已有的配置，不需要单独配置
//                   一套模型，专属prompt只是system prompt不同，模型本身
//                   跟主叙事共用同一套）
// 返回：{ text, usedFallback }
//   text         —— 最终展示的叙事文字（AI生成成功则是AI写的，失败则是
//                   兜底文字）
//   usedFallback —— 这次是否走了兜底（AI调用失败时为 true），供调用方
//                   决定要不要在日志里额外提示"这次是兜底文本"
export async function runQuestPromptHarness({ quest, stage, choiceLabel, apiCfg, npcName }) {
  const { system, user } = buildHarnessPrompt({ quest, stage, choiceLabel, npcName });
  try {
    const result = await callModel(apiCfg, system, [{ role: "user", content: user }], {
      maxTokens: apiCfg.callTokenLimits?.questHarness ?? 3000,
      callLabel: `任务专属harness（${quest.title}）`,
    });
    const text = (result.text || "").trim();
    if (text) return { text, usedFallback: false };
    // AI 返回了空字符串这种边界情况，同样走兜底，不展示空白
    return { text: fallbackText(quest, stage, choiceLabel), usedFallback: true };
  } catch (e) {
    console.warn(`任务专属harness调用失败，使用兜底文本：${quest.title}`, e);
    return { text: fallbackText(quest, stage, choiceLabel), usedFallback: true };
  }
}

// 兜底文本：AI调用失败时，退回台本（如果这个节点已经登记过）或者直接
// 用 stage.description 本身兜底——保证"点了就一定有确定的文字展示"这个
// 强制性，不会因为这次AI调用出问题就什么都不显示。
function fallbackText(quest, stage, choiceLabel) {
  const hitFlags = choiceLabel && stage.choices
    ? [stage.choices.find(c => c.label === choiceLabel)?.flag].filter(Boolean)
    : [];
  const script = getQuestScript(quest.id, stage.id, hitFlags);
  if (script) return script;
  return stage.description;
}
