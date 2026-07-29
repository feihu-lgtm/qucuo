// 卡扫描的四阶段 prompt 与 schema
// ============================================================================
// 【设计前提】免费反代站 5 次/分钟。所以每一次调用都必须一次问清一批事，
// 绝不为单个字段单独发一次。四个阶段的分工：
//   阶段1 总览   —— 只发条目摘要，一次解决分类/分组/多人拆分（1 次）
//   阶段2 人物   —— 发人物完整正文，出品阶与七维（每批 4 人，1~3 次）
//   阶段3 玩家   —— 出体貌公开层与七维（0~1 次）
//   阶段4 开场白 —— 人称与文体归化（0~1 次）
//
// 【为什么每个字段都要 why】玩家要逐项审改，没有判断依据就只能盲信 AI，
// 那就退化成"AI 说了算"。why 限 20 字以内，成本可忽略。
//
// 【为什么锚点用项目内真人】品阶和七维是纯数值，模型没有参照系就会瞎给。
// 这里的锚点全部取自 residentNpcs.js 的实际配置（levelCap 分布 0档3人/1档10人/
// 2档19人/3档10人/4档12人/5档9人），不是编的描述。

// ── 常量锚点 ──────────────────────────────────────────────────────────────────

// 品阶语义锚点。数值口径来自 npcGeneration.js 的 getTierPower：
// 内外功 白5 绿23 蓝41 紫59 橙77 红95，攻击力 白18 绿33 蓝60 紫109 橙198 红310。
// 人物实例来自 residentNpcs.js，都是项目里真实配好的 NPC。
export const TIER_ANCHORS = `品阶共 6 档（0白 1绿 2蓝 3紫 4橙 5红），越高战力差距越悬殊。判档看的是**战力与江湖分量**，与善恶、美丑、性别、是否人类都无关：
- 0 白：完全没练过武的人。例：在索桥上蹭住的野道士、驿站赶骡子的脚夫、抄经八十七天还没摸过剑的入门弟子。
- 1 绿：寻常村民、店家、门派里管杂务的。例：村长之女（账房出身）、饭馆掌柜、村里厨娘、看门四十年的老道、村口一只好斗的大公鸡。
- 2 蓝：地方上的好手、门派普通弟子、有威胁的野物。例：土司府总管家、玉泉寨村长、堵在镇口收过路费的恶汉、赌石坊女庄家、练得最狠的门派女弟子、一头灵性雪豹。
- 3 紫：门派中坚、一教之主、各堂主事、名门传人。例：土司之女、雪山派小师妹、欢喜教教主、药圃主事、峨眉枪传人、佛堂管事。
- 4 橙：长老、教习、山寨首领、大弟子、成年巨兽。例：掌门师母、剑坪教习、黑风寨首领、教中圣女、峨眉大弟子、雪山崖底的老白猿、大草甸的独眼狼王。
- 5 红：掌门、家主、门主、一方霸主、兽王。例：青城派掌门、前代掌门、唐门家主、峨眉掌门、血刀门主、锦官城官府都事、熊山吊睛白额巨虎。
拿不准就往低判。判高了会让杂鱼被写得深不可测，比判低更糟。`;

// 七维锚点。字段名与 char.special / npc.special 完全一致，0-10。
export const SPECIAL_ANCHORS = `七维天赋，每项 0-10 的整数，5 是常人基线：
- 根骨：筋骨与气力。1=手无缚鸡之力 5=寻常体魄 8=力能扛鼎 10=天生神力
- 悟性：领悟与学习。1=愚钝 5=中人之姿 8=一点就透 10=无师自通
- 体魄：耐力与抗打。1=久病之身 5=常人 8=经得住摔打 10=金刚不坏
- 魅力：容貌气度与亲和。1=形容猥琐 5=五官端正 8=顾盼生姿 10=倾城之色
- 智谋：算计与筹划。1=一根肠子 5=寻常心思 8=心细如发 10=算无遗策
- 身法：轻捷与协调。1=手脚发僵 5=寻常 8=身轻如燕 10=踏雪无痕
- 气运：运道。1=倒霉催的 5=不好不坏 8=常有巧遇 10=天命所归
正文里没有依据的项，一律填 5，不要为了好看凑高。`;

const JSON_LAW = `只输出一个 JSON 对象。不要 markdown 代码围栏，不要任何解释性文字，不要在 JSON 前后加话。
所有 why 字段不超过 20 字，写判断依据而不是复述结论。
正文里找不到依据的字段：数值填给定的默认值，文字填空字符串，不要编造。`;

// ── 阶段 1：总览 ──────────────────────────────────────────────────────────────

// 单条发多少字。原先是 120 字摘要，为省额度。但反代不计费，省的那点 token 换来的
// 是判错——「三霄」「血角」这类标签与关键词一模一样的条目，看头 120 字根本分不出
// 是人是概念，而这恰恰是最需要 AI 帮忙的一类。
//
// 【为什么不干脆发全文】不是为省钱，是两个硬限制：反代对单次请求体大小常有上限，
// 以及实测有单条 27295 字、整卡 133095 字的世界书（3b1fb366 与万象枢机）。发全文会
// 让一次分类等上几十秒、还可能直接被网关拒。
// 3000 字是个够用的量：一条人物设定的前 3000 字必然已经写清了「这是谁」，
// 分类要的信息全在开头。
export const STAGE1_PER_ENTRY = 3000;
export const STAGE1_TOTAL_CAP = 90000;

/**
 * 一次调用解决四件事：定分类、认出同一个人的多个维度条目、认出一条塞多人、概括题材。
 * @param {object} opts { perEntry, totalCap } 可覆盖发送量
 */
export function buildStage1(card, entries, opts = {}) {
  const perEntry = opts.perEntry ?? STAGE1_PER_ENTRY;
  const totalCap = opts.totalCap ?? STAGE1_TOTAL_CAP;

  // 总量兜底：整卡正文超上限时，按条目均摊，谁都别独占。
  // 均摊而不是"先到先得"是有意的——先到先得会让排在前面的巨型条目吃掉全部配额，
  // 后面的人物条目一个字都发不出去，那还不如都发少点。
  const totalRaw = entries.reduce((a, e) => a + Math.min(e.length || 0, perEntry), 0);
  const shrink = totalRaw > totalCap ? totalCap / totalRaw : 1;
  const budget = Math.max(400, Math.floor(perEntry * shrink));

  const list = entries.map((e, i) => {
    const body = (e.content || "").trim();
    const sent = body.length > budget ? body.slice(0, budget) : body;
    const tail = body.length > budget ? `\n    …（此条共 ${e.length} 字，只发了前 ${budget} 字）` : "";
    return `[${i}] 标签「${e.label}」 关键词[${(e.keys || []).join("/") || "无"}] `
      + `${e.constant ? "常驻 " : ""}${e.length}字 机器初判=${e.kind}\n正文：\n${sent}${tail}`;
  }).join("\n\n────\n\n");

  const system = `你在帮一个中文武侠文字游戏「曲措乡」导入外部角色卡。这一步只做归类判断，不做改写。

分类只能用这几个值：
- person：一个具名的人或有名有姓的动物，游戏会把它变成可对话、可切磋、有好感度的 NPC
- faction：门派、势力、种族、组织
- place：地点、地域、场景
- rule：世界规则、机制、时代背景、修行体系
- item：资源、物品、装备
- player：描述玩家自己的条目（关键词里常带 <user> 或 {{user}}）
- meta：回复格式、状态栏、变量、思维链、双语要求等框架指令，不属于世界观内容
- drop：空条目、废条目、或纯属作者备注

判断要点：
1. 标签与关键词相同（比如标签「三霄」关键词也是「三霄」）时，标签没给出额外信息，要靠摘要内容判断这是人还是概念。
2. 同一个角色常被拆成多条（性格/外貌/衣柜/二次解释/nsfw 各一条），关键词往往完全相同。把它们归到同一个人名下。
3. 有的条目一条塞了好几个人（标签常叫「次要角色」「人物图谱」之类），要列出里面所有人名。
4. 「衣柜」「基础」「外貌」这类标签写的是某个角色平时穿什么、长什么样，属于 person，不是 item。

${JSON_LAW}

输出格式：
{
  "题材": "一句话概括这张卡的世界观与故事类型，20字内",
  "条目": [{"i": 0, "kind": "person", "why": "摘要在写一个具名人物的性格"}],
  "同人分组": [{"人名": "齐旻", "条目": [2, 4, 5], "why": "三条都在写同一人的不同侧面"}],
  "多人条目": [{"i": 11, "人名": ["通天教主", "元始天尊", "帝辛"], "why": "一条里并列了多位人物"}]
}
"条目" 必须覆盖全部条目，i 用给你的编号。"同人分组" 和 "多人条目" 没有就给空数组。`;

  const user = `卡名：${card.name || "（无名）"}
世界书名：${card.bookName || "（无）"}
条目共 ${entries.length} 条（超长的只发了开头，已在该条末尾注明）：

${list}`;

  return { system, user, stage: 1 };
}

// ── 阶段 2：人物卡片 ──────────────────────────────────────────────────────────

/**
 * 只对 person 分组跑，输入是合并后的完整正文。
 * 批大小默认 4：Gemini 上下文塞 10 人也不会爆，但一处 JSON 解析崩了整批白费，
 * 在 5 次/分钟的额度下宁可多花一次调用换稳。失败会自动降到 2 再降到 1。
 */
export function buildStage2(people, opts = {}) {
  const playerName = opts.playerName || "玩家";
  const genre = opts.genre || "";

  const body = people.map((p, i) => {
    return `━━ 人物 ${i} ━━
本名：${p.name}
别名：${(p.aliases || []).join("、") || "（无）"}
正文（${(p.entry || "").length}字）：
${p.entry}`;
  }).join("\n\n");

  const system = `你在帮中文武侠文字游戏「曲措乡」把外部角色卡里的人物，换算成游戏内的 NPC 数据。

${TIER_ANCHORS}

${SPECIAL_ANCHORS}

内功与外功都是 0-100 的整数，跟品阶挂钩：白档约 5、绿约 23、蓝约 41、紫约 59、橙约 77、红约 95。内功决定气血厚薄与真气储量，外功决定出手的杀伤。给的值应当贴着你判的品阶来，除非正文明确写了此人偏内家或偏外家（例如老僧内功深厚而不擅搏杀、莽汉外功强横而无内息），这时可以在同档基准上一高一低。

招式按"原型"来配，共七种，每种在不同品阶下自动解出不同强度的效果，你只需要选原型并起名字：
- 硬攻（攻击）：正面硬碰，倍率高，高档带无视防御与必先
- 趁虚（攻击）：针对对手破绽下手，高档对已中状态的敌人加成很大
- 防守反击（防御）：挡下再反打，高档近乎全免并能抢先结算
- 封穴（防御）：以守为攻，高档封住对手的真气回复
- 致乱（状态）：扰乱心神，高档令对手出招失准
- 蓄势（状态）：积蓄气力，高档大幅提升下一击
- 疗伤（状态）：运功回血，只有明确会疗伤的角色才配
四个必备槽位：攻击、防御、状态、回气。回气槽固定用"回气"原型，只需起名。若正文明确写此人会疗伤，可以多给一个疗伤槽。名字要贴人物身份与武学路数，别用通用词。

好感度是 0-100 的整数，玩家初见时的默认值是 0。只有正文明确写了这个人与玩家（${playerName}）已有交情、或身份上天然亲近（如亲人、同门师长）时才给正值，最多 20。正文写明敌对的可以给负值，最低 -20。

里程碑是好感度达到阈值时解锁的一段固定剧情，本作只有两档：30 和 60。每档给：
- title 标题，4-8 字
- brief 一句话说明，20 字内，写"她做了什么"而不是"关系变好了"
- text 两句叙事正文，每句 30-60 字，是玩家领取这段剧情时会读到的文本。用白话古文、章回说书人口吻写，第三人称，对话用「」包裹。写一件具体的小事（送一样东西、说一句从没说过的话、带你去一个地方），不要写抽象的情感升华。
两档要贴着这个人物自己的性格与处境写，不要写成换个名字就能用的通用模板。

${JSON_LAW}

输出格式：
{
  "人物": [
    {
      "i": 0,
      "name": "本名，照抄输入",
      "brief": "15字以内的一句话身份，会显示在游戏界面的人名旁边",
      "brief_why": "",
      "levelCap": 2,
      "levelCap_why": "",
      "special": {"根骨":5,"悟性":5,"体魄":5,"魅力":5,"智谋":5,"身法":5,"气运":5},
      "special_why": "",
      "neigong": 41,
      "waigong": 41,
      "neiwai_why": "",
      "moves": {
        "攻击": {"archetype": "硬攻", "name": "", "desc": "一句话写这招看起来什么样"},
        "防御": {"archetype": "防守反击", "name": "", "desc": ""},
        "状态": {"archetype": "致乱", "name": "", "desc": ""},
        "回气": {"name": "", "desc": ""}
      },
      "moves_why": "",
      "外貌锚点": "80字以内，只写别人一眼能看见的：身形、面容、发式、穿着、随身物、习惯动作。不要写性格与内心",
      "初始态度": "40字以内，这个人初次面对玩家时的态度与说话方式",
      "好感初值": 0,
      "好感初值_why": "",
      "里程碑": [
        {"threshold":30,"title":"","brief":"","text":["",""]},
        {"threshold":60,"title":"","brief":"","text":["",""]}
      ]
    }
  ]
}
"人物" 数组必须与输入的人物一一对应，i 用输入的编号。`;

  const user = `${genre ? `这张卡的题材：${genre}\n玩家角色名：${playerName}\n\n` : `玩家角色名：${playerName}\n\n`}${body}`;

  return { system, user, stage: 2 };
}

// ── 阶段 3：玩家体貌与天赋 ────────────────────────────────────────────────────

/**
 * 只在"导入当主角"时跑。
 * 【硬性边界】只出公开层 7 个字段。bodyProfile 的私密层五项（疤痕印记/体味/
 * 身体细节/敏感处/习惯癖好）不在 schema 里、也不在 prompt 里提，那五项只允许
 * 玩家在面板上自己手填。这不是可配置项。
 * 另外：卡的 personality 不进这一阶段的输入——玩家的性格由玩家每轮输入实时
 * 表达，写死会跟实际操作打架。
 */
export function buildStage3(sources, opts = {}) {
  const nameHint = opts.cardName || "";

  const system = `你在帮中文武侠文字游戏「曲措乡」把一张角色卡换算成玩家自己的角色档案。

要填的是"体貌"，也就是别人一眼能看见、以及动作描写要照着写的东西，共 7 项：
- height 身量：身高与整体比例，别人第一眼的高矮印象
- build 体型：肌肉、骨架与胖瘦，决定动作起来是灵便还是沉稳
- face 面容：五官轮廓与神情底色，别人记得住的那几笔
- skin 肤色：肤色深浅与质感，含晒痕、冻疮这类长期痕迹
- hair 发式：头发的长度、束法与颜色
- voice 声音：音色、语速与说话的习惯口吻
- clothing 惯常穿着：日常衣物的形制、新旧与穿法习惯

每项 30 字以内，写具体可见的细节，不要写性格、不要写内心、不要写生平。
原文没提到的项一律留空字符串，不要编——留空之后玩家会自己填，编了反而要他先删。

${SPECIAL_ANCHORS}

${JSON_LAW}

输出格式：
{
  "name": "12字以内的角色名，原文名字太长就截取或取其中的称呼",
  "name_why": "",
  "bodyProfile": {"height":"","build":"","face":"","skin":"","hair":"","voice":"","clothing":""},
  "special": {"根骨":5,"悟性":5,"体魄":5,"魅力":5,"智谋":5,"身法":5,"气运":5},
  "special_why": "",
  "persona": "120字以内的出身与来历，用第三人称写，供说书人参考。没有依据就留空",
  "缺失": ["原文完全没提到、留空了的 bodyProfile 字段名"]
}`;

  const user = `${nameHint ? `卡名：${nameHint}\n\n` : ""}以下是这张卡里与玩家角色有关的全部文字：

${sources}`;

  return { system, user, stage: 3 };
}

// ── 阶段 4：开场白归化 ────────────────────────────────────────────────────────

/**
 * 只改玩家选中的那一个开场白。
 * npcLore 正文不改文体——那是给模型看的内部资料，不是给玩家看的正文，改了
 * 纯烧额度。
 *
 * 【人称为什么改成用名字】卡普遍用第二人称「你」称呼玩家（姬侠传把这条写进了
 * assistant prefill），而本项目的约定是：玩家输入侧用第一人称「我」，引擎叙事
 * 侧是第三人称说书人。sysBase.js 里 memory 摘要那条规则写得最明确——一律用
 * 玩家名字称呼，不要用"你/我/玩家"。所以归化的目标人称是"用名字"。
 */
export function buildStage4(text, opts = {}) {
  const playerName = opts.playerName || "少侠";

  const system = `你在帮中文武侠文字游戏「曲措乡」改写一段开场白，让它符合本作的叙事人称与文体。原文来自外部角色卡，人称和文风都不一样。

【人称】原文多半用第二人称「你」称呼玩家。改成第三人称说书人叙述，玩家角色一律用名字「${playerName}」称呼，不要用"你"、不要用"我"、不要用"玩家"。其他人物照原样用各自的名字。

【文体】白话古文，章回说书人口吻。句句主谓宾齐全，句间要有逻辑过渡。禁用冒号和破折号。
- 对话用「」包裹，引语用双引号，心理活动用星号包裹表示斜体，旁白不加标记
- 每句必须推进剧情、塑造人物或营造氛围，没有信息量的句子删掉
- 只写发生了什么，不写它意味着什么。信任读者
- 段落结尾以具体动作或台词收束，禁止用抽象总结句收尾
- 情绪通过行动或台词流露，不要用五官特写标注（禁用"眼底闪过""嘴角勾起""瞳孔一缩"）
- 比喻要新颖具体，禁用"涟漪""惊雷""潮水""投石入湖"这类陈腐喻体
- 禁止"不是X，而是Y"这类先否后肯的句式，直接说 Y
- 形容词副词不连用，单段成语不超过 2 个

【保真】情节、人物、地点、时间、因果关系全部照原文，不要增删事件，不要改人名地名。只改人称与文风。篇幅与原文相当，上下浮动三成以内。

直接输出改写后的正文，不要任何说明、不要标题、不要用代码围栏包裹。`;

  const user = `原文：\n\n${text}`;

  return { system, user, stage: 4, plainText: true };
}

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

// ── 降级值 ────────────────────────────────────────────────────────────────────

// AI 失败时不能阻塞导入，每个字段都要有不靠 AI 的兜底。
// 这些值的来源：special 全 5 是常人基线；levelCap 1 是"寻常村民"（residentNpcs
// 里 1 档最多的就是村民店家）；好感 0 是初见默认；里程碑四档阈值与 AI 输出一致。
// 阈值必须是 30 / 60 两档：characterMilestones.js 的 getAvailableMilestone
// 只查这两个数（thresholds = [60, 30]），给别的阈值等于永远不会被解锁。
// text 必须是数组：CharacterPage.jsx 里是 viewingMilestone.text.map(...)，
// undefined 会直接抛错。空数组安全（只是领取后没内容可读）。
export const FALLBACK_MILESTONES = [
  { threshold: 30, title: "面善", brief: "他开始主动与你搭话", text: [] },
  { threshold: 60, title: "交心", brief: "他说起了从不与人提的事", text: [] },
];

export const FALLBACK_SPECIAL = { 根骨: 5, 悟性: 5, 体魄: 5, 魅力: 5, 智谋: 5, 身法: 5, 气运: 5 };

export const FALLBACK_LEVEL_CAP = 1;

// 七个招式原型。取值必须与 combat/moveArchetypes.js 的 MOVE_ARCHETYPES 键一致，
// 否则 resolveArchetype 查不到会返回 null、招式退化成空对象。
export const MOVE_ARCHETYPE_IDS = ["硬攻", "趁虚", "防守反击", "封穴", "致乱", "蓄势", "疗伤"];
export const MOVE_SLOTS = ["攻击", "防御", "状态", "回气"];
export const SLOT_DEFAULT_ARCHETYPE = { 攻击: "硬攻", 防御: "防守反击", 状态: "致乱", 回气: "回气", 疗伤: "疗伤" };

// 品阶 → 内外功基准，跟 npcGeneration.js 的 getTierPower 口径一致
export const TIER_NEIGONG = [5, 23, 41, 59, 77, 95];

/** 内外功清洗：0-100 整数，缺值按品阶基准补 */
export function sanitizeGongfu(raw, levelCap = 1) {
  const v = Number(raw);
  const base = TIER_NEIGONG[Math.max(0, Math.min(5, levelCap))] ?? 23;
  if (!Number.isFinite(v)) return base;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** 招式清洗：原型必须在册，槽位补齐四个，名字空则留空由 UI 兜底 */
export function sanitizeMoves(raw, levelCap = 1) {
  const out = {};
  for (const slot of MOVE_SLOTS) {
    const m = (raw && typeof raw === "object" && raw[slot]) || {};
    const wanted = String(m.archetype || SLOT_DEFAULT_ARCHETYPE[slot] || "");
    // 回气槽固定走「回气」原型，别的槽位若给了不在册的原型就退回该槽默认
    const arch = slot === "回气" ? "回气"
      : (MOVE_ARCHETYPE_IDS.includes(wanted) ? wanted : SLOT_DEFAULT_ARCHETYPE[slot]);
    out[slot] = {
      archetype: arch,
      name: String(m.name || "").slice(0, 10),
      desc: String(m.desc || "").slice(0, 60),
    };
  }
  // 疗伤是可选第五槽，只有 AI 明确给了才留
  const heal = raw && typeof raw === "object" && raw["疗伤"];
  if (heal && (heal.name || heal.archetype)) {
    out["疗伤"] = { archetype: "疗伤", name: String(heal.name || "").slice(0, 10), desc: String(heal.desc || "").slice(0, 60) };
  }
  return out;
}

/** 把 AI 的七维输出清洗成合法值：缺项补 5，越界钳到 0-10，非整数取整 */
export function sanitizeSpecial(raw) {
  const out = { ...FALLBACK_SPECIAL };
  if (!raw || typeof raw !== "object") return out;
  for (const k of Object.keys(FALLBACK_SPECIAL)) {
    const v = Number(raw[k]);
    if (Number.isFinite(v)) out[k] = Math.max(0, Math.min(10, Math.round(v)));
  }
  return out;
}

/** 品阶清洗：0-5 整数，非法值退到 1 档 */
export function sanitizeLevelCap(raw) {
  const v = Number(raw);
  if (!Number.isFinite(v)) return FALLBACK_LEVEL_CAP;
  return Math.max(0, Math.min(5, Math.round(v)));
}

/** 好感初值清洗：-20 ~ 20，非法退 0 */
export function sanitizeAffection(raw) {
  const v = Number(raw);
  if (!Number.isFinite(v)) return 0;
  return Math.max(-20, Math.min(20, Math.round(v)));
}

/** 里程碑清洗：阈值必须是那四档，缺的用兜底补齐 */
export function sanitizeMilestones(raw) {
  const byT = new Map();
  if (Array.isArray(raw)) {
    for (const m of raw) {
      const t = Number(m?.threshold);
      if (![30, 60].includes(t)) continue;   // 别的阈值永远不会被解锁，直接丢
      const title = String(m?.title || "").slice(0, 8);
      const brief = String(m?.brief || "").slice(0, 30);
      const text = Array.isArray(m?.text)
        ? m.text.map(x => String(x || "").trim()).filter(Boolean).slice(0, 4)
        : [];
      if (title) byT.set(t, { threshold: t, title, brief, text });
    }
  }
  return FALLBACK_MILESTONES.map(f => byT.get(f.threshold) || { ...f, text: [] });
}

/** brief 清洗：截 15 字，空则由调用方用 comment 兜底 */
export function sanitizeBrief(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim().slice(0, 15);
}
