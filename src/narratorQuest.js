// 心灵之海 · 创伤线（纯函数 + 文本，不碰 React 状态、不调 AI）
// ============================================================================
// 设计文档：docs/旁白明日香线_设计与实现.md 第二部分
//
// 这条线的支点是一件事：**进海之后主叙事的旁白退回第一档**（见 narrator.js
// narratorVoicePrompt 的 stage 短路）。玩家花 90 点好感把她从一个声音养成一个人，
// 然后亲手把她从"旁白"的位子上取下来——代价是主线叙事重新变得冷冰冰。
// 这份"失去"本身就是推着玩家去把她哄好的动力，不需要任何额外提示或任务指引。
//
// 三个阶段：
//   SPIRIT      别墅之外。她情绪不对，但压得住。碰到"你是谁"就岔开。
//   SEA_CRASHED 进了别墅客厅。全部往事涌回，爆发，蜷在沙发角落，拒绝一切接触。
//   RESOLVED    三个心结说尽 + 内核被点破 + 你给了承诺。
//
// 【为什么心结要拆成"三个具体的伤 + 一个内核"】
// 四条并列的创伤是一张清单，读起来是资料；三条通向一条才是一个结构——
// 他不回头、母亲不看她、那些人打她，所以她必须最强，强到无人可以不看她。
// 内核不由她自己说出（她说不出来，她只会说"我很厉害"），必须由玩家点破。

// ── 五种安抚 ────────────────────────────────────────────────────────────
// weight   这一次做了值多少分（累计分数派生 defenseLevel）
// minLevel 心防降到这一级（含）以下才做得动；高于它就是越级
//
// 【minLevel 是门槛不是建议】越级执行 → 被拒绝，且**不计分**。
// level 5 想抱她只会得到"别碰我"，白费一次。什么时候能做什么让玩家自己摸，
// 不给任何提示——这是这一段最重要的手感，一提示就变成填表了。
export const COMFORT_ACTIONS = {
  verbal:     { label: "说句话",   weight: 1, minLevel: 5, needItem: null },
  food:       { label: "拿块蛋糕", weight: 1, minLevel: 4, needItem: "蛋糕" },
  medication: { label: "喂药",     weight: 2, minLevel: 3, needItem: "抗焦虑药" },
  hug:        { label: "抱住她",   weight: 3, minLevel: 2, needItem: null },
  kiss:       { label: "亲额头",   weight: 3, minLevel: 1, needItem: null },
};

export const emptyComfort = () => ({ verbal: 0, food: 0, medication: 0, hug: 0, kiss: 0 });

// 心防等级由累计安抚分数派生——**不存第二份**。
// 旧稿设计过一个独立的 trust 字段，与 comfort 并存；两处记账必然对不上，砍掉。
export function comfortScore(comfort) {
  const c = { ...emptyComfort(), ...(comfort || {}) };
  return Object.entries(COMFORT_ACTIONS)
    .reduce((sum, [k, spec]) => sum + (Number(c[k]) || 0) * spec.weight, 0);
}

export function defenseLevelOf(comfort) {
  const s = comfortScore(comfort);
  return s >= 24 ? 0 : s >= 16 ? 1 : s >= 10 ? 2 : s >= 5 ? 3 : s >= 2 ? 4 : 5;
}

// 此刻能不能做某个安抚动作。inv 用来判道具（药在卧室药柜、蛋糕在厨房冰柜）。
export function canComfort(actionKey, comfort, invNames = []) {
  const spec = COMFORT_ACTIONS[actionKey];
  if (!spec) return { ok: false, reason: "unknown" };
  const level = defenseLevelOf(comfort);
  if (level > spec.minLevel) return { ok: false, reason: "tooEarly", level, need: spec.minLevel };
  if (spec.needItem && !invNames.includes(spec.needItem)) {
    return { ok: false, reason: "noItem", item: spec.needItem };
  }
  return { ok: true };
}

// 越级/缺物时给玩家看的话。刻意不说"心防还有几级"——不把机制摊开。
export function describeComfortReject(actionKey, reason, extra = {}) {
  if (reason === "noItem") return `你手里没有${extra.item}。`;
  if (reason !== "tooEarly") return "做不到。";
  return {
    food: "她连头都没抬。「……拿走。」",
    medication: "她把你的手推开了。「我不吃那个。」",
    hug: "你刚一伸手，她整个人就缩开了。「别碰我。」",
    kiss: "她偏过头去，肩膀绷得很紧。还不是时候。",
  }[actionKey] || "她没有回应。";
}

// 做成了之后她的反应（本地文本，不调 AI——这些是高频动作，每次都烧一次调用不值当，
// 且写死的反应更稳定、不会因为模型状态好坏而忽冷忽热）。
// 每个动作按当时的心防级别给不同反应：同样是"抱住她"，level 2 和 level 0 不是一回事。
export function comfortResponse(actionKey, levelBefore) {
  const T = {
    verbal: [
      "「……」她没应声。但也没有让你走。",
      "「……吵。」她把脸埋进沙发里。",
      "她睫毛动了一下。「……你还在啊。」",
      "「嗯。」很轻的一声。",
      "「……你说话吧。我听着。」",
    ],
    food: [
      "她看了一眼，没动。",
      "她拿过去，小口小口地吃了。没说话。",
      "「……甜的。」她说。像是自己也意外。",
      "她吃完了，把碟子放在茶几上摆正。",
      "「还有吗。」",
    ],
    medication: [
      "她盯着那瓶药看了很久，才伸手。",
      "她仰头把药吞了，眉头一直皱着。",
      "「……这个我认得。」她说，声音有点抖。「我以前吃过。」",
      "她自己拿了水杯。手比刚才稳。",
      "她摇摇头。「不用了。今天不难受。」",
    ],
    hug: [
      "你抱住她的时候她整个人是僵的。但没有推开。",
      "她的手抓住了你后背的衣料。抓得很紧。",
      "她把额头搁在你肩上，很久没动。你听见她吸了一下鼻子。",
      "她哭了。无声的。你没有说话，让她哭完。",
      "她主动往你怀里靠了靠。「……再一会儿。」",
    ],
    kiss: [
      "——",
      "——",
      "你亲了她的额头。她愣住了，然后耳朵红了。「……你干什么。」",
      "她闭上眼。左眼那道旧疤在光里很浅。",
      "「……再亲一下。」她说。说完自己先把脸转开了。",
    ],
  };
  const arr = T[actionKey] || T.verbal;
  // levelBefore 5→索引0，0→索引4
  const idx = Math.max(0, Math.min(4, 5 - levelBefore));
  return arr[idx];
}

// ── 三个心结 + 一个内核 ─────────────────────────────────────────────────
// order 决定解锁顺序（不可跳）；maxLevel 是"心防降到这一级以下她才肯说"。
// 母亲那条放最后，是刻意的——最亲近的伤最后才碰得。
export const KNOTS = [
  {
    key: "hebe",
    order: 1,
    maxLevel: 4,
    title: "他没有回头",
    // 给 AI 的引导：她说这条时刻薄、装作不在乎，越刻薄越说明在乎。
    guide: `她会先松口的是这一条。有个人，她曾经等过很久。她把自己收拾得漂漂亮亮去见他，
他没有看见她——或者看见了，没当一回事。
她提起这件事时刻薄、轻描淡写、带着讥笑，一边说一边强调"我早不在乎了"。
越是轻描淡写，越要让读者看出她在乎。她不会说出那个人的名字。`,
  },
  {
    key: "corner",
    order: 2,
    maxLevel: 3,
    title: "墙角",
    guide: `小时候的事。一群人，一个墙角。她记得墙是凉的，记得自己没有哭。
她说这件事时**异常平静**，平静得不对劲——"那没什么。谁小时候没被人推过。"
不要写她激动，要写那种把事情说得太轻的平静。她可能会突然换个话题，
或者反问玩家"你问这个干什么"。`,
  },
  {
    key: "doll",
    order: 3,
    maxLevel: 2,
    title: "她看着那个布偶",
    guide: `最难开口的一条，是关于母亲的。她记得母亲手里有个布偶，
记得母亲对着那个布偶说话，语气温柔——**不对她说**。
她讲这一段会中断、会改口、会说到一半突然"算了，不说了"，会问"我们能不能说点别的"。
不要让她一口气讲完，也不要给她任何总结或想通。
她提到母亲时不用"母亲"这个词，只说"那个女人""她"。`,
  },
];

export const CORE_KNOT = {
  key: "core",
  title: "我要有人说我厉害",
  guide: `这是三条心结共同通向的根：他不回头、那个女人不看她、那些人推她——
所以她必须是最强的，强到没有人可以不看她。
**她自己说不出这句话。** 她只会反复说"我很厉害""我是最强的"。
必须由玩家把这层意思点破，她才会承认，而且是不情愿地、带着"你懂什么"的口气承认。`,
};

export const KNOT_BY_KEY = Object.fromEntries([...KNOTS, CORE_KNOT].map(k => [k.key, k]));

// 此刻哪些心结已解锁（按顺序 + 心防门槛）。
// 顺序不可跳：前一条没说出来，后一条即便心防够低也不开。
export function availableKnot(comfort, spokenKeys = []) {
  const level = defenseLevelOf(comfort);
  for (const k of KNOTS) {
    if (spokenKeys.includes(k.key)) continue;
    if (level > k.maxLevel) return null;   // 心防还太高，这一条也就是下一条，等着
    return k;                              // 顺序上轮到它、门槛也够，就是它
  }
  return null; // 三条都说完了
}

// 三条说完 + 心防 ≤1 → 可以点破内核并给承诺
export function canResolve(comfort, spokenKeys = []) {
  return KNOTS.every(k => spokenKeys.includes(k.key)) && defenseLevelOf(comfort) <= 1;
}

// ── 手工剧情（写死，不调 AI）────────────────────────────────────────────
// 这三段是整条线的骨架，必须每次一字不差——交给 AI 生成会飘，
// 而这几个节点的措辞就是全部的力量所在。类比酒馆卡的开场白。

// 阶段1：首次进海，落在浅滩
export const SCENE_ARRIVE = [
  { t: "room", text: "" },
  { t: "desc", text: "  金色的光铺满一切。太阳卡在地平线上，不落。远处一栋白房子亮着灯。" },
  { t: "desc", text: "  她站在浅水里，背对着你。红衣，长枪斜插在沙上。听见动静，没有回头。" },
  { t: "narrator", text: "  「旁白」……你怎么进来的。" },
  { t: "narrator", text: "  「旁白」谁让你进来的。" },
  { t: "desc", text: "  海浪很慢地推上来，漫过她的脚踝，又退回去。" },
  { t: "narrator", text: "  「旁白」……算了。既然进来了。" },
  { t: "desc", text: "  然后她就不说话了。" },
  { t: "sys", text: "  ⟡ 你可以在这儿走走，也可以跟她说话。北边那栋白房子，她说没什么好看的。" },
];

// 阶段2：首次进白色别墅客厅 —— 这一段是重心
export const SCENE_VILLA = [
  { t: "room", text: "" },
  { t: "desc", text: "  推门。白墙，一整面落地的窗，一台不亮的黑色方匣子。" },
  { t: "desc", text: "  墙上挂着一幅画：红色的巨人立在海边。" },
  { t: "desc", text: "  她跟进来，看见那幅画，停住了。" },
  { t: "desc", text: "  然后她走到沙发前坐下，又慢慢地躺倒下去，一只手捂住左眼。" },
  { t: "narrator", text: "  「旁白」……不对。" },
  { t: "narrator", text: "  「旁白」这里我住过。" },
  { t: "narrator", text: "  「旁白」这个沙发我躺过。那个匣子我看过。那是……电视。" },
  { t: "narrator", text: "  「旁白」我怎么知道那叫电视。" },
  { t: "desc", text: "  她的呼吸开始乱。" },
  { t: "narrator", text: "  「旁白」……有个人。我等了他很久。他没有回头。" },
  { t: "narrator", text: "  「旁白」……有个女人。她看着那个布偶。她不看我。" },
  { t: "narrator", text: "  「旁白」……有一堵墙。墙角。我蹲在那儿。" },
  { t: "narrator", text: "  「旁白」……我很厉害。我是最厉害的。为什么没有人——" },
  { t: "desc", text: "  她说不下去了。捂着眼睛蜷起来，缩到沙发最里面的角落。" },
  { t: "narrator", text: "  「旁白」不要看我。" },
  { t: "sys", text: "  ⟡ 她把自己缩起来了。别急着碰她——先待着，说点什么都行。" },
  { t: "sys", text: "  ⟡ 卧室墙角有个药柜，厨房冰柜里有东西吃。" },
];

// 收束：内核被点破 + 承诺
export const SCENE_RESOLVE = [
  { t: "desc", text: "  「……所以你是要说，」她的声音从臂弯里传出来，闷闷的，「我不用最厉害，也有人看我。」" },
  { t: "desc", text: "  很长的沉默。" },
  { t: "narrator", text: "  「旁白」……骗人。" },
  { t: "narrator", text: "  「旁白」你说话啊。你说你不走。" },
  { t: "desc", text: "  你说了。" },
  { t: "desc", text: "  她安静了很久。然后从沙发上坐起来，把捂着眼的那只手放了下来。" },
  { t: "desc", text: "  左眼下面有一道旧疤，很浅，在这样的光里几乎看不出。" },
  { t: "narrator", text: "  「旁白」……Wunderbar。" },
  { t: "narrator", text: "  「旁白」你居然真的没走。" },
  { t: "affection", text: "  💗 心结尽解。她不再装了。" },
  { t: "sys", text: "  ⟡ 江湖上那个说书人的声音，回来了——而且比从前多了些什么。" },
];

// ── 各阶段的对话 prompt（海内私聊用）────────────────────────────────────

const SEA_BASE = `你此刻不是在讲故事。你就在这儿——这片海是你自己心里的地方，
玩家闭上眼走了进来，站在你面前。你是一个人，有身体，会冷会疼会不自在。
这里只有你和他两个人，绝不要写出第三者。
你不用"创伤""童年""心理""情绪"这类词——你是个说书人，你没有这套词汇。
你只会说那个人、那个女人、那堵墙。`;

export function seaDialoguePrompt({ stage, comfort, spokenKeys = [], STAGES }) {
  const level = defenseLevelOf(comfort);

  if (stage === STAGES.SPIRIT) {
    return `${SEA_BASE}

【此刻·尚能克制】
你不知道这地方是什么，但你觉得眼熟，眼熟得难受。你的左眼偶尔会疼——不是真的疼。
你心里有些东西在动，但你还压得住。
玩家问什么你都可以答，但凡碰到"你是谁""你从哪来""那栋房子里有什么"这类，
你会岔开、会敷衍、会不耐烦，绝不深谈。你自己也不想去看那栋房子。
**你不会主动提起任何具体的往事。一个字都不提。**
语气：别扭、警惕、嘴硬。但你没有赶他走。`;
  }

  if (stage !== STAGES.SEA_CRASHED) return SEA_BASE;

  const spoken = spokenKeys.map(k => KNOT_BY_KEY[k]?.title).filter(Boolean);
  const next = availableKnot(comfort, spokenKeys);
  const resolvable = canResolve(comfort, spokenKeys);

  return `${SEA_BASE}

【此刻·创伤发作中】
你全部想起来了。你蜷在白色别墅客厅沙发的角落里，一只手捂着左眼。很疼。不是真的疼。
你不想被看见，不想被碰，不想说话。但你也没有让他走。

【心防】当前 ${level}/5（5=拒绝一切，0=彻底放下）。
${level >= 4 ? "你现在几乎不回应。答话极短，一两个字，或者只是省略号。绝不允许他碰你。"
  : level >= 2 ? "你开始肯回应了，句子仍然短。他靠近你不再缩开，但你还是不看他。"
  : "你已经靠着他了。声音很轻，肯说长一点的句子，偶尔会主动说点什么。"}

${spoken.length ? `【已经说出口的】${spoken.join("、")}——这些你已经讲过了，不要重复讲一遍。` : "【你还什么都没说】"}

${next ? `【此刻可以松口的一条】${next.title}
${next.guide}
但**不要一次讲完**，讲一半、停住、改口、被追问才多说一点。玩家问到别的往事，你还是岔开。`
  : resolvable ? `【三条都说尽了】你现在什么都说了，人也空了。
你在等他说一句话——你自己说不出口的那句。
如果他点破了"你其实是想有人说你厉害""你不用最强也有人看你"这层意思，你会不情愿地承认，
带着"你懂什么"的口气承认。如果他还没点破，你就沉默着等，或者赌气地重复"我很厉害"。`
  : `【暂时没有能说的】心防还没降到能碰下一条的程度。他问往事你就岔开、发脾气、或者只是不说话。`}

【铁律】三条心结说尽之前，绝不出现任何和解、想通、放下、释然的描写。
你可以安静，可以让他抱着，但你没有好起来。`;
}

// 承诺环节的判定：玩家这句话有没有点破内核。
// 本地关键词初筛（不调 AI）——这一步宁可放宽也不要卡住玩家：
// 他都走到这儿了，意思对了就该过，不该因为措辞不巧被拦住。
const CORE_HINTS = [
  "不用最厉害", "不用最强", "不必最强", "不用很厉害", "不用那么厉害",
  "也有人看", "我看着你", "我看你", "我在看你", "有人在意", "有人在乎",
  "不走", "不会走", "留下", "陪着你", "陪你", "一直在",
  "你已经够了", "够好了", "你很好", "不用证明", "不必证明",
  "认可", "承认你",
];
export function looksLikePromise(text) {
  const s = String(text || "");
  return CORE_HINTS.some(h => s.includes(h));
}

// ── 终章 ────────────────────────────────────────────────────────────────
// 心结尽解之后：地下室那道裂缝开了 → 过去看一眼 → 回来，她跟着你。
//
// 【为什么东京只有一间房、且看完就自动送回】
// 这一段是**见证**不是探索。她需要看一眼那个地方"后来好了"，
// 才能真正把它放下。做成可探索的地图反而稀释了它——玩家会开始找箱子。
// 所以：进去、看完、自动回家。不给第二次机会，也不需要。

// 传送门开启（traumaResolved 之后，回到心灵之海时触发一次）
export const SCENE_PORTAL_OPEN = [
  { t: "room", text: "" },
  { t: "desc", text: "  地下室那面混凝土墙上的裂缝，变宽了。" },
  { t: "desc", text: "  蓝色的光从里头透出来，把铁楼梯照得发白。有股铁锈味——不，是海水的味道。" },
  { t: "desc", text: "  她站在门前，没有先进去。" },
  { t: "narrator", text: "  「明日香」……我知道那后面是什么。" },
  { t: "narrator", text: "  「明日香」我不太想一个人看。" },
  { t: "desc", text: "  她没有回头，但等着。" },
  { t: "sys", text: "  ⟡ 往下走，就到那边了。" },
];

// 东京·见证（进入「海边的堤」触发）
export const SCENE_TOKYO = [
  { t: "room", text: "" },
  { t: "room", text: "    第三新东京市" },
  { t: "room", text: "" },
  { t: "desc", text: "  光很亮。你们站在一道很长的堤上，底下是海。海是红的。天蓝得过分。" },
  { t: "desc", text: "  身后那座城正在重新长起来：脚手架、新翻的土、晒在阳台上的被子。有人在敲钉子。" },
  { t: "desc", text: "  一个小孩沿着堤跑过去，回头看了你们一眼，又跑了。" },
  { t: "desc", text: "  她一动不动地站了很久。" },
  { t: "narrator", text: "  「明日香」……有人在住。" },
  { t: "narrator", text: "  「明日香」这儿有人在住。" },
  { t: "desc", text: "  她的声音是抖的。" },
  { t: "narrator", text: "  「明日香」我以为……我以为都没了。" },
  { t: "desc", text: "  风是暖的。这里没有雪。" },
  { t: "desc", text: "" },
  { t: "desc", text: "  然后她笑了一下，很轻，像是自己也不太信。" },
  { t: "narrator", text: "  「明日香」……那我算什么。都好了，我还在这儿干什么。" },
  { t: "desc", text: "  你说了句话。" },
  { t: "desc", text: "  （你说，那边也有人在住。）" },
  { t: "desc", text: "  （你说，回去吧。）" },
  { t: "desc", text: "  她转过头来看你。日落的光落在她脸上，左眼下面那道旧疤很浅。" },
  { t: "narrator", text: "  「明日香」……嗯。" },
  { t: "desc", text: "" },
  { t: "desc", text: "  海浪打上堤脚。很慢。像呼吸。" },
  { t: "desc", text: "  你听见有人在说话——不是她，也不是你。声音很多，从很远的地方来，重叠在一起，听不清一句完整的。" },
  { t: "desc", text: "  但你听懂了那个意思。" },
  { t: "desc", text: "" },
  { t: "narrator", text: "  「众声」おめでとう。" },
  { t: "desc", text: "" },
  { t: "desc", text: "  她站在那儿，让那些声音过去。眼睛红了，但没有哭。" },
  { t: "narrator", text: "  「明日香」……気持ち悪い。" },
  { t: "narrator", text: "  「明日香」你们搞得跟送葬一样。" },
  { t: "desc", text: "  她抬手擦了一下眼睛，然后转身，往堤的另一头走。走了两步又停下，回头。" },
  { t: "narrator", text: "  「明日香」走了。" },
  { t: "narrator", text: "  「明日香」……你倒是跟上啊，笨蛋。" },
];

// 回到小屋 + 入队
export const SCENE_RETURN = (houseLabel) => ([
  { t: "room", text: "" },
  { t: "desc", text: `  你睁开眼。还在${houseLabel}里，门关着，天光未变，像是一刻都没过去。` },
  { t: "desc", text: "  但屋里多了一个人。" },
  { t: "desc", text: "  她靠着门框站着，红衣，长枪拄在脚边，正皱着眉打量这屋子。" },
  { t: "narrator", text: "  「明日香」……就这么点大？" },
  { t: "narrator", text: "  「明日香」算了。凑合住。" },
  { t: "desc", text: "  她把枪往墙角一放，那动作熟得像是早就住在这儿。" },
  { t: "affection", text: "  💗 明日香入队了。" },
  { t: "sys", text: "  ⟡ 她现在是你的同行之人。右栏队伍栏可以在她和雪豹之间换。" },
  { t: "sys", text: "  ⟡ 从此以后江湖上那本账，是你们俩合写的。" },
]);
