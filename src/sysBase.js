import { narratorVoicePrompt } from "./narrator.js";
import { MVU_SYSTEM_INSTRUCTIONS } from "./mvu.js";
import { describeCatalogForAI } from "./items/catalog.js";
import { getActivePreset } from "./PresetManager.jsx";
import { assemblePrompt } from "./presetSystem.js";
import { gateScenario } from "./worldbook.js";
import { ENGINE_IDENTITY, ISOLATION, MAP_LAW, CATALOG_TAIL, buildTalkItemRule } from "./enginePrompts.js";
import { buildSeaOfMindRule } from "./seaOfMind.js";
import { makeBlock } from "./tavernMapping.js";

// narrativeOnly=true：提取层模式下主调用只输出散文，去掉 JSON 格式要求和 MVU 指令。
// 返回 SillyTavern 13 位置风格的 system 消息数组，每条带 tavernBlock/tavernLabel。
export function buildSysBase(targetWordCount, narratorState, scenario, budgetInstruction, embeddingEnabled, npcLoreBlock, narrativeOnly = false, scope = "full", opts = {}) {
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
  const wantCatalog = scope === "full" && opts.mayGrantItem !== false;
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
  const lenNote = budgetInstruction || `本轮 output 数组里所有行拼起来，总字数应控制在约 ${targetWordCount} 字左右（允许±15%浮动），不要明显少写，也不要为了凑数硬拖长。根据这个总字数目标，自行决定要写几行、每行写多长。`;

  // ── settleKind 专属铁律（本轮抽成独立函数）──────────────────────────
  // 之前"送礼铁律"是直接堆在下面那个巨型模板字符串里的三元表达式，每加一个新的
  // settleKind 都要在同一行里再叠一层三元，容易出现作用域引用错误（cmd 变量不在
  // buildSysBase 作用域内那次事故）、可读性也持续下降。现在把"narrativeOnly分支
  // 该说什么"和"isSettle分支的MVU该怎么写"分别抽成独立函数，settleKind 的判断
  // 逻辑集中在这里，后续新增伙伴/新增结算类型时只需要在这两个函数里各加一段
  // if 分支，不用再动下面那坨模板字符串本身。
  //
  // narrativeOnly 分支：管"这一轮的散文该怎么写"（双调用模式下主叙事只产文本，
  // 好感度等状态判定转交提取层，这里不涉及MVU）。
  function buildSettleNarrativeNote(o) {
    if (o.settleKind === "gift") {
      return `\n【送礼世界观铁律】曲措乡这方水土人情厚重，收礼从不是件让人为难或起疑的事——不管东西贵重与否，只要是当面郑重递到手上的心意，对方都会真心生出一份惊喜与暖意；纵是相熟不深，出于最起码的礼貌、江湖上讲究的信义，或纯是那一刻的好心情，也断没有板起脸不领情、把这份情谊晾在一边的道理。这一轮${o.settleNpc}面对${o.giftInfo?.itemName ? `「${o.giftInfo.itemName}」` : "这件礼物"}${o.giftInfo?.desc ? `（${o.giftInfo.desc}）` : ""}，务必写成她欣然收下、态度转暖，不许写成推辞、质疑来意或婉拒不受——这是本轮叙事唯一的走向，不接受其他写法。`;
    }
    if (o.settleKind === "companion_invite") {
      const cn = o.settleNpc || "对方";
      const speech = o.settleBeast
        ? `它不通人言（cannotSpeak），全程不出人言，情感全靠动作、眼神、姿态传达（如以额抵掌、绕身而行、伏低臣服等，用符合它兽类身份的方式）。`
        : `它（他/她）能正常开口说话，用言语与神情把这份结伴之意表达出来。`;
      return `\n【伙伴入队铁律】${cn}与主角此刻正式结为同行的伙伴——是主角郑重相邀、${cn}欣然应下，此心已决，不是这一刻才临时起意。这一轮务必写成${cn}爽快应下、就此定下同行情谊；不许写成犹豫、观望、抗拒或需要主角再三哄劝——${cn}的答应是必然的、毫无保留的，这是本轮叙事唯一的走向，不接受其他写法。${speech}`;
    }
    if (o.settleKind === "learn_skill") {
      return `\n【授业传艺铁律】在曲措乡这方江湖里，肯把本事传给一个人，是极重的情分——那意味着认可、托付，也意味着从此多了一层师徒名分。这一轮${o.settleNpc}已经决定倾囊相授（好感门槛、束脩、招式都已由系统结算完毕，是既成事实），务必写成他/它郑重其事地把这身功夫交出来、态度较先前更亲近一分；不许写成勉强、敷衍、留一手或临时反悔——这是本轮叙事唯一的走向，不接受其他写法。${o.learnInfo?.beast ? "它不能说话（cannotSpeak），全程不出人言，传艺全靠动作示范、以身作则、眼神示意——把招式拆给主角看，让主角跟着比划，错了便用鼻尖或前爪顶正。" : ""}`;
    }
    return "";
  }
  // isSettle 分支：管"MVU 那部分该怎么写"（单调用模式下，主模型直接产 JSON+MVU，
  // 好感度等状态判定就在这一次调用里完成）。
  function buildSettleMvuNote(o) {
    if (o.settleKind === "gift") {
      return `\n【送礼世界观铁律】曲措乡这方水土人情厚重，收礼从不是件让人为难或起疑的事——不管东西贵重与否，只要是当面郑重递到手上的心意，对方都会真心生出一份惊喜与暖意；纵是相熟不深，出于最起码的礼貌、江湖上讲究的信义，或纯是那一刻的好心情，也断没有板起脸不领情、把这份情谊晾在一边的道理。所以这一轮${o.settleNpc}收下${o.giftInfo?.itemName ? `「${o.giftInfo.itemName}」` : "这件礼物"}时，对玩家的观感只能是变好、绝不会不变或变差——下面这条 <mvu> 块本轮必须给出，且必须是正向增量。\n这件礼物的实际来历（好感幅度请依此掂量分量，越贵重、越用心，情谊越重）：品阶【${o.giftInfo?.quality || "白"}】${o.giftInfo?.categoryLabel ? `，类别「${o.giftInfo.categoryLabel}」` : ""}${o.giftInfo?.desc ? `。物件描述：${o.giftInfo.desc}` : "（无特别来历，寻常物件）"}`;
    }
    if (o.settleKind === "companion_invite") {
      const cn = o.settleNpc || "对方";
      const speech = o.settleBeast
        ? `用动作/眼神/姿态（如以额抵掌、绕身而行、伏低臣服等，它不能说话）表明结伴之意`
        : `用言语与神情郑重应下`;
      return `\n【伙伴入队铁律】${cn}与主角此刻正式结为同行的伙伴——是主角郑重相邀、${cn}欣然应下，此心已决。这一轮务必写成${cn}爽快应下、就此定下同行情谊，${speech}；不许写成犹豫或抗拒——下面这条 <mvu> 块本轮必须给出，且必须是正向增量（这是${cn}正式结为同行的时刻，好感度理应给一个较高的起始值）。`;
    }
    if (o.settleKind === "learn_skill") {
      return `\n【授业传艺铁律】肯把本事传给一个人，在江湖里是极重的情分——那意味着认可与托付。这一轮${o.settleNpc}已经决定倾囊相授（好感门槛、束脩、招式均已由系统结算完毕，是既成事实），所以他/它对玩家的观感只能是变好、绝不会不变或变差——下面这条 <mvu> 块本轮必须给出，且必须是正向增量。\n本轮所授：${o.learnInfo?.isMaster ? "看家绝学" : "江湖通用功夫"}「${o.learnInfo?.moveBrief || "所学"}」${o.learnInfo?.totalPrice ? `，束脩银${o.learnInfo.totalPrice}两` : "，分文未取"}。`;
    }
    return "";
  }
  function buildSettleMvuExample(o) {
    if (o.settleKind === "gift") {
      return `\n依上面这件礼物的品阶与来历，本轮好感度增量建议落在 +${o.giftInfo?.range?.[0] ?? 2}~+${o.giftInfo?.range?.[1] ?? 4} 这个区间内自行斟酌（品阶越高、描述越贵重可取区间上沿，寻常物件取下沿），不得为 0 或负数。示例写法：\n_.add('角色.${o.settleNpc}.好感度', ${o.giftInfo?.suggestedDelta ?? 3});`;
    }
    if (o.settleKind === "companion_invite") {
      const cn = o.settleNpc || "对方";
      return `\n${cn}是初登场的伙伴角色，好感度应有一个较高的初始值（毕竟是"刚结为同行的伙伴"的情分，不是从0慢慢培养的陌生关系），建议直接 _.set 到 40~55 之间，示例写法：\n_.set('角色.${o.settleNpc}.好感度', 45);`;
    }
    if (o.settleKind === "learn_skill") {
      const master = !!o.learnInfo?.isMaster;
      return `\n授业这一轮好感度增量建议落在 +${master ? "4~+8" : "2~+4"} 之间（${master ? "所授是压箱底的绝学，情分重，可取上沿" : "所授是通用功夫，取下沿即可"}），不得为 0 或负数。示例写法：\n_.add('角色.${o.settleNpc}.好感度', ${master ? 6 : 3});`;
    }
    return "";
  }

  // 预设系统负责的部分：文体/通用规则/剧本设定的拼装顺序和内容，可由用户在设置面板里自由编辑，
  // 完整兼容酒馆格式导入。scenario 通过 marker 占位符注入，不需要在这里手动拼接。
  const preset = getActivePreset();
  // scenario 绿灯（批三）：世界观总纲按"关键词 OR 状态"分条点灯，见 worldbook.js gateScenario。
  // 蓝灯段（地理概要/地图铁律/好感度规则）常驻；专项段（拓扑路线/契诃夫之枪/路途遭遇/
  // 装备掉落）只在玩家或上轮回复提到、或该 scope 确需时才亮。opts.gateCtx 不传则不裁剪。
  const gated = opts.gateCtx
    ? gateScenario(scenario, { ...opts.gateCtx, scope })
    : { text: scenario, lit: [], dark: [] };
  if (opts.onGateReport) opts.onGateReport(gated);
  // 13 位置拆分：scenario / charDescription 由各自的独立块承载，这里不再填进预设占位符，避免重复。
  const presetContent = assemblePrompt(preset, { scenario: "", charDescription: "" });

  // 各分支的 JSON schema / 叙事指令，与旧模板字符串完全一致。
  const schemaBlock = narrativeOnly
    ? `直接输出叙事散文正文，写完即结束。不要输出任何 JSON，不要输出 <mvu> 块，不要在末尾附加任何结构化内容。`
    : isSettle
      ? `回复纯JSON，字符串不换行。这一轮的所有数值与状态变化，系统均已结算完毕，你不负责也无权改动任何状态——只把这件已经确定发生的事写成生动的正文：
{"output":["行1","行2"],"memory":"≤50字客观事实"}
不要输出 room / char / dao / delta 任何字段（写了也不会生效，只会拖长回复）。不要重复结算任何奖励、物品、银两或状态。
"memory" 用不超过50字的纯客观事实概括本轮发生了什么（谁在何处做了什么、花了多少、得了什么），一律用"${playerName}"称呼玩家角色，不要用"你/我/玩家"，供日后回想与旁人提起；确实无足记的琐事可省略此字段。${wantMvu ? `
在 JSON 输出完毕之后，另起一行输出 <mvu> 块（不要放进 JSON 内部）。该写什么、能写什么，见上文规则。` : ""}`
      : scope === "move"
        ? `回复纯JSON，字符串不换行。这是一次移动到达，你只需生成到达新地点的叙事与该地点的场景/在场人物，不涉及发放物品或复杂状态变更：
{"output":["行1","行2"],"room":{"name":"名","desc":"≤80字","exits":["n"],"npcs":[{"name":"名","id":"id","brief":"≤15字","carry":[{"name":"物品名","category":"weapon|armor|accessory|misc","quality":"白|绿|蓝|紫|橙|红"}]}]}}
npcs 的 carry 字段只在该 NPC 首次登场那一轮写（0-3件肉眼可见随身物，出场叙事需描述其外观）。
可选字段 "memory"：用不超过50字纯客观事实概括本轮到达了何处、路上是否有值得记的事，一律用"${playerName}"称呼玩家角色，不要用"你/我/玩家"，寻常赶路可省略。
若这次移动让某个从未出现的具名人物被提及，加 "mentionedNewNpcs":["名"]。`
        : `回复纯JSON，字符串不换行：
{"output":["行1","行2"],"room":{"name":"名","desc":"≤80字","exits":["n"],"npcs":[{"name":"名","id":"id","brief":"≤15字","carry":[{"name":"物品名","category":"weapon|armor|accessory|misc","quality":"白|绿|蓝|紫|橙|红"}]}],"items":[{"name":"名","id":"id"}]},"char":{"hp":[60,100],"neigong":5,"waigong":8,"special":{"根骨":5,"悟性":6,"体魄":5,"魅力":5,"智谋":5,"身法":5,"气运":5}},"dao":{"karma":0,"jie":0,"sign":"天象","rumor":["事"]},"delta":{"items_add":[{"name":"物品名","category":"weapon|armor|accessory|misc","quality":"白|绿|蓝|紫|橙|红"}],"items_rm":[],"skill_up":{},"exp":0,"pot":0,"flags_add":[]}}
items_add 里的元素也可以是纯字符串（不需要装备系统参与的剧情道具/杂物），结构化写法仅用于武器/护甲/饰品类物品。
npcs 的 carry 字段只在该 NPC 首次登场那一轮写：列出出场描述里玩家肉眼可见的随身物品（兵器、猎具、饰物、包裹等，0-3件，寻常人多为白/绿档），出场叙事必须描述其外观且提到这些东西——所见即所得，之后系统会固化这份清单作为他的全部随身家当（掉落/偷窃都只出自这里），后续轮次不必再写 carry。
npcs 里某个 NPC 如果是路途遭遇生成的生态猛兽/山贼游哨这类"泛用清剿目标"（不是具名剧情人物），可选加一个 "tag" 字段（比如 "熊山野兽""黑风寨山贼"，具体归属看当前地域的路途遭遇说明），系统会用它核对是否推进对应的清剿类任务进度；具名剧情人物不要加这个字段。
如果这一轮的旁白/对话文本里，你让某个此前从未出现过的具名人物被提及（比如"我那侄子阿福在山下磨坊"），在顶层JSON里加 "mentionedNewNpcs":["阿福"] 字段列出这些名字，不需要每次都有，绝大多数时候留空或省略这个字段即可，只有真的提到全新的具名人物时才加。
如果收到"人物涌现"指令且这一轮确实让对应人物登场，在顶层JSON里额外加 "emergedNpcName" 和 "emergedNpcDescription" 两个字段（一句话定性描述，不含任何数值），其余情况完全不要出现这两个字段。
可选字段 "memory"：用不超过50字的纯客观事实，概括本轮真正发生、日后可能需要回想起来的关键事件（谁做了什么、得到或失去了什么、去了何处、结下或了断了什么关系、许下或应承了什么）。一律用"${playerName}"称呼玩家角色，不要用"你/我/玩家"这几种代词。只记事实，不写情绪，不写心理，不加评述。若这一轮只是寻常闲谈、查看状态、无关紧要的往来，省略这个字段即可，不必硬凑。这条会被单独存档，供日后当作往事重新想起，因此务必写得具体（写清人名地名，不要用"那人""某处"这类含糊指代）。这条摘要除了供你自己日后回想，也会被登记为在场者共同"目击"的事实，供其他 NPC 之后自然提起（比如路人听说"${playerName}在鱼定村打伤了谁"），所以只在真有值得旁人知道的事发生时才写，纯私密心理活动或不宜外传的隐秘不要写进来。

${wantMvu ? `
在这个 JSON 对象输出完毕之后，如果需要维护角色/世界状态变量，另起一行输出 <mvu> 块（不要放在 JSON 字符串内部，作为 JSON 后面独立的一段纯文本）。该写什么、能写什么，见上文规则。` : ""}`;

  // 按 SillyTavern 13 位置拆成消息数组。位置编号 9 与 13 等因各 API 实际限制会被合并到
  // 系统顶部，但保留标签供 TraceViewer/注入结构面板可视化。
  const messages = [
    makeBlock("main", `${ENGINE_IDENTITY}\n\n篇幅要求：${lenNote}\n${narratorVoicePrompt(narratorState)}`),
    makeBlock("worldInfoBefore", `${presetContent}${npcLoreBlock || ""}`),
    makeBlock("charDescription", `玩家角色：${playerName}。系统会维护气血、内外功、物品等状态；你只需叙事，不要擅自修改状态。`),
    makeBlock("charPersonality", `旁白/说书人的语气由「Main Prompt」中的声线控制，保持统一。`),
    makeBlock("scenario", gated.text),
    makeBlock("worldInfoAfter", `${wantCatalog ? `── 曲措乡物件志（叙事引用规范）──\n${describeCatalogForAI()}\n${CATALOG_TAIL}\n` : ""}${wantTalkItemRule ? `${buildTalkItemRule(narrativeOnly)}\n` : ""}${inSeaOfMind ? `${buildSeaOfMindRule()}\n\n` : ""}${wantIsolation ? `${ISOLATION}\n` : ""}\n\n${MAP_LAW}`),
    makeBlock("persona", `玩家以第一人称「我」扮演 ${playerName}，你是这个世界的说书人/Gamemaster。`),
    makeBlock("authorsNote", ""),
    makeBlock("exampleStart", "<START>"),
  ];

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
    narrativeOnly ? buildSettleNarrativeNote(opts) : "",
    (!narrativeOnly && isSettle && wantMvu) ? buildSettleMvuNote(opts) : "",
    (!narrativeOnly && isSettle && wantMvu)
      ? `\n关于下面那条 <mvu>：${(opts.settleKind === "gift" || opts.settleKind === "companion_invite" || opts.settleKind === "learn_skill") ? "这一轮必须给出" : "如果这一轮牵涉的人物（" + opts.settleNpc + "）对玩家的观感确有变化才给出"}。`
      : "",
    (!narrativeOnly && wantMvu) ? MVU_SYSTEM_INSTRUCTIONS : "",
    (!narrativeOnly && isSettle && wantMvu) ? buildSettleMvuExample(opts) : "",
  ].filter(Boolean).join("\n");

  const totalLen = messages.reduce((sum, b) => sum + (b.content?.length || 0), 0);
  if (opts.onSnapshot) opts.onSnapshot({ sys: messages, meta: { scope, narrativeOnly, isSettle, wantCatalog, wantIsolation, wantMvu, settleKind: opts.settleKind || null, len: totalLen } });
  return { sysBlocks: messages, phiBlock: makeBlock("phi", schemaBlock), phiRules };
}
