// WO-12 前哨快调用 turn.intake：玩家一句话落定后、主叙事开庭前，
// 先用轻量小模型把这句话拆成契约 B 的扁平结构化听意单（read/refIds/actions/proposals）。
// 本模块只负责注册调用定义与组装喂料；判官裁决在 domain/rules/judge/judgeTurn.js，
// 主循环接线属 WO-13，此处不接。
import { definePrompt } from "../../domain/rules/prompt/registry.js";
import { INTAKE_JSON_SCHEMA } from "../../domain/rules/judge/intakeSchema.js";
import { validateJsonSchema } from "../../utils/schemaValidate.js";
import { splitCompositeInput } from "../../domain/rules/input/compositeInput.js";
import { visibleInnerExits } from "../../domain/rules/map/innerMap.js";
import { QUCUO_MAP, isNodeUnlocked } from "../../domain/data/map/qucuoMap.js";

// 组装喂给小模型的现场材料（纯函数）：
//   最近两轮对话 + 在场角色与随身物 ID + 可引用场记板条目头。
// 条目头只给【id】+ publicText 前 40 字，小模型只需选 ID 不需读全文。
// WO-16G PR-G1 喂料扩展：拆句 hints、可用出口（锁/内层过滤）、可赠/可用/可拾/可穿戴
// 四张物件清单统一 `名字(编号)`。runTurn 与 shadowJudge 都调这一个入口——
// 清单口径只此一份，不得在两处各写一份。
// 不喂银两：WO-16D 审计实证仓内没有独立玩家钱币状态，roadmap 模板里的
// 「赠予默认银两」是偏差口径，钱数事由判官 CHANGE_VITALS_SILVER 管。
export function buildIntakeUserContent({
  playerInput, recentTurns = [], npcs = [], entries = [], questCandidates = [], containers = [],
  room = null, innerRoomName = null, questProgress = {}, flags = [], inv = [], char = {}, varTree = {},
  prepBlock = "",
} = {}) {
  const lines = [];
  lines.push(`玩家这句话：「${playerInput || ""}」`);
  // 拆句 hints：借 compositeInput 现有切段口径，只做提示不物理分流
  const segments = splitCompositeInput(playerInput);
  lines.push(`[拆句提示] ${segments.length > 1 ? segments.map((seg) => `「${seg}」`).join("、") : "无"}`);
  // 可用出口：内层房间用 visibleInnerExits（未解锁隐藏方向不出现）；
  // 外层据点按 QUCUO_MAP[room.name].exits 列，解锁过滤与 outerMove 同走 isNodeUnlocked。
  const unlockCtx = { questProgress, flags, inv, char, varTree };
  let exitMap = {};
  if (room?.name && innerRoomName) {
    exitMap = visibleInnerExits(room.name, innerRoomName, unlockCtx);
  } else if (room?.name && QUCUO_MAP[room.name]?.exits) {
    // WO-16G-G2 口径统一：外层出口解锁直接走玩家真实移动判定 isNodeUnlocked
    // （engine/act/outerMove.js 同一入口），completedQuests 推导口径与 outerMove 逐字相同。
    // 不再借道 isInnerExitUnlocked 平行实现——两者对 favor/钥匙锁等扩展类型的分歧
    // 会让前哨喂的「可用出口」与玩家实际走法静默分叉。注意 isNodeUnlocked 对
    // 未知 condition type 返回 true（默认放行），与内层口径相反；外层节点现状
    // 只用 flag/questCompleted/anyFlag 三种（qucuoMap.js 实证），暂无影响。
    const completedQuests = new Set(Object.entries(questProgress || {}).filter(([, p]) => p?.status === "completed" || p?.done).map(([id]) => id));
    for (const [dir, dest] of Object.entries(QUCUO_MAP[room.name].exits)) {
      if (!isNodeUnlocked(dest, { completedQuests, flags })) continue;
      exitMap[dir] = dest;
    }
  }
  const DIR_LABEL = { n: "北", s: "南", e: "东", w: "西" };
  const exitsText = Object.entries(exitMap).map(([dir, dest]) => `${dir}(${DIR_LABEL[dir] || dir}→${dest})`).join("、");
  lines.push(`[可用出口] ${exitsText || "无"}`);
  const renderItems = (list) => (list || []).filter((it) => it && it.name)
    .map((it) => `${it.name}(${it.id || "无ID"})`).join("、");
  // 四张物件清单（同源口径）：
  //   赠予=背包未装备物件；使用=带 consumable 形状的消耗品；
  //   拾取=地上陈设（room.items）；穿戴卸下=weapon/armor/accessory（已装备的标〔已装备〕）。
  const invList = (inv || []).filter((it) => it && typeof it === "object" && it.name);
  const giftItems = invList.filter((it) => !it.equipped);
  const useItems = invList.filter((it) => it.consumable);
  const equipItems = invList.filter((it) => ["weapon", "armor", "accessory"].includes(it.category));
  const groundItems = (room?.items || []).filter((it) => it && it.name);
  lines.push("[可用物件]");
  lines.push(`· 赠予：${renderItems(giftItems) || "无"}`);
  lines.push(`· 使用：${renderItems(useItems) || "无"}`);
  lines.push(`· 拾取：${renderItems(groundItems) || "无"}`);
  lines.push(`· 穿戴卸下：${equipItems.length ? equipItems.map((it) => `${it.name}(${it.id || "无ID"})${it.equipped ? "〔已装备〕" : ""}`).join("、") : "无"}`);
  // WO-24D：备料素材参考（自带非事实警示块头），空串零注入
  if (prepBlock) lines.push(prepBlock);
  if (recentTurns.length) {
    lines.push("最近两轮对话：");
    for (const turn of recentTurns.slice(-2)) {
      lines.push(`[玩家] ${String(turn?.user || "").slice(0, 80)}\n[引擎] ${String(turn?.engine || "").slice(0, 80)}`);
    }
  }
  if (npcs.length) {
    lines.push("在场角色与随身物：");
    for (const npc of npcs) {
      const carried = (npc.carriedItems || []).filter((it) => it && !it.stolen)
        .map((it) => `${it.name}(${it.id || "无ID"})`).join("、");
      lines.push(`· ${npc.name}${carried ? `〔身携:${carried}〕` : ""}`);
    }
  }
  if (containers.length) {
    lines.push("可翻找容器：" + containers.join("、"));
  }
  if (entries.length) {
    lines.push("可引用场记板条目（只需选 ID）：");
    for (const entry of entries) {
      lines.push(`【${entry.id}】${String(entry.publicText || "").slice(0, 40)}`);
    }
  }
  if (questCandidates.length) {
    lines.push("本回合可推进任务候选（quest_advance 只能从这里挑，禁自编 flag）：");
    for (const c of questCandidates) {
      lines.push(`· 《${c.title}》questId=${c.questId} flag=${c.flag}——${c.stageBrief}`);
    }
    lines.push("玩家这句话若真把某件事说动/做到了位，就在 proposals 里提 {kind:\"quest_advance\",questId,flag,claim,fit}；没到位就不提，宁可少提。");
  }
  lines.push('输出扁平 JSON：read（≤40字拆清代词与意图核心）、refIds、actions、proposals；无则空数组/空串，禁编造不在场的角色与物件。proposals 的 questId/flag 为必填键：非 quest_advance 提议一律填空串。');
  return lines.join("\n");
}

const INTAKE_SYS = "你是《天都·曲措》的前哨听意员。只做一件事：读完现场材料，把玩家这一句话拆成结构化听意单。不写剧情，不解释，不续写，只输出 schema 规定的扁平 JSON。\n\n一、read：不超过 40 字。先写清句中的他、她、它、这东西各指谁，再写玩家想做成什么。\n\n二、refIds：玩家提到「可引用往事」里的某件事，就填那一条的编号；没提就给空数组。\n\n三、actions：按先后顺序，拆出玩家本人此刻要做的事。没有具体动作时，只留一条 free_act。\n· text：抄玩家原话里对应的那一段，一字不改；只有一个动作就抄整句。\n· kind：从十四种里选一种。talk 交谈询问，move 赶路移动，inspect_container 翻找箱柜、尸身、草丛，take 拾取地上之物，give 赠物或送银，trade 买卖议价，steal 偷窃，duel 切磋比试，appease 赔罪道歉，learn 拜师求教，invite 邀人同行，use_item 吃喝敷药等用物，equip 穿戴卸下，free_act 以上都不是的自由行动。\n· target：只能从「在场角色与容器」里抄准确的名字；没点名或不在场，填「无」。\n· item 与 itemId：物件名从清单里选，钱写「银两」；选不出，item 填「无」，itemId 填空串。清单里带括号编号的，比如 霜牙短刀(it_8f3a)，itemId 填括号里的编号。\n· direction：move 时从「可用出口」里选 n、s、e、w；其余一律填 none。\n· condition 与 condition_text：玩家说了「要是、如果、若、万一……就」这类前提时，condition 从 遇敌、到达、被拒、其他 里选一个，condition_text 抄前提原文；没有前提，condition 选「无」，condition_text 填空串。\n· stance：看玩家这句话对对方是什么态度。sincere 诚恳恳切，clever 机敏讨巧，forceful 强硬逼迫但没有恶意，casual 随口平常，perfunctory 敷衍搪塞，hostile 辱骂、讥讽、威胁、当众羞辱。带脏字或存心让对方难堪的，一律选 hostile，不选 casual。\n· outcome：只估这个动作按常理最可能带来哪一种后果，不估数值。从 无、伤损、得财、破费、调息、修习、服用、受寒中毒、醉酒、其他 里选一个；拿不准就选「无」。\n· risk：这个动作本身有多险。闲谈、赶路选「无」；攀崖、夜闯、与人动手选「中」或「高」。\n· confidence：0 到 1 之间。十拿九稳才给 0.95 以上，拿不准就给 0.6 以下。\n\n四、proposals：只有玩家声称找到了某物、发现了线索、促成了一桩交易、借用了环境，或者让某件任务办成了，才填；否则给空数组。\n· claim：玩家声称的那件事，用他自己的话。\n· kind：find_item 找到物件，secret_clue 发现线索，social_deal 促成交易，environment_use 借用环境，quest_advance 推进任务。\n· fit：这话在此时此地有多合情理。natural 顺理成章，stretch 牵强但说得通，absurd 离谱。\n· questId 与 flag：只有 kind 为 quest_advance 时，才从「可推进任务」里原样抄写；其余一律填空串。\n\n五、清单里没有的人、物、容器和任务，一律不许写进 JSON。你只挑选，不创造。";

export function registerIntakeCalls() {
  definePrompt("block", "turn.intake.sys", {
    label: "前哨听意系统指令",
    slot: "sys",
    editable: "engine",
    text: () => INTAKE_SYS,
  });

  definePrompt("block", "turn.intake.user", {
    label: "前哨听意现场材料",
    slot: "user",
    editable: "engine",
    text: (ctx) => ctx.userContent || "",
  });

  definePrompt("call", "turn.intake", {
    group: "sync",
    label: "前哨听意",
    execution: "sync_pipeline",
    route: "light",
    reviewDesc: "契约 B 扁平听意单：关思考 maxTokens 1024（WO-16G roadmap 口径），原生 schema 通道，本地 validateJsonSchema 复核",
    defaultMaxTokens: 1024,
    cfg: (_apiCfg, ctx) => (ctx.cfg ? { ...ctx.cfg, thinkingMode: "off" } : undefined),
    join: "",
    matrixBlocks: ["turn.intake.sys", "turn.intake.user"],
    blocks: ["turn.intake.sys", "turn.intake.user"],
    schema: INTAKE_JSON_SCHEMA,
  });
}

registerIntakeCalls();

// 本地复核：withAI 的原生 schema 校验之外，listen 结果再回验一遍形状。
// WO-16G 修复式复核：先按 schema 键表剥掉模型多填的字段、给 actions 缺省键补默认值，
// 再回验——多填/漏填不再让整张听意单报废；修不好才降级为空单，判官按自由行动处理。
const ACTION_DEFAULTS = {
  kind: "free_act", target: "无", item: "无", itemId: "", direction: "none",
  condition: "无", condition_text: "", stance: "casual",
  outcome: "无", risk: "无", confidence: 0, text: "",
};
const PROPOSAL_KINDS = new Set(["find_item", "secret_clue", "social_deal", "environment_use", "quest_advance"]);
const PROPOSAL_FITS = new Set(["natural", "stretch", "absurd"]);

function repairEntry(entry, defaults) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const out = {};
  for (const key of Object.keys(defaults)) {
    out[key] = key in entry ? entry[key] : defaults[key];
  }
  return out;
}

// proposals 不做默认补全——kind/fit/claim 缺失或非法必须整条丢弃：
// 补成合法 find_item/natural 等于把残缺提议伪造成有效寻宝声称，判官可能虚签事实。
// 只有 questId/flag 允许补缺省空串（strict 全 required 的过渡兼容）。
function repairProposal(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  if (typeof entry.claim !== "string" || !entry.claim.trim()) return null;
  if (!PROPOSAL_KINDS.has(entry.kind)) return null;
  if (!PROPOSAL_FITS.has(entry.fit)) return null;
  return {
    claim: entry.claim,
    kind: entry.kind,
    fit: entry.fit,
    questId: typeof entry.questId === "string" ? entry.questId : "",
    flag: typeof entry.flag === "string" ? entry.flag : "",
  };
}

// WO-16G-G2 三级分流闸门（runTurn 与 shadow 共用唯一来源，不得各写一份）：
// 纯搭话且无任务推进候选时才跳过前哨；有候选时仍调一次 turn.intake——
// 「说动对方/说服推进」通道（proposals.quest_advance）只有模型听意才能产出，
// 本地合成猜不出玩家哪句话真把事说动了，这个成本是有意保留的。
export function shouldSkipIntakeForTalk(isTalk, questCandidates) {
  return !!isTalk && !(questCandidates && questCandidates.length > 0);
}

// S2 补洞：纯搭话本地合成 stance 恒 casual——辱骂/羞辱若跳过前哨会反签 +1 好感。
// 命中敌意提示时不跳前哨，交给模型按 INTAKE_SYS 的 hostile 定义裁定。
// 本正则只做「要不要多听一遍」的提示，绝不直接决定 stance：误报代价只是一次听意调用。
const HOSTILE_HINT = /骂|羞辱|混蛋|废物|畜生|滚|该死|找死|威胁|宰了|杀了你|教训你|无耻|下流|阴险|黑心/;
export function hasHostileHint(text) {
  return HOSTILE_HINT.test(String(text || ""));
}

// WO-16G-G2 三级分流：纯搭话跳过前哨 AI 调用，本地合成听意单直接进纯函数判官。
// 形状与 normalizeIntakeResult 输出完全一致（12 字段全 required），判官无感；
// target 沿用上游 talkTarget 判定，查不出填「无」——judgeTurn 按白名单照常裁小额社交事实。
// confidence:1 是本地占位值——判官当前不消费 confidence，它不表示任何模型确信度。
export function synthesizeTalkIntake(cmd, talkTarget) {
  const text = String(cmd || "");
  return {
    read: text.slice(0, 40),
    refIds: [],
    actions: [{
      ...ACTION_DEFAULTS,
      kind: "talk",
      target: typeof talkTarget === "string" && talkTarget ? talkTarget : "无",
      confidence: 1,
      text,
    }],
    proposals: [],
  };
}

export function normalizeIntakeResult(data) {
  if (!data || typeof data !== "object") {
    return { read: "", refIds: [], actions: [], proposals: [], degraded: true };
  }
  // 修复式净化：只留 schema 声明的键，缺省补默认值
  const clean = {
    read: typeof data.read === "string" ? data.read : "",
    refIds: Array.isArray(data.refIds) ? data.refIds.filter((x) => typeof x === "string") : [],
    // WO-16G-G2 逐条丢弃：单条 action 修不好（如 kind enum 非法）只丢这一条，
    // 不再连坐整张听意单——复合句里其余合法动作照常进判官。
    actions: (Array.isArray(data.actions) ? data.actions : [])
      .map((a) => repairEntry(a, ACTION_DEFAULTS))
      .filter((a) => a && validateJsonSchema(a, INTAKE_JSON_SCHEMA.schema.properties.actions.items).ok),
    proposals: (Array.isArray(data.proposals) ? data.proposals : []).map((x) => repairProposal(x)).filter(Boolean),
  };
  if (!validateJsonSchema(clean, INTAKE_JSON_SCHEMA.schema).ok) {
    return { read: "", refIds: [], actions: [], proposals: [], degraded: true };
  }
  return clean;
}

// ── WO-15 窄过渡补洞：turn.appease 赔罪消气仲裁 ──
// 软结算通道删除后，appease 回合没有任何机制清愤怒（feature 层无前置硬结算）。
// 这不是软结算复活：AI 只做三选一分类，数值（生气解除/+3 好感中值）由系统侧钉死，
// 不可扩展、不注册其他 kind；单调用 JSON 模式不调它（主模型 MVU 尾巴仍能处理），WO-16 统一清。
const APPEASE_OPTIONS = ["奏效", "未奏效", "无法判断"];

export function registerAppeaseCall() {
  definePrompt("block", "turn.appease.sys", {
    label: "赔罪仲裁系统指令",
    slot: "sys",
    editable: "engine",
    text: () => "你是游戏结算仲裁，只回答一道选择题。不写剧情、不解释，严格只输出一行JSON。",
  });
  definePrompt("block", "turn.appease.user", {
    label: "赔罪消气选择题",
    slot: "user",
    editable: "engine",
    text: (ctx) => `${ctx.npc}还在气头上（缘由：${ctx.reason || "未记录"}）。${ctx.attemptText ? `玩家这次说/做的是：「${ctx.attemptText}」。` : `玩家这次尝试赔罪（${ctx.attemptKind || "求和"}）。`}对方性情：${ctx.personality || "寻常"}；当前好感 ${ctx.affection ?? "未知"}。这次言行是否真让他消了气？敷衍、空话、不得体都不算奏效。
选项：${APPEASE_OPTIONS.map((o) => `「${o}」`).join("、")}
输出JSON：{"choice":"选项原文之一"}`,
  });
  definePrompt("call", "turn.appease", {
    group: "sync",
    label: "赔罪消气仲裁",
    execution: "sync_pipeline",
    route: "light",
    reviewDesc: "WO-15 窄过渡：三选一消气裁定，数值由系统钉死，WO-16 统一清",
    tokenLimitKey: "extraction",
    defaultMaxTokens: 256,
    cfg: (_apiCfg, ctx) => (ctx.cfg ? { ...ctx.cfg, thinkingMode: "off" } : undefined),
    join: "",
    matrixBlocks: ["turn.appease.sys", "turn.appease.user"],
    blocks: ["turn.appease.sys", "turn.appease.user"],
    schema: {
      name: "appease_judge",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["choice"],
        properties: { choice: { type: "string", enum: APPEASE_OPTIONS } },
      },
    },
  });
}

registerAppeaseCall();
