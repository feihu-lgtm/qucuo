import { narratorVoicePrompt } from "../narrator/narrator.js";
import { MVU_SYSTEM_INSTRUCTIONS } from "./mvu.js";
import { AFFECTION_RULES, CARRY_COUNT, FIELD, FIELDS, formatRange, giftRange, learnRange } from "../state/fields.js";
import { renderFieldScales, renderPromptTemplate } from "./promptRefs.js";
import { describeCatalogForAI } from "../../data/items/catalogOps.js";
import { getActivePreset } from "./presetSystem.js";
import { assemblePrompt } from "./presetSystem.js";
import { gateScenario } from "./worldbook.js";
import { ENGINE_IDENTITY, ISOLATION, MAP_LAW, CATALOG_TAIL, buildTalkItemRule } from "./enginePrompts.js";
import { buildSeaOfMindRule } from "../narrator/seaOfMind.js";
import { makeBlock } from "./tavernMapping.js";
import { ADULT_HUMAN_FORM, isHumanFormCompanion } from "../companion/companionSlots.js";
import { getPromptOverrides } from "./registry.js";
import { loadCopy } from "../../../copy/loadCopy.js";

function applyPresetControlOverrides(preset, ov) {
  if (!preset || (!ov.preset_genrules && !ov.preset_wenfeng)) return preset;
  const mapById = { genrules: ov.preset_genrules, wenfeng: ov.preset_wenfeng };
  const prompts = (preset.prompts || []).map((entry) => {
    const patch = mapById[entry.id];
    if (!patch || typeof patch.text !== "string") return entry;
    return { ...entry, content: patch.text };
  });
  const order = (preset.order || []).map((item) => {
    const patch = mapById[item.id];
    if (!patch) return item;
    if (patch.mode === "off") return { ...item, enabled: false };
    if (patch.mode === "blue") return { ...item, enabled: true };
    return item;
  });
  return { ...preset, prompts, order };
}


// narrativeOnly=true：提取层模式下主调用只输出散文，去掉 JSON 格式要求和 MVU 指令。
// 返回 SillyTavern 13 位置风格的 system 消息数组，每条带 tavernBlock/tavernLabel。
export function buildSysBase(targetWordCount, narratorState, scenario, budgetInstruction, embeddingEnabled, npcLoreBlock, narrativeOnly = false, scope = "full", opts = {}) {
  const ov = getPromptOverrides();
  const giftWeight = (template) => renderPromptTemplate(template, opts, { trace: opts.onPromptRefMissing }).text;
  // memory 摘要统一用玩家角色名字第三人称叙述，不用"你/我/玩家"这几种代词混着写——
  // 事实账本(knowledge.js)的摘要要在多处被复用（旁白全知视角、其他NPC传闻转述、飞鸽书信
  // 里提起），人称一旦不统一，转述出来的句子会主客体错乱、读起来别扭。
  const playerName = opts.playerName || "主角";
  // scope 动态注入（借鉴 worldbook 蓝绿灯，解决"走一步路却喂一整套战斗/物品/schema"的臃肿）：
  //   "settle" 结算叙事——系统已把钱扣完/物入袋/flag置好，AI 只把这件既定事实演成叙事，
  //          对状态无任何裁量权。故砍掉「物件志」「认知隔离」「全量schema」，schema 缩成
  //          {output,memory}；MVU 仅在该轮确实牵涉某个 NPC（送礼/拜师等）时才挂。
  //          详见 docs/开发_挂载分级与蓝绿灯设计.md §三。
  //   "move" 移动到达——AI 只需读场景写到达叙事，不发物品、无 NPC 对白博弈，
  //          故砍掉「物件志」「认知隔离」，并改用只含 room 字段的精简 schema。
  //   "talk" 对话——保留认知隔离（对白要守信息域），砍掉物件志（对话一般不发物品）。
  //   "full" 其余（战斗/行动/查看/创造模式）——全量注入。
  const isSettle = scope === "settle";
  // 物件志（绿灯·批四）：只有"这一轮真可能发出物品"才挂——移动拾取判定命中、战斗（掉落）、
  // 创造模式（凭空发物）。寻常行动轮 AI 本就不该平白发物，挂了反而诱它发。
  const wantCatalog = ov.catalog?.mode === "off"
    ? false
    : ov.catalog?.mode === "blue"
      ? true
      : scope === "full" && opts.mayGrantItem !== false;
  // 对话档不挂物件志（那本表是给"凭空发物"的轮次用的，对话轮挂了纯烧上下文），
  // 但对白里确实可能有物品往来——改挂一条轻规矩，让模型只从"玩家背包"和 ctx 里
  // 那位 NPC 的〔身携:…〕两个来源取物，不许现编。见 enginePrompts.TALK_ITEM_RULE。
  const wantTalkItemRule = scope === "talk";
  // 心灵之海（绿灯）：玩家真的在海里时才注入那套场景铁律。不在时一个字不发——
  // 这段挺长，寻常在江湖上走的轮次读它纯属浪费，且会诱导 AI 提起不该提的地方。
  const inSeaOfMind = !!opts.inSeaOfMind;
  const wantIsolation = scope !== "move" && !isSettle;
  // MVU（绿灯·批二）：只有"这一轮可能改好感/变量"才挂——即场上真有人。
  // 独自赶路、荒野探索、无人结算这类轮次灭灯，每轮省 717 字；
  // 创造模式(gm)强制挂（要能凭空设变量）。move 档本就无 MVU 段，不受影响。
  const wantMvu = !narrativeOnly && (isSettle ? !!opts.settleNpc : (opts.hasNpc !== false || opts.gm === true));
  // 直接用目标汉字数生成明确的字数指令，而不是通过 maxTokens 反推一个粗略的档位——
  // 汉字和 token 不是 1:1 关系（一个汉字通常占 1.5-2 个 token），之前"用 maxTokens 分四档"
  // 的做法既不精确，也只能控制"每条output"的上限，控制不了整轮回复的总字数。
  //
  // budgetInstruction 由 inputIntent.js 根据这轮玩家输入的性质动态生成——
  // "什么情况"这种系统元问题应该只有一两句话，"拔剑迎战"这种战斗场面应该完整展开，
  // 不该用同一个固定字数套所有输入。传了就用动态版本，不传（比如旧调用点或测试场景）
  // 就退回原来的全局固定字数，保证向后兼容。
  const lenNote = budgetInstruction || `本轮 output 各行合计约 ${targetWordCount} 字（±15%浮动），勿明显少写、勿凑数硬拖；据此自定行数与行长。`;

  // ── settleKind 专属铁律（本轮抽成独立函数）──────────────────────────
  // 之前"送礼铁律"是直接堆在下面那个巨型模板字符串里的三元表达式，每加一个新的
  // settleKind 都要在同一行里再叠一层三元，容易出现作用域引用错误（cmd 变量不在
  // buildSysBase 作用域内那次事故）、可读性也持续下降。现在把"narrativeOnly分支
  // 该说什么"和"isSettle分支的MVU该怎么写"分别抽成独立函数，settleKind 的判断
  // 逻辑集中在这里，后续新增伙伴/新增结算类型时只需要在这两个函数里各加一段
  // if 分支，不用再动下面那坨模板字符串本身。
  //
  // narrativeOnly 分支：管"这一轮的散文该怎么写"（双调用模式下主叙事只产文本，
  // 好感度等状态判定由判官管线裁决，这里不涉及MVU）。
  function buildSettleNarrativeNote(o) {
    if (o.settleKind === "duel_invite") {
      const npcName = typeof o.settleNpc === "string" ? o.settleNpc : o.settleNpc?.name || "对方";
      return `\n【切磋邀战叙事铁律】只写玩家发出邀战、${npcName}接受邀战与双方摆开架势，写到第一招交手之前立刻停止。严禁描写任何招式交锋、回合、伤势、胜负、任一方喊停或${npcName}拒绝。切磋是否开始由玩家通过确认栏选择，本轮不得替玩家开始战斗。`;
    }
    if (o.settleKind === "gift") {
      // WO-16F-F4a：判官路（judgeActive）不得写「已由系统交付」——收/拒由判官定案单
      // （judgeRuleBlock 注入）为唯一方向，这里再说已交付已结算会与拒收裁决打架。
      if (o.judgeActive) return "";
      // 偏好暗示：回复里自然带出对方偏爱哪类物件（玩家下次就知道送什么）。
      const preferHint = o.giftInfo?.preferLabel
        ? ` ${o.settleNpc}平日偏爱「${o.giftInfo.preferLabel}」一类——回应对白里自然带出他对这类物件的惦记（暗示即可，禁直白报出类别名、禁清单式罗列）。`
        : "";
      if (o.giftInfo?.weight) return giftWeight(
        "\n【赠礼反应】「@giftInfo.itemName」已由系统交付，禁重复扣除。分量：@{赠礼.分量}；反应：@{赠礼.反应}。贴合收礼人性格，不同分量禁雷同。",
      ) + preferHint;
      return `\n【送礼反应铁律】「${o.giftInfo?.itemName ? o.giftInfo.itemName : "礼物"}」已由系统交付并结算完毕，禁重复扣除、禁改写收讫事实。${o.settleNpc}的反应按其自身性情与礼物分量自然写：性情冷傲者即便心里受用也只是淡淡收下，豪爽者拍腿道谢，精明者掂量估值；厚礼动心、薄礼随意，因人而异、禁千人一腔地惊喜转暖，也禁无由为难起疑。` + preferHint;
    }
    if (o.settleKind === "companion_invite") {
      const cn = o.settleNpc || "对方";
      const speech = isHumanFormCompanion(o.settleNpc)
        ? `认主这一刻褪去兽身、化为人形（${ADULT_HUMAN_FORM}），化形后能开口说话，用言语与神情表达结伴之意`
        : o.settleBeast
        ? `它不通人言（cannotSpeak），情感全靠动作、眼神、姿态传达（以额抵掌、绕身而行、伏低臣服等合其兽类身份的方式）`
        : `能正常开口说话，用言语与神情表达结伴之意`;
      return `\n【伙伴入队铁律】${cn}已决意与主角正式结伴同行，非临时起意。本轮唯一走向：必写其毫不保留、爽快应下并定下同行情谊，${speech}；禁写犹豫、观望、抗拒或需再三哄劝。`;
    }
    if (o.settleKind === "learn_skill") {
      // WO-16F-F4b：判官路（judgeActive）不得预设「系统已结算完毕」——授业方向以
      // 判官定案单（judgeRuleBlock 注入）为唯一口径，这里再说既成事实会与定案打架。
      if (o.judgeActive) return "";
      return `\n【授业传艺铁律】${o.settleNpc}已定倾囊相授并结师徒名分（好感门槛、束脩、招式均由系统结算完毕，为既成事实）。本轮唯一走向：必写其郑重传授功夫、态度较前更亲近；禁写勉强、敷衍、留一手或临时反悔。${o.learnInfo?.beast ? "它不能说话（cannotSpeak），全程不出人言，传艺全靠动作示范、以身作则、眼神示意——把招式拆给主角看，让主角跟着比划，错了便用鼻尖或前爪顶正。" : ""}`;
    }
    if (o.settleKind === "appease") {
      // WO-15 窄过渡：双调用模式开庭前已由 turn.appease 裁定，正文必须与裁定同向。
      if (o.appeaseVerdict?.choice === "奏效") {
        return `\n【怒气缓和·系统已裁定】${o.settleNpc}这次真的消了气。本轮必须照此写：怒气消解、态度回暖，禁写成仍在气头或敷衍不应。`;
      }
      if (o.appeaseVerdict && o.appeaseVerdict.choice !== "奏效") {
        return `\n【怒气缓和·系统已裁定】${o.settleNpc}这次没有消气。本轮必须照此写：怒气未消、反应冷淡或仍然戒备，禁把和解写成既成事实。`;
      }
      // WO-16F-F3：判官路（judgeActive）不得回落自由判——赔罪成败以判官定案单
      // （judgeRuleBlock 注入）为唯一方向，这里再给「自行判断」会与定案打架。
      if (o.judgeActive) return "";
      return `\n【怒气缓和判定】${o.settleNpc}仍在气头上，本轮为新缓和尝试。结合此前方式，判断言行是否真诚、得体且切中要害：有效才写怒气消解，无效保持不满，禁把和解写成既成事实。`
        + (o.giftInfo?.weight ? giftWeight("本次赠礼分量：@{赠礼.分量}。分量不等于已经消气。") : "");
    }
    return "";
  }
  // isSettle 分支：管"MVU 那部分该怎么写"（单调用模式下，主模型直接产 JSON+MVU，
  // 好感度等状态判定就在这一次调用里完成）。
  function buildSettleMvuNote(o) {
    if (o.settleKind === "duel_invite") {
      return `\n【切磋邀战状态铁律】本轮只是邀战与摆开架势，不发生战斗或任何状态变化。不得输出 <mvu>，不得修改气血、好感、物品或其他状态。`;
    }
    if (o.settleKind === "gift") {
      if (o.giftInfo?.weight) return buildSettleNarrativeNote(o);
      const range = o.giftInfo?.range ?? giftRange(o.giftInfo?.quality);
      return `\n【送礼反应铁律】${o.giftInfo?.itemName ? `「${o.giftInfo.itemName}」` : "这件礼物"}已由系统交付并结算完毕，好感改动也已由系统按礼物分量确定性落账，禁重复扣除、禁改写收讫事实。${o.settleNpc}的反应按其自身性情与礼物分量自然写：冷傲者即便心里受用也只是淡淡收下，豪爽者拍腿道谢，精明者掂量估值；厚礼动心、薄礼随意，因人而异、禁千人一腔地惊喜转暖，也禁无由为难起疑。\n礼物信息：品阶【${o.giftInfo?.quality || "白"}】${o.giftInfo?.categoryLabel ? `，类别「${o.giftInfo.categoryLabel}」` : ""}，描述：${o.giftInfo?.desc || "寻常物件"}。\n本轮禁输出任何好感相关 <mvu>——写了会被系统拦截，且与已落定账本重复。`;
    }
    if (o.settleKind === "companion_invite") {
      const cn = o.settleNpc || "对方";
      const { min, max, example } = AFFECTION_RULES.companion;
      const speech = isHumanFormCompanion(o.settleNpc)
        ? `当场化为人形（${ADULT_HUMAN_FORM}），开口用言语与神情郑重定下同行情谊`
        : o.settleBeast
        ? `用动作、眼神、姿态（如以额抵掌、伏低臣服）表明结伴之意——它不能说话`
        : `用言语与神情郑重定下同行情谊`;
      return `\n【伙伴入队铁律】${cn}已决意与主角正式结伴同行，初始好感已由系统钉在 ${example} 落定。本轮必写其爽快应下、${speech}；禁写犹豫或抗拒。\n本轮禁输出任何好感相关 <mvu>——同行情谊是系统结算的既成事实，写了会被拦截。`;
    }
    if (o.settleKind === "learn_skill") {
      const master = !!o.learnInfo?.isMaster;
      const [min, max, example] = learnRange(master);
      return `\n【授业传艺铁律】${o.settleNpc}已定倾囊相授（门槛、束脩、招式、好感精进均已由系统结算为既成事实）；本轮所授：${o.learnInfo?.isMaster ? "看家绝学" : "江湖通用功夫"}「${o.learnInfo?.moveBrief || "所学"}」${o.learnInfo?.totalPrice ? `，束脩银${o.learnInfo.totalPrice}两` : "，分文未取"}。对玩家观感只能变好，禁不变或变差。\n本轮禁输出任何好感相关 <mvu>——授业情分系统已按${master ? "绝学" : "通用功夫"}定格落账，写了会被拦截。`;
    }
    if (o.settleKind === "appease") {
      return `\n【怒气缓和状态裁决】仅当本轮行为确实缓和${o.settleNpc}，才输出 <mvu>：必写生气解除，观感确有变化时可附好感度增量 N（${AFFECTION_RULES.appease.join("~")} 整数）。未奏效禁设生气解除且不输出 <mvu>；除此之外禁写任何 MVU 变更。\n成功示例（未奏效不输出）：\n_.set('角色.${o.settleNpc}.生气解除', true);\n_.add('角色.${o.settleNpc}.好感度', 3);`;
    }
    return "";
  }
  function buildSettleMvuExample(o) {
    if (o.settleKind === "duel_invite") {
      return `\n【切磋邀战状态示例】本轮没有任何状态变化，不输出 <mvu> 块。`;
    }
    if (o.settleKind === "gift") {
      if (o.giftInfo?.weight) return "\n好感已随礼物分量由系统结算落账，本轮禁写好感相关 MVU。";
    }
    return "";
  }

  // 预设系统负责的部分：文体/通用规则/剧本设定的拼装顺序和内容，可由用户在设置面板里自由编辑，
  // 完整兼容酒馆格式导入。scenario 通过 marker 占位符注入，不需要在这里手动拼接。
  const basePreset = Object.hasOwn(opts, "activePreset") ? opts.activePreset : getActivePreset();
  const preset = applyPresetControlOverrides(basePreset, ov);
  // scenario 绿灯（批三）：世界观总纲按"关键词 OR 状态"分条点灯，见 worldbook.js gateScenario。
  // 蓝灯段（地理概要/地图铁律/好感度规则）常驻；专项段（拓扑路线/契诃夫之枪/路途遭遇/
  // 装备掉落）只在玩家或上轮回复提到、或该 scope 确需时才亮。opts.gateCtx 不传则不裁剪。
  const rawScenario = ov.preset_scenario?.mode === "off"
    ? ""
    : typeof ov.preset_scenario?.text === "string"
      ? ov.preset_scenario.text
      : scenario;
  const gated = ov.preset_scenario?.mode === "off"
    ? { text: "", lit: [], dark: [] }
    : ov.preset_scenario?.mode === "blue"
      ? { text: rawScenario, lit: ["总控台蓝灯全亮"], dark: [] }
      : opts.gateCtx
        ? gateScenario(rawScenario, { ...opts.gateCtx, scope, wantMvu: wantMvu && !narrativeOnly })
        : { text: rawScenario, lit: [], dark: [] };
  if (opts.onGateReport) opts.onGateReport(gated);
  // ── 冰山前缀切分（WO-04）──────────────────────────────────────────
  // sysBlocks 必须严格收束为"完全静态或仅随存档预设变更"的块，好吃商用模型的
  // 前缀缓存；凡随单轮输入/在场 NPC/好感档位/字数预算跳变的内容一律移去
  // actCall.js 第 11 号位 inChat（缓存分界线之后）。
  // scenario 的蓝绿灯切分：探针跑一遍"无关键词、无 scope 命中、MVU 在场"的裁剪，
  // 此时所有绿灯条目与随 MVU 跳变的 stock 好感度段全部灭灯——剩下的就是不随
  // 单轮输入跳变的蓝灯基底；kept 文本里不在基底集的段落即绿灯专项段（动态）。
  const icebergProbe = rawScenario && rawScenario.trim()
    ? gateScenario(rawScenario, { scope: "__iceberg_probe__", userInput: "", lastReply: "", wantMvu: true })
    : { text: "" };
  const icebergBlueSet = new Set((icebergProbe.text || "").split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean));
  const scenarioIceberg = { blue: [], lit: [] };
  for (const p of (gated.text || "").split(/\n\s*\n/).filter((s) => s.trim())) {
    (icebergBlueSet.has(p.trim()) ? scenarioIceberg.blue : scenarioIceberg.lit).push(p);
  }
  // 13 位置拆分：scenario / charDescription 由各自的独立块承载，这里不再填进预设占位符，避免重复。
  const presetContent = assemblePrompt(preset, { scenario: "", charDescription: "" });
  const baseVoiceBlock = ov.voice?.mode === "off"
    ? ""
    : narratorVoicePrompt(narratorState, opts.onPromptRefMissing);
  const voiceSupplement = ov.voice?.mode !== "off" && typeof ov.voice?.text === "string"
    ? ov.voice.text.trim()
    : "";
  const voiceBlock = baseVoiceBlock && voiceSupplement
    ? `${baseVoiceBlock}\n${voiceSupplement}`
    : baseVoiceBlock || voiceSupplement;
  const npcLoreText = ov.npc_lore?.mode === "off" ? "" : (npcLoreBlock || "");
  const effectiveLenNote = ov.length?.mode === "off"
    ? ""
    : typeof ov.length?.text === "string"
      ? ov.length.text
      : (lenNote.startsWith("篇幅要求：") ? lenNote : `篇幅要求：${lenNote}`);

  // 各分支的 JSON schema / 叙事指令，与旧模板字符串完全一致。
  // WO-16C 修指令打架：判官激活时叙事末尾必须跟 ---SEAL--- 单行 JSON
  // （judgeRuleBlock 强制），narrativeOnly 的"禁输出JSON"会把尾章禁掉、
  // 填空券全作废。判官路只禁 MVU/杂项结构、放行唯一尾章；判官不在时原样。
  const schemaBlock = narrativeOnly
    ? opts.judgeActive
      ? `直接输出叙事散文正文；写完正文换行输出 ---SEAL--- 紧跟单行 JSON（fills/respondedNpcs/spontaneousPact），此外禁输出JSON、<mvu>块及任何结构化内容。`
      : opts.groupTalkActive
        ? `直接输出叙事散文正文；写完正文换行输出 ---SEAL--- 紧跟单行 JSON（respondedNpcs），此外禁输出JSON、<mvu>块及任何结构化内容。`
        : `直接输出叙事散文正文，写完即止；禁输出JSON、<mvu>块及任何结构化内容。`
    : isSettle
      ? `回复纯JSON，字符串不换行。状态已结算，只写生动正文，禁改状态或重复结算奖励/物品/银两${opts.snowLeopardGift ? "：" : "，禁输出 room/char/dao/delta："}
{"output":["行1","行2"],"memory":"≤50字客观事实"}
${opts.snowLeopardGift ? '唯一例外：收复雪豹任务进行中且雪豹在场，本次赠礼若为肉，可输出 "delta":{"flags_add":["snow_spirit_meat"]}；非肉则拒吃并讲个短笑话，不加flag。delta只允许flags_add，且只允许snow_spirit_meat，不得输出其他flag或状态。不要输出 room / char / dao。\n' : ""}memory：≤50字纯客观事实，玩家称"${playerName}"，禁"你/我/玩家"，琐事省略。${wantMvu ? `
JSON后另起一行附 <mvu> 块（禁入JSON内），见上文规则。` : ""}`
      : scope === "move"
        ? `回复纯JSON，字符串不换行。移动到达：只写叙事、场景与在场人物，不发物品、不改复杂状态：
{"output":["行1","行2"],"room":{"name":"名","desc":"≤80字","exits":["n"],"npcs":[{"name":"名","id":"id","brief":"≤15字","carry":[{"name":"物品名","category":"weapon|armor|accessory|misc","quality":"白|绿|蓝|紫|橙|红"}]}]}}
carry：仅NPC首登场写${CARRY_COUNT.min}-${CARRY_COUNT.max}件可见随身物，叙事须写外观。
memory（可选）：≤50字纯客观事实记到达地与途中要事，玩家称"${playerName}"，禁"你/我/玩家"，寻常赶路省略。
mentionedNewNpcs：仅提全新具名人物时加["名"]。`
        : `回复纯JSON，字符串不换行：
{"output":["行1","行2"],"room":{"name":"名","desc":"≤80字","exits":["n"],"npcs":[{"name":"名","id":"id","brief":"≤15字","carry":[{"name":"物品名","category":"weapon|armor|accessory|misc","quality":"白|绿|蓝|紫|橙|红"}]}],"items":[{"name":"名","id":"id"}]},"char":{"hp":[60,100],"neigong":5,"waigong":8,"special":{"根骨":5,"悟性":6,"体魄":5,"魅力":5,"智谋":5,"身法":5,"气运":5}},"dao":{"karma":0,"jie":0,"sign":"天象","rumor":["事"]},"delta":{"items_add":[{"name":"物品名","category":"weapon|armor|accessory|misc","quality":"白|绿|蓝|紫|橙|红"}],"items_rm":[],"skill_up":{},"exp":0,"pot":0,"flags_add":[]}}
items_add：剧情道具/杂物可用纯字符串；武器/护甲/饰品用对象。
carry：仅NPC首登场写${CARRY_COUNT.min}-${CARRY_COUNT.max}件可见随身物（常人多白/绿档），叙事须写外观，后续不写。
NPC加tag：仅路途泛用清剿目标（猛兽/山贼等，按地域说明填）可选；具名人物不加。
mentionedNewNpcs（顶层）：仅提全新具名人物时加["名"]。
${scope === "full" ? 'duelRequest（顶层）：仅玩家向在场NPC提切磋且对方应允开架时填"NPC名"；拒绝/躲避/仅谈打斗须省略。\n' : ""}emergedNpcName与emergedNpcDescription（顶层）：仅收到"人物涌现"指令且本轮登场时加（后者一句话定性、无数值），其余禁写。
memory（顶层可选）：≤50字纯客观事实记可公开关键事件（写清人名地名），玩家称"${playerName}"，禁"你/我/玩家"，禁情绪/心理/评述/私密，琐事省略。${wantMvu ? `

JSON后若需维护角色/世界状态变量，另起一行独立输出 <mvu> 块（禁入JSON），见上文规则。` : ""}`;

  // 按 SillyTavern 13 位置拆成消息数组。位置编号 9 与 13 等因各 API 实际限制会被合并到
  // 系统顶部，但保留标签供 TraceViewer/注入结构面板可视化。
  // ── 冰山前缀（WO-04）：这里只放完全静态、或仅随存档预设变更的块 ──
  //   main = 引擎身份；worldInfoBefore = 预设文体与通用规则；scenario = 世界观蓝灯基底；
  //   worldInfoAfter = 认知隔离 + 地图铁律；其余（旁白声线 voiceBlock、NPC 人设 npcLoreText、
  //   绿灯专项世界观、篇幅要求 effectiveLenNote、物件志 wantCatalog、对话取物规范、
  //   心灵之海）全部随轮次跳变，由 dynBlocks 带出、合并进 actCall.js 第 11 号位 inChat。
  const messages = [
    makeBlock("main", `${ENGINE_IDENTITY}\n`),
    makeBlock("worldInfoBefore", presetContent),
    // V2：第二人称叙事禁泄存档名——存档栏位名（如 Cultivation QA）是元数据不是
    // 角色名，正文称玩家只用「你」，严禁把存档名当第三人称写进叙事。
    makeBlock("charDescription", `玩家角色：${playerName}。气血、内外功、物品等状态由系统维护，你只叙事，不擅自改状态。正文以第二人称「你」称玩家，严禁把存档栏位名或元数据名当作角色名写入正文。`),
    makeBlock("charPersonality", `旁白语气由给定的说书人声线控制，保持统一。`),
    makeBlock("scenario", scenarioIceberg.blue.join("\n\n")),
    // V7a：旁观者不点名/禁复读静态习性/非亲密回合禁发情模板——通用硬约束，
    // 文案单源住 src/copy/bystanderRules.txt（copy-gate 规约）。
    makeBlock("worldInfoAfter", `${wantIsolation ? `${ISOLATION}\n` : ""}\n\n${MAP_LAW}\n\n${loadCopy("bystanderRules.txt")}`),
    makeBlock("persona", `玩家以第一人称「我」扮演 ${playerName}，你是说书人/Gamemaster。`),
    makeBlock("exampleStart", "<START>"),
  ];
  // 动态块：内容一字未改，只是搬家——从 sysBlocks 前部移到缓存分界线之后。
  const dynBlocks = {
    voice: voiceBlock,
    npcLore: npcLoreText,
    scenarioLit: scenarioIceberg.lit.join("\n\n"),
    catalog: wantCatalog ? `── 曲措乡物件志（叙事引用规范）──\n${describeCatalogForAI()}\n${CATALOG_TAIL}` : "",
    talkItemRule: wantTalkItemRule ? buildTalkItemRule(narrativeOnly) : "",
    seaOfMind: inSeaOfMind ? buildSeaOfMindRule() : "",
    lenNote: effectiveLenNote,
  };

  // ── 13 号位只留"形状"，约束一律交给 11 号位（user）──
  // 划分依据是"是不是输出格式本身"，不是"是不是规则"：
  //   13 位 = 我要开始写了 + 我要写成什么形状（JSON骨架 / 散文声明 + prefill 暗示）
  //   11 位 = 我可以写什么、不可以写什么（MVU 路径规矩、送礼/认主/拜师铁律、篇幅）
  // 【为什么这么分】13 位是 assistant 角色且是最后一条消息，构成真 prefill——模型会
  // 顺着它往下写。往真 prefill 里堆规则，模型很容易把规则本身续写完就停了、不产正文
  // （NSFW/GM 当初就是踩了这个坑才挪去 11 号位的，但 846 字的 MVU 说明书当时漏了）。
  // 顺带说明：这跟姬侠传不同——它的 assistant 在第5位、后面还跟一条 user，那条不是
  // 最后一条、不构成真 prefill，所以它往里塞 246 字规则没事。我们不能照抄。
  // 也跟酒馆的 PHI 不同：ST 的 Post-History Instructions 是 system/user 角色，靠位置
  // 靠后取优先级，本就不是 prefill。
  const phiRules = [
    scope === "full" ? "\n【战斗叙事边界】战斗的招式交锋与胜负均由系统结算，叙事不得自行描写。" : "",
    narrativeOnly ? buildSettleNarrativeNote(opts) : "",
    (!narrativeOnly && isSettle && wantMvu) ? buildSettleMvuNote(opts) : "",
    (!narrativeOnly && isSettle && wantMvu
      && !["duel_invite", "gift", "companion_invite", "learn_skill", "appease"].includes(opts.settleKind))
      ? `\n关于下面那条 <mvu>：如果这一轮牵涉的人物（${opts.settleNpc}）对玩家的观感确有变化才给出。`
      : "",
    (!narrativeOnly && wantMvu && opts.settleKind !== "duel_invite") ? MVU_SYSTEM_INSTRUCTIONS : "",
    (!narrativeOnly && !isSettle && scope !== "move")
      ? renderFieldScales([FIELD.hp, "char.neigong", "char.waigong", "char.special", "dao.karma", "dao.jie", FIELD.inv, FIELD.flags, "skills", "exp", "pot"], {}, opts.onPromptRefMissing) : "",
    (!narrativeOnly && isSettle && wantMvu) ? buildSettleMvuExample(opts) : "",
  ].filter(Boolean).join("\n");

  const totalLen = messages.reduce((sum, b) => sum + (b.content?.length || 0), 0);
  if (opts.onSnapshot) opts.onSnapshot({ sys: messages, meta: { scope, narrativeOnly, isSettle, wantCatalog, wantIsolation, wantMvu, settleKind: opts.settleKind || null, len: totalLen } });
  return { sysBlocks: messages, phiBlock: makeBlock("phi", schemaBlock), phiRules, dynBlocks };
}
