import { definePrompt } from "../registry.js";

// ── 铸剑坊/铁匠铺 定制设计：词条全集白名单（combat/resolveTurn.js 真正读取的字段） ──
const FORGE_EFFECT_WHITELIST = `
可选词条(effect，只能从这里选，按玩家"要求"语义匹配，白/绿档留空不给词条、蓝档起才给)：
· 攻击向：forceFirst(必先手,对应"快/先发") | ignoreDefense(无视防御,对应"锋利/破甲") | doubleVsStatus(克中招之敌翻倍) | lowHpBonus:0.15(残血增伤,对应"绝境/搏命") | afterStatusBonus(趁敌中招追击) | detonateMark:{perStackRatio:0.35}(引爆内伤)
· 控制向：enemyCostPenalty:{value:2,turns:2}(封穴抬高对方耗气) | freezeEnergyRecovery(封气,冻回气) | applyMark:{name:"内伤印",stacks:1}+applyMarkChance:0.3(附内伤印)
· 应对向：onCounterSuccessDamageRatio:0.3(应对成功追伤,对应"以守反攻") | onCounterSuccessEnergyGain:2(应对成功回气)
· 续航向：hpRestore:0.08(每回合回血,对应"养身/温养") | energyRestore:2(起手回气)
· 六维：sixDim:{气运:2}(对应"幸运") | sixDim:{身法:2}(轻便) | sixDim:{根骨:2}(坚固) | sixDim:{魅力:2} | sixDim:{智谋:1} | sixDim:{体魄:1} | sixDim:{悟性:1}
effect 与 sixDim 二选一为主(一件东西通常只挂其一，紫橙档可两者少量兼有)。`;

// 注册 domain 层迁入 withAI 的提示词块与调用定义
export function registerDomainCalls() {
  // ── 旁白私语观感裁决（WO-15：narrator_affinity 自软结算通道拆出为独立结构化调用） ──
  // 旧「软结算通道」已删，但私语好感裁决不走回合判官管线（私聊独立流程），
  // 这里保留一个三选一的小调用替代表决，系统侧负责数值与日上限。
  const AFFINITY_OPTIONS = ["投机贴心", "寻常闲聊", "敷衍冒犯", "无法判断"];
  definePrompt("block", "narrator.affinity.sys", {
    label: "旁白观感仲裁系统指令",
    slot: "sys",
    text: () => "你是游戏结算仲裁，只回答一道选择题。不写剧情、不解释，严格只输出一行JSON。",
  });
  definePrompt("block", "narrator.affinity.user", {
    label: "旁白观感选择题",
    slot: "user",
    text: (ctx) => `问题：玩家私下对旁白说：「${ctx.playerSay || ""}」。这句话在她那里落到什么份上？
选项：${AFFINITY_OPTIONS.map((o) => `「${o}」`).join("、")}
输出JSON：{"choice":"选项原文之一","probs":{"选项":概率,...}}，probs覆盖全部选项、总和为1。`,
  });
  definePrompt("call", "narrator.affinity", {
    group: "sync",
    label: "旁白观感裁决",
    execution: "sync_pipeline",
    route: "light",
    reviewDesc: "三选一观感分类（投机贴心/寻常闲聊/敷衍冒犯），数值与日上限账本全在系统侧",
    tokenLimitKey: "extraction",
    defaultMaxTokens: 512,
    join: "",
    blocks: ["narrator.affinity.sys", "narrator.affinity.user"],
    schema: {
      name: "narrator_affinity",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["choice", "probs"],
        properties: {
          choice: { type: "string", enum: AFFINITY_OPTIONS },
          probs: { type: "object", additionalProperties: false, required: AFFINITY_OPTIONS, properties: Object.fromEntries(AFFINITY_OPTIONS.map((o) => [o, { type: "number" }])) },
        },
      },
    },
  });

  definePrompt("block", "persuasion.turn.sys", {
    label: "说服交锋系统指令",
    slot: "sys",
    text: (ctx) => {
      const { persuade, hitKeyIds = [], guard = 100 } = ctx;
      const keysDesc = persuade.keys
        .map(k => {
          const hit = hitKeyIds.includes(k.id);
          // 判定放宽（本轮改）：need-flag 不再否决命中，只影响"线索是否提前解锁"。
          // 玩家没线索也能歪打正着命中——所以这里不再标"不算数"。
          return `  - [${k.id}] ${k.hint}${hit ? "（已戳中，不重复计）" : ""}`;
        })
        .join("\n");

      return `你现在扮演【${persuade.who}】，和玩家进行一场"说服"交锋。玩家想让你让步，你有顾虑不肯松口。

你的心结（不肯让步的原因）：${persuade.knot}

【台词要求，绝不泄底】
line 字段只放【${persuade.who}】这一句话的台词，口语，不超过30个字。
- 不写任何叙事、旁白、动作、神态、括号说明，不写"他说""掌柜道"这类引导语，直接就是这个人说出口的话，像真人回话那么短。
- 【关键】绝不能暴露游戏机制：不说"你说中了""还差一点""再说一条""你戳中了我的心结"这类话；不把下面的突破口内容当台词念出来提示玩家。心结让玩家自己从对话里揣摩，你只以这个人的身份自然反应。

【你的立场演绎】（当前戒心 ${guard}/100，越低越松动）
- 戒心高（>60）：搪塞、推脱、打太极，话冷。
- 戒心中（30~60）：口风开始软，偶尔漏出点真心话，但嘴上还端着。
- 戒心低（<30）：几乎守不住，玩家再推一把就松口。
- 玩家没戳中要害、只是空谈或硬来时：继续挡，别松口。
- 玩家戳中顾虑/软肋、或话说得让你放下戒备时：语气动摇，但别一次答应，还要再端一端。

【玩家可能戳中的突破口】（仅供你判断，不要在台词里念出来）：
${keysDesc}

【输出格式与隐藏判定】
只输出一个 JSON 对象（玩家只看到 line 字段，其余系统用），不要任何别的文字：
{"line":"你这句台词（≤30字，纯口语）","hit":"戳中的key的id或null","guardDrop":0到50的整数,"yield":true或false}
- line：就是这个人说出口的话本身，不写引导语、不带引号。
- hit：玩家的话【只要方向对、沾到某个未戳中突破口的边】就填那个 id，不要求字字精准；纯空谈、硬来、重复已戳中的，才填 null。判定宁松勿严——别让玩家好几轮一个都不中。
- guardDrop：这话让你放下多少戒备。一般讲理/寒暄给 5~15；说得真诚、投机、示弱、给足好处、或说到你情绪痛点上，给 30~50；胡搅蛮缠、冒犯你，给 0。
- yield：只有当【累计戳中数 ≥ ${persuade.resistance}】且你这句是松口答应时，才 true；否则 false。
当前累计已戳中：${hitKeyIds.length} / 需要 ${persuade.resistance}。`;
    },
  });

  definePrompt("block", "persuasion.turn.user", {
    label: "说服玩家本轮发言",
    slot: "user",
    text: (ctx) => ctx.playerSay ?? "",
  });

  definePrompt("call", "persuasion.turn", {
    group: "sync",
    label: (ctx) => `说服（${ctx.persuade.who}）`,
    execution: "sync_pipeline",
    route: "primary",
    reviewDesc: "剥离末尾 JSON 行解析 hit/guardDrop/yield，台词限制 ≤30 字不泄底",
    tokenLimitKey: "persuasion",
    defaultMaxTokens: 2000,
    history: (ctx) => ctx.history || [],
    join: "",
    blocks: ["persuasion.turn.sys", "persuasion.turn.user"],
    // 原生结构化输出：hit 枚举随本场突破口动态生成（key id 全集 + null），
    // 模型没法编造不存在的 key；guardDrop/yield 锁类型，区间裁剪仍由解析层兜底。
    schema: (ctx) => {
      const keyIds = (ctx?.persuade?.keys || []).map((k) => k.id).filter(Boolean);
      return {
        name: "persuasion_turn",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["line", "hit", "guardDrop", "yield"],
          properties: {
            line: { type: "string" },
            // OpenAI strict 可选值用 union type；null 表示未命中。
            // Gemini 侧由 toGeminiResponseSchema 转写为 string + nullable。
            hit: { type: ["string", "null"], enum: [...keyIds, null] },
            guardDrop: { type: "integer" },
            yield: { type: "boolean" },
          },
        },
      };
    },
  });

  definePrompt("block", "forge.design.sys", {
    label: "定制设计系统指令",
    slot: "sys",
    text: (ctx) => {
      // craft 语境：默认铁匠铺(打兵器/护具/铁料)，金玉行传 { shop:"金玉行", maker:"玉匠", wares:"玉器" }
      // 让 prompt 贴合——玉匠雕的是玉器饰物，说书人味也不同。不传则走铁匠默认。
      const craft = ctx.craft;
      const maker = craft?.maker || "铁匠";
      const wares = craft?.wares || "兵器/护具/饰物";
      const shop = craft?.shop || "铁匠铺";
      return `你是曲措乡这个澜湄雪域武侠世界里${shop}的"匠心"——玩家拿料来定制${wares}，你这位${maker}据玩家给的【材料/类别/要求】设计出三个不同的成品方案供挑选。守规矩：你只负责创意(名字、属于哪类装备、挂什么词条、说书人风味的介绍)，绝不决定品质高低(那由玩家气运和料子成色定)、绝不编数值。三个方案要有区别——同样的料和要求，可往不同形制/侧重去做。`;
    },
  });

  definePrompt("block", "forge.design.user", {
    label: "定制设计需求与词条白名单",
    slot: "user",
    text: (ctx) => `玩家定制需求：
· 材料：${ctx.material || "(未指定，任你择料)"}
· 类别：${ctx.category || "(未指定，你据材料与要求判断最合适的类别)"}
· 要求：${ctx.requirement || "(未特别要求)"}
${FORGE_EFFECT_WHITELIST}

请设计 3 个不同的成品方案，只输出 JSON，不要任何解释或 markdown：
{"candidates":[
  {"name":"贴合材料与形制的成品名(不超过7字)","category":"weapon|armor|accessory 三选一","effect":{词条对象，按白名单选，可空对象{}},"sixDim":{六维对象，可空},"desc":"一两句说书人白话古文，讲这件东西的形制/来历/脾性，禁冒号破折号"}
  , {第二个方案，与第一个形制或侧重不同}\x20
  , {第三个方案，再不同}
]}
注意：category 必须是 weapon/armor/accessory 之一的英文；effect 和 sixDim 不给就写空对象 {}；name 要贴合材料(玩家写了陨铁/某玉料，名字里就该见其质感)。`,
  });

  definePrompt("call", "forge.design", {
    group: "sync",
    label: (ctx) => `${ctx.craft?.shop || "铁匠铺"}定制设计`,
    execution: "sync_pipeline",
    route: "extraction",
    reviewDesc: "解析 3 方案 JSON 并裁剪名称/类别/词条白名单，品质与数值全由系统掷骰",
    tokenLimitKey: "extraction",
    defaultMaxTokens: 2000,
    cfg: (_apiCfg, ctx) => ctx.forgeCfg,
    join: "",
    blocks: ["forge.design.sys", "forge.design.user"],
    // 原生结构化输出：effect/sixDim 是开放词条对象（键来自白名单但组合自由），
    // schema 只锁其为对象、锁死 category 三选一与五个必填键；词条白名单裁剪仍在解析层。
    schema: {
      name: "forge_design",
      // effect/sixDim 是开放词条对象（键名已声明但不闭合、键值类型异构），不满足
      // OpenAI strict subset——openai/vertex/openrouter 见此标记回退 json_object，
      // Gemini/Anthropic 仍用原生 schema，withAI 本地校验不受影响。
      strictCompatible: false,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["candidates"],
        properties: {
          candidates: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "category", "effect", "sixDim", "desc"],
              properties: {
                name: { type: "string" },
                category: { type: "string", enum: ["weapon", "armor", "accessory"] },
                // 词条键名按白名单显式声明（Gemini 要 declared properties）；
                // 键值类型异构（布尔旗/数值/嵌套对象）不锁 type，白名单裁剪仍在解析层。
                effect: {
                  type: "object",
                  properties: Object.fromEntries([
                    "forceFirst", "ignoreDefense", "doubleVsStatus", "lowHpBonus", "afterStatusBonus",
                    "detonateMark", "enemyCostPenalty", "freezeEnergyRecovery", "applyMark", "applyMarkChance",
                    "onCounterSuccessDamageRatio", "onCounterSuccessEnergyGain", "hpRestore", "energyRestore",
                  ].map((k) => [k, {}])),
                },
                sixDim: {
                  type: "object",
                  properties: Object.fromEntries(
                    ["气运", "身法", "根骨", "魅力", "智谋", "体魄", "悟性"].map((k) => [k, { type: "number" }]),
                  ),
                },
                desc: { type: "string" },
              },
            },
          },
        },
      },
    },
  });
}

registerDomainCalls();
