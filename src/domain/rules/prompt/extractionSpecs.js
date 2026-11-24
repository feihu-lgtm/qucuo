import { APPEASE_EXTRACTION_SPEC } from "./appeaseExtraction.js";
import { renderFieldScales, renderPromptTemplate, getPresentNpcs } from "./promptRefs.js";
import { OC_BY_NAME } from "../npc/npcCarry.js";
import { intimacyGate } from "../npc/intimacy.js";
import { AFFECTION_RULES, FIELD, giftRange, learnRange } from "../state/fields.js";
import { ADULT_HUMAN_FORM, isHumanFormCompanion } from "../companion/companionSlots.js";

// 公共字段和 MVU 路径规矩统一追加到每个提取提示，确保单/双调用保持一致。
// memory 摘要使用玩家角色名的第三人称，供回忆与事实账本复用。
function commonExtractTail(render) {
  return render(`

除上面 JSON 里的字段，无论本轮有无状态变化，都请在**同一个顶层 JSON 对象**里补这些字段：
"memory": ≤50字纯客观事实概括本轮（谁在何处做了什么、花了多少、得了什么），玩家角色一律称"@主角.名"，不用"你/我/玩家"；无足记的琐事（纯环顾、纯赶路且路上无事）可省略。
"mentionedNewNpcs": 数组，填叙事里被提到姓名、但此刻不在场的**新**具名人物；在场的、已出现过的不算，没有就省略。
"duelRequest": 仅本轮玩家明确向在场 NPC 发起切磋且对方应允、双方摆开架势时，填该 NPC 名（字符串）；本轮在场 NPC 仅限：@{在场NPC}。对方拒绝或躲避、玩家拒绝、仅谈论打斗时，必须省略。

【mvu 字段的路径规矩】若输出 mvu：路径只能用 角色 / 世界 / 主角 三个前缀；好感度写 角色.<姓名>.好感度，全局声望写 世界.威望。**世界.旁白.\* 是系统维护的剧情进度与门禁，写其任何子键都会被丢弃。**剧情推进由系统判定，不由叙事或提取决定。`, { playerFallback: "主角", npcSeparator: "、" });
}

// 各意图对应的提取 prompt 工厂。
// narrative: 主调用输出的叙事正文
export const EXTRACTION_SPECS = {

  META_QUERY: null, // 元问题无需提取状态

  LOOK: {
    system: "你是游戏状态提取器，只做结构化提取，不添加叙事里没有描述到的内容。",
    user: (_narrative, _state, _settle, render) =>
      render(`当前场景：@room.name，NPCs：@房间.全员，物品：@地上物品
出口固定（不能改变）：[@房间.出口]

叙事内容：
@narrative

根据叙事，输出场景状态更新 JSON（只包含叙事中实际变化的内容，exits 必须原样保持 [@房间.出口]，无变化则输出 {}）：
{"room":{"desc":"≤80字场景描述","exits":[@房间.出口示例],"npcs":[{"name":"","id":"id","brief":"≤15字"}],"items":[{"name":"","id":"id"}]}}`, { itemSeparator: "、" }),
  },

  MOVE: {
    scaleFields: [FIELD.inv],
    system: "你是游戏状态提取器，只做结构化提取，不添加叙事里没有描述到的内容。",
    user: (_narrative, s, _settle, render) => {
      const exits = s.lockedExits ? Object.keys(s.lockedExits) : s.room.exits;
      const dest = s.lockedDestName || s.room.name;
      // 拾取提取分两种，都走提取模型读名、绝不再用正则抠：
      // ① 系统本轮掷中拾取(pj 有值)：品质/分类照裁决值写，模型只负责读出叙事里那件
      //    东西的名字。② 系统没掷中(pj 为空)：但 AI 说书时可能自己在散文里编了"捡到
      //    XX"——也让模型把它读出来产到 items_add，品质留给系统事后补掷(rollQuality)
      //    覆盖。两种情况都尊重叙事：叙事说没捡(被盯着/险境)就留空数组，不硬塞。
      const pj = s.pickupJudgment;
      const pickupBlock = pj ? `

【本轮拾取提取·重要】系统已裁决本次移动途中可能捡到一件物品（品质「${pj.quality}」、分类「${pj.category}」）。通读叙事判断玩家有没有捡到：
· 叙事写了捡到/拾得/收入怀中某物 → 在 delta.items_add 里加一件，name 精确取叙事里那件东西的名字（贴合原文，不用"路遇之物"这类占位名），quality 写"${pj.quality}"，category 写"${pj.category}"。
· 叙事明确说没捡（被人盯着、身处险境等）→ delta.items_add 留空数组 []，尊重叙事不硬塞。` : `

【拾取提取】本轮系统未预设拾取，但仍要通读叙事：若 AI 说书时自行写了玩家捡到/拾得/收入怀中某物，就在 delta.items_add 里加一件，name 取叙事里那件东西的名字（贴合原文，不用"路遇之物"这类占位名），category 按物品性质填 weapon/armor/accessory/misc，quality 先写"白"（真实品质由系统事后裁决）。叙事没提捡东西就留空数组 []。`;
      return render(`玩家到达新地点：@room.name（由系统固定，不能修改）
固定出口：[@房间.出口]（不能修改）

叙事内容：
@narrative
@pickupBlock

输出新场景 JSON（name 必须是"@room.name"，exits 必须是 [@房间.出口示例]；delta.items_add 按上面【拾取提取】规则填，无拾取则空数组）：
{"room":{"name":"@room.name","desc":"≤80字场景描述","exits":[@房间.出口示例],"npcs":[{"name":"","id":"id","brief":"≤15字"}],"items":[{"name":"","id":"id"}]},"delta":{"items_add":[]}}`, {}, { room: { name: dest, exits }, pickupBlock });
    },
  },

  // 对话模式的提取。0727 起「◎ 对话」模式也走这份 spec（此前 talk 强制
  // intent=UNKNOWN，提取就掉进 UNKNOWN 那份全量 spec 要 room+char+delta+mvu 全套，
  // 而这份专为对话写的轻 spec 反而只有"行动模式自由输入命中对话正则"时才用得上——
  // 注入侧早就分了 talk 档，提取侧却没分，一边减了一边没减）。
  //
  // 物品往来：对话轮不挂物件志，改把两个合法来源直接摆给提取模型看——玩家背包、
  // 在场各人的〔身携〕。凭空冒出来的东西一律不收，避免"叙事随口一提就真进背包"。
  // respondedNpcs：双调用下主叙事只产散文，这个字段此前没有任何 spec 要过，于是
  // commitRound 那条"对话即认识"只剩 talkTarget 兜底——点「全部」聊天谁都不会被
  // 标记认识。放在这里要，正好补上。
  TALK_CASUAL: {
    scaleFields: [FIELD.affection, FIELD.inv, FIELD.flags],
    system: "你是游戏状态提取器，从叙事中提取 NPC 互动产生的状态变化（好感度、物品交换、谁开口回应了）。只提取叙事里确实写到的内容，不添加、不脑补。",
    user: (_narrative, state, _settle, render) => {
      // 在场者性情/界限进判定上下文（聊天语义好感）：对方性情与好感门槛
      // 是该不该动好感的判据；不通人情（forbidden）与兽类无好感轨道。
      const npcs = getPresentNpcs(state || {});
      const lines = npcs.map((npc) => {
        // 同名驻场不能借 OC 的界限——只有带 OC 实例标记的才查 OC 表，
        // 否则驻场姬无双会误用 OC 姬无双的阈值（正确性见 isOcNpc 同款规则）。
        const oc = npc.ocAdventurer ? (OC_BY_NAME[npc.ocAdventurer] || OC_BY_NAME[npc.name]) : null;
        const spec = { ...(oc?.intimacy || {}), ...(npc.intimacy || {}) };
        if (spec.forbidden || npc.beast) return `- ${npc.name}：不通人情，好感永不变化`;
        const pers = [npc.personality, npc.brief].filter(Boolean).join("·").slice(0, 60);
        const gate = intimacyGate({ ...oc, ...npc }, Number(state?.varTree?.角色?.[npc.name]?.好感度) || 0);
        const style = spec.style ? `，亲密画风「${spec.style}」` : "";
        return `- ${npc.name}：${pers || "性情不明"}${style}，好感界限 ${gate.threshold}${gate.unlocked ? "（已过线）" : ""}`;
      }).join("\n");
      return render(`当前 NPC 关系：@角色关系
在场人物与其随身之物：
@房间.全员随身
玩家背包：@背包
${lines ? `
在场者性情与界限：
${lines}
` : ""}${state?.cmd ? `
玩家这轮说的话：${state.cmd}
` : ""}
叙事内容：
@narrative

根据叙事输出状态变化 JSON：
{"mvu":"_.add('角色.XXX.好感度', N);\n","delta":{"items_add":[],"items_rm":[],"flags_add":[]},"respondedNpcs":["名字"]}

· mvu：叙事里某人对玩家的观感确有变化才写，没变化就省略。好感增减照对方性情与界限裁量——夸到点子上、冒犯到痛处才有感；单次区间 -5~+8，闲聊寒暄不动笔。标注不通人情/兽类的人不写好感度。
· delta：只记叙事写明当场易手的东西——对方给玩家的写 items_add，玩家给出去的写 items_rm。物品只能出自上面列的"玩家背包"或那位 NPC 的〔身携〕；〔身无长物〕的人给不出东西，叙事写了也不记。只是嘴上提起、许诺日后再给、纯寒暄，一律不记。
· respondedNpcs：本轮正文里【真正开口跟玩家说话或有来有往互动】的在场 NPC 名字。只是被提到、路过、在场却没搭理的不算。没人开口就给空数组 []。
· 全都没有变化时输出 {}。`);
    },
  },

  // 送礼已由系统交付，提取层只判断收礼人好感。
  GIFT: {
    scaleFields: [FIELD.affection],
    system: "你是游戏状态提取器，专门处理送礼场景的好感度结算，遵守系统给定的分量和好感区间。",
    user: (narrative, s, settleOpts, render) => {
      const info = settleOpts?.giftInfo || {};
      if (info.weight) {
        const npcName = settleOpts.settleNpc;
        const example = info.weight.range.at(0);
        return render(`@settleNpc 已收到系统交付的「@giftInfo.itemName」。分量：@{赠礼.分量}。反应：@赠礼.反应。

叙事内容：
@narrative

只允许对收礼者 _.add 一次好感，整数范围 @赠礼.好感范围；收下必写区间内正向增量，不得省略或为零。礼物已扣除，不重复写入物品或银两变动。
输出 JSON：{"mvu":"_.add('角色.${npcName}.好感度', ${example});"}`, {}, settleOpts)
          + (info.preferLabel ? ` ${settleOpts.settleNpc}平日偏爱「${info.preferLabel}」一类物件；若这份礼正是该类，好感取区间上沿。` : "");
      }
      const [lo, hi] = info.range || giftRange(info.quality);
      const suggested = info.suggestedDelta ?? Math.round((lo + hi) / 2);
      return `${settleOpts?.settleNpc || "对方"}刚收到玩家赠送的礼物：${info.itemName ? `「${info.itemName}」` : "一件物品"}，品阶【${info.quality || "白"}】${info.categoryLabel ? `，类别「${info.categoryLabel}」` : ""}${info.desc ? `。物件描述：${info.desc}` : ""}${info.preferLabel ? `。对方平日偏爱「${info.preferLabel}」一类物件` : ""}

叙事内容：
${narrative}

【铁律】不管叙事写得含蓄还是热络，送礼这一轮${settleOpts?.settleNpc || "对方"}对玩家的好感度只能上升、不得为0或负数——按品阶与来历，建议幅度 +${lo}~+${hi}（贵重取上沿，寻常取下沿${info.preferLabel && info.categoryLabel === info.preferLabel ? "；这份礼正是他偏好的类别，取上沿" : ""}）。物品交换写进 delta（礼物已由系统扣除，不需重复处理 items_rm）。
输出 JSON（mvu 字段必须是一条正向 _.add 好感度指令）：
{"mvu":"_.add('角色.${settleOpts?.settleNpc || "XXX"}.好感度', ${suggested});\n","delta":{"items_add":[],"flags_add":[]}}`;
    },
  },

  // 伙伴入队专属提取——刚结为同行的伙伴，不是从0慢慢培养的陌生关系，所以
  // 不用 _.add 微调而是直接 _.set 一个较高的初始好感度。跟 GIFT
  // 一样不做"读心"式判断，直接钉死结论。settleOpts 由调用方在命中
  // settleKind:"companion_invite" 时传入（见 MudRPG.jsx handleInviteCompanion）。
  // settleBeast 区分兽类/人类伙伴：兽类不通人言（cannotSpeak），人类正常说话；
  // 雪豹、珍珠这类 humanForm 伙伴认主即化为人形成年女子，能说话。
  COMPANION_INVITE: {
    scaleFields: [FIELD.affection],
    system: "你是游戏状态提取器，专门处理伙伴入队场景的好感度结算——伙伴刚接受邀请结为同行，好感度应直接给一个较高的初始值，不做\"读心\"式判断。",
    user: (narrative, s, settleOpts) => {
      const npcName = settleOpts?.settleNpc || "伙伴";
      const speech = isHumanFormCompanion(npcName)
        ? `她认主这一刻化为人形（${ADULT_HUMAN_FORM}），化形后能开口说话。`
        : settleOpts?.settleBeast
        ? "它不通人言（cannotSpeak），情感全靠动作、眼神、姿态传达。"
        : "它能正常开口说话。";
      return `${npcName}刚接受了玩家的邀请，正式结为同行伙伴——玩家郑重相邀、对方欣然应下，${npcName}就此定下同行情谊。${speech}

叙事内容：
${narrative}

【铁律】不管叙事写得含蓄还是热络，这一轮${npcName}对玩家的好感度应直接设为较高初始值（${AFFECTION_RULES.companion.min}~${AFFECTION_RULES.companion.max}，体现"刚结伴、一见如故"而非从零培养），不得低于${AFFECTION_RULES.companion.floor}。
输出 JSON（mvu 字段必须是一条 _.set 好感度指令，用 set 不用 add——初次登场，不是在已有基础上增减）：
{"mvu":"_.set('角色.${npcName}.好感度', ${AFFECTION_RULES.companion.example});\n","delta":{"items_add":[],"flags_add":[]}}`;
    },
  },

  // 拜师专属提取——跟 GIFT/COMPANION_INVITE 同一路数：不"读心"倒推，直接钉死结论。
  // 拜师这件事在系统层面已经全部结算完（好感门槛过了、束脩扣了、招式进武学栏了），
  // 走到这一步就意味着"对方认可你、愿意把压箱底的东西给你"——这在江湖里是极重的
  // 情分，好感度只可能往上走。此前拜师压根没传 settleKind，于是落到通用 spec 去
  // 让小模型从散文里猜"这轮好感变没变"，结果基本猜不出来，表现为"拜完师好感纹丝不动"。
  LEARN_SKILL: {
    scaleFields: [FIELD.affection],
    system: "你是游戏状态提取器，专门处理拜师学艺场景的好感度结算——授业传艺是江湖里极重的情分，好感度只能往上走，不做\"读心\"式判断。",
    user: (narrative, s, settleOpts) => {
      const npcName = settleOpts?.settleNpc || "师父";
      const info = settleOpts?.learnInfo || {};
      // 授平生绝学(isMaster) 比随手指点几手通用功夫情分重，幅度分档。
      const [lo, hi, suggested] = learnRange(info.isMaster);

      return `${npcName}刚刚收玩家为徒，${info.isMaster ? "将自己的看家绝学" : "把几手江湖基本功"}「${info.moveBrief || "所学"}」倾囊相授${info.totalPrice ? `，玩家奉上束脩银${info.totalPrice}两` : "，分文未取"}。

叙事内容：
${narrative}

【铁律】不管叙事写得含蓄还是热络，拜师这一轮${npcName}对玩家的好感度只能上升、不得为0或负数——肯传本事本身就是认可与托付。建议幅度 +${lo}~+${hi}（${info.isMaster ? "所授是压箱底的绝学，取上沿" : "所授是通用功夫，取下沿"}）。招式与束脩均已由系统结算，不要重复处理 delta。
输出 JSON（mvu 字段必须是一条正向 _.add 好感度指令）：
{"mvu":"_.add('角色.${npcName}.好感度', ${suggested});\n","delta":{"items_add":[],"flags_add":[]}}`;
    },
  },

  APPEASE: { ...APPEASE_EXTRACTION_SPEC, scaleFields: [FIELD.affection] },

  EXPLORE_ACTION: {
    scaleFields: [FIELD.affection, FIELD.inv, FIELD.flags],
    system: "你是游戏状态提取器，从叙事中提取探索/调查行动产生的状态变化。",
    user: (_narrative, _state, _settle, render) =>
      render(`当前场景：@room.name，背包：@背包

叙事内容：
@narrative

根据叙事，输出变化 JSON（只包含实际变化的字段，无变化输出 {}）：
{"room":{"npcs":[{"name":"","id":"id","brief":"≤15字"}],"items":[{"name":"","id":"id"}]},"delta":{"items_add":[{"name":"","category":"misc","quality":"白"}],"flags_add":[]},"mvu":"_.add('角色.XXX.好感度', N);\n"}`),
  },

  COMBAT: {
    scaleFields: [FIELD.hp, FIELD.affection, FIELD.inv, "exp", "pot"],
    system: "你是游戏状态提取器，从叙事中提取战斗结果（HP 变化、掉落、经验等）。",
    user: (_narrative, _state, _settle, render) =>
      render(`当前状态：HP=@气血，背包：@背包

叙事内容：
@narrative

根据叙事，输出战斗结果 JSON（hp 是 [当前值, 最大值]；无变化的字段省略；无变化输出 {}）：
{"char":{"hp":[当前,最大值]},"delta":{"items_add":[{"name":"","category":"misc","quality":"白"}],"items_rm":[],"exp":0,"pot":0},"mvu":""}
mvu 字段留空即可，除非叙事里**明确写出**某个 NPC 因这场战斗对玩家的观感发生具体变化（如"她被这份身手镇住"）——只有这种情况才补一条 _.add('角色.姓名.好感度', N)（按情节合理给正或负）。围观/搭话本身不构成好感变化，对手只是路人也不必强给；别把"这是一场战斗"当成"必须改某人好感"的默认规则。`),
  },

  UNKNOWN: {
    scaleFields: [FIELD.hp, FIELD.money, FIELD.affection, FIELD.reputation, FIELD.inv, FIELD.flags, "exp", "pot"],
    system: "你是游戏状态提取器，从叙事中提取所有发生变化的游戏状态。",
    user: (_narrative, _state, _settle, render) =>
      render(`当前状态：场景=@room.name，HP=@气血，背包=@背包，NPC 关系=@角色关系，随身银两=@{char.money}两

叙事内容：
@narrative

根据叙事，输出所有变化的 JSON（只包含实际变化的字段，未变化的省略，无变化输出 {}）：
{"room":{"desc":"","npcs":[],"items":[]},"char":{"hp":[当前,最大值],"money":结算后余额},"delta":{"items_add":[],"items_rm":[],"exp":0,"pot":0,"flags_add":[]},"mvu":"_.add(...);\n"}
若随身银两确有变化，char.money 填上面余额加上实际收支后的总额，不填本次收支额；不清楚余额或收支金额时省略。`),
  },
};

export function renderExtractionSpec(spec, narrative, state, settleOpts, trace) {
  const render = (template, options, overrides) => renderPromptTemplate(template, {
    ...state, narrative, ...overrides,
    promptRefOptions: { inventoryNames: true, inventorySeparator: "，", emptyInventory: "空", ...options },
  }, { trace }).text;
  const scaleFields = spec === EXTRACTION_SPECS.GIFT && settleOpts?.giftInfo?.weight ? [] : spec.scaleFields;
  return spec.user(narrative, state, settleOpts, render) + commonExtractTail(render)
    + renderFieldScales(scaleFields || [], state, trace);
}
