// 曲措乡固定拓扑地图
// 对应设计文档第五章的12个据点连通关系。这是一张预先设计好的完整地图，
// 不再由 AI 临场生成新房间——走动只是"逐步揭示"这张已知地图，
// AI 负责在这些固定节点框架内生成具体的场景描述、事件和 NPC 互动，
// 但节点本身、坐标、连通关系是写死的，AI 不能创造新节点或修改连通关系。
//
// 坐标系统：与地图渲染共用的 (x, y) 网格坐标，用于小地图/大地图的节点定位。
// 方向偏移沿用 MudRPG.jsx 里的 DIR_DXY 约定：n[0,-1] s[0,1] e[1,0] w[-1,0] u[-1,-1] d[1,1]

export const QUCUO_MAP = {
  鱼定村: {
    x: 0, y: 0,
    desc: "村口立着一块褪色的界石，写着'曲措乡'三个字。熊曲、鹰曲、狼曲三条溪流在此交汇，水声潺潺。村里炊烟袅袅，几个藏汉杂居的院落错落分布，村民往来其间，操着两种口音。",
    exits: { w: "鱼定土司", n: "喇嘛庙", s: "大草甸", e: "雅江" },
  },
  鱼定土司: {
    x: -1, y: 0,
    desc: "鱼定村正西的世俗权力府邸，高台宅院，檐角挂着风铃。土司本人执掌全乡税赋与地权，府内规矩森严。",
    exits: { e: "鱼定村" },
  },
  喇嘛庙: {
    x: 0, y: -1,
    desc: "依熊曲而建的宗教重地，居高俯瞰鱼定村一带，殿宇间常有诵经声传出，是全乡精神信仰的中心。",
    exits: { s: "鱼定村", n: "白塔" },
  },
  白塔: {
    x: 0, y: -2,
    desc: "半山孤立的古塔遗迹，是喇嘛庙通往雪山深处的必经关口，塔身斑驳，藏传佛教的机关痕迹隐约可见。",
    exits: { s: "喇嘛庙", n: "后山平台" },
  },
  后山平台: {
    x: 0, y: -3,
    desc: "雪山派对外的天然屏障和瞭望台，视野开阔，是进山的最后一道缓冲地带。每年在此举办跑马会。",
    exits: { s: "白塔", n: "顶峰", w: "雪山派" },
  },
  雪山派: {
    x: -1, y: -3,
    desc: "深山隐世的武学门派，自成一统。门内清幽，弟子往来皆是练武修行的痕迹，唯一的出入口系于后山平台。",
    exits: { e: "后山平台", n: "山洞" },
  },
  // ── 第三新东京市（终章一次性据点）──
  // 同心灵之海一样是非常规节点：不接壤、寻路走不到，只能从心灵之海地下室的
  // 传送门进。看完那一段就自动送回玩家自己的屋子，之后不再能回来。
  第三新东京市: {
    x: 99, y: 97,
    desc: "废墟上重新长出来的城。脚手架、新翻的土、晒在阳台上的衣服。远处海是红的，天很蓝。有小孩在跑。",
    exits: {},
    unlockCondition: { type: "flag", flag: "传送门已开" },
  },

  // ── 心灵之海（第三层地图·非常规拓扑节点）──
  // 不与任何据点接壤，findPath 走不到它，也不该出现在寻常大地图上。
  // 唯一进法是站在自己的安全屋里"闭眼再睁眼"（见 seaOfMind.js canEnterSea）。
  // 挂在 QUCUO_MAP 里只是为了让 room 数据、内层箱庭、存档这几套现成机制能直接复用，
  // 坐标给一个远到不可能与任何节点相邻的值，避免被九宫格/寻路误算成邻居。
  心灵之海: {
    x: 99, y: 99,
    desc: "金色的光铺满一切。太阳卡在地平线上，不落。海水是温的，浅得只没过脚踝。远处一栋白色别墅亮着灯。没有风，没有鸟，只有很慢的海浪声，像呼吸。",
    exits: {},
    unlockCondition: { type: "flag", flag: "心灵之海已开" },
  },
  山洞: {
    x: -1, y: -4,
    desc: "贯通雪山派与顶峰的隐秘甬道，幽深潮湿，传闻藏着不为人知的旧物，需要小心探路。",
    exits: { s: "雪山派", e: "顶峰" },
  },
  顶峰: {
    x: 0, y: -4,
    desc: "雪山之巅，终年积雪覆顶，是全乡地势最高、也最少人至的极境，风声呼啸，视野可及乡境全貌。",
    exits: { s: "后山平台", w: "山洞" },
  },
  天都镇: {
    x: 1, y: 1,
    desc: "鹰曲下游的市镇，兼作草甸边缘的补给与歇脚之地，商贩往来，市声嘈杂。",
    exits: { w: "大草甸" },
  },
  大草甸: {
    x: 0, y: 1,
    desc: "夹在鹰曲与狼曲之间的莽莽荒野，地貌开阔、视线通透，是随机遭遇最密集的自由地带。",
    exits: { n: "鱼定村", e: "天都镇", s: "玉泉寨" },
  },
  玉泉寨: {
    x: 0, y: 2,
    desc: "狼曲边上的藏寨，牧民聚落，扼守鱼定村通往贡措海的水路要道，寨中炊烟与牛羊声交织。",
    exits: { n: "大草甸", e: "贡措海", w: "黑风寨" },
  },
  黑风寨: {
    x: -1, y: 2,
    desc: "狼曲上游的一处隐秘山坳，寨门不显眼，藏在灌木遮蔽的羊肠小道尽头。寨内不见杀气，倒像个寻常村子——老人晒草药，妇人纳鞋底，只是寨规写在岩壁上，提醒着这里终究不是玉泉寨。",
    exits: { e: "玉泉寨" },
    // 隐藏据点：常规情况下不出现在玉泉寨的可选方向列表里，需完成黑风寨
    // 任务线"山2·妹妹的消息"（获得"半块银锁片"这件凭证物品）才能被引路
    // 进入（对应总纲设计文档"山3·上山"：持银锁片进入狼曲，寨里的少年
    // 引路）。这里存的是任务id而非flag字符串——因为"半块银锁片"在实际
    // 代码里是通过 items 字段给到玩家背包的物品，不是 flags_add 记录的
    // flag，真正可判断的确定性条件是"这个任务是否已完成"
    // （quest_heifengzhai2_meimeidexiaoxi 对应 questProgress 里的
    // completed 状态，而不是某个 flags 字符串）。
    // unlockCondition 是给 MudRPG.jsx 移动判定读的标记，resolveExit 本身
    // 保持纯查表不做业务判断，两者职责分开。
    unlockCondition: { type: "questCompleted", questId: "heifengzhai_2_meimeidexiaoxi" },
  },
  贡措海: {
    x: 1, y: 2,
    desc: "乡境最远处的水晶湖泊，湖面倒映雪山与林海，是曲措乡地理意义上的终点，湖畔有前辈墓地，宁静而肃穆。",
    exits: { w: "玉泉寨" },
  },
  // 【东西颠倒·已订正】原先摆成 锦官城(-2,1) ← 雅江(-1,1) ← 鱼定村(0,0)，
  // 也就是"往西走才出得了乡"。三处硬矛盾：
  //   ① 雅江自己的描述写着「出西门行三日便是曲措乡界」，可它的 w 出口通向锦官城，
  //      曲措乡反倒在东北方向——同一个文件里自己打自己；
  //   ② 锦官城即成都，在成都平原上；曲措乡是藏地高原（土司、喇嘛庙、牦牛、藏式石楼），
  //      现实里高原在西、平原在东，原摆法整个反了；
  //   ③ 雅江的内层箱庭全是都江堰的地标（宝瓶口、离堆、伏龙观、安澜索桥），
  //      那地方也在成都西北，同样要求锦官城在东。
  // 订正为自西向东：曲措乡(0,0) → 雅江(1,0) → 锦官城(2,0)，出乡即东行。
  雅江: {
    x: 1, y: 0,
    desc: "西蜀锁钥，天府之西最后一座大城。青衣江与岷江在此交汇，终年温润多雨，满城青竹，石板路永远湿漉漉的。出西门行三日便是曲措乡界。",
    exits: { w: "鱼定村", e: "锦官城" },
  },
  广汉: {
    x: 2, y: -1,
    desc: "锦官城北三十里，鸭子河畔。河滩底下三千年前埋着一整个文明的青铜器——面具、神树、纵目人。当地人不在河边夜行，说夜里能听见青铜器在土里响。",
    exits: { s: "锦官城" },
  },
  锦官城: {
    x: 2, y: 0,
    desc: "曲措乡以外的门户，官道在此汇入更大的天下，往来行商、差役川流不息，是全乡与外界联系的唯一正式通道。目前只是一个概念性的乡外占位场景，尚未真正展开。",
    exits: { w: "雅江", n: "广汉" },
  },
};

// 反查：给定一个据点名，返回它的完整节点数据；不存在则返回 null
export function getMapNode(name) {
  return QUCUO_MAP[name] || null;
}

// 返回所有据点名称列表
export function allMapNodes() {
  return Object.keys(QUCUO_MAP);
}

// 检查某个据点的某个方向是否有效出口，返回目的地名称或 null
export function resolveExit(fromName, dir) {
  const node = QUCUO_MAP[fromName];
  if (!node) return null;
  return node.exits[dir] || null;
}

// ⑥ 自动寻路地基：BFS 最短路。只在 allowed 集合内的节点间穿行（默认全图；
// 传入"已探索节点集合"即实现"只能自动走去已知的地方"）。返回方向序列
// ["n","w",...] 或 null（不可达/未探索）。纯函数，不碰状态，供 UI 调度逐步行走。
export function findPath(fromName, toName, allowed = null) {
  if (fromName === toName) return [];
  const ok = (n) => !allowed || allowed.has(n);
  if (!QUCUO_MAP[fromName] || !QUCUO_MAP[toName] || !ok(toName)) return null;
  const queue = [[fromName, []]];
  const seen = new Set([fromName]);
  while (queue.length) {
    const [cur, path] = queue.shift();
    const exits = QUCUO_MAP[cur]?.exits || {};
    for (const [dir, dest] of Object.entries(exits)) {
      if (seen.has(dest) || !ok(dest)) continue;
      const next = [...path, dir];
      if (dest === toName) return next;
      seen.add(dest);
      queue.push([dest, next]);
    }
  }
  return null;
}

// ⑥ 解锁门禁：读节点的 unlockCondition（总纲 10.5 说 resolveExit 本身没读，这里补齐判定）。
// questCompleted 型需外部传入已完成任务集合；flag 型查 flags。无条件的节点默认解锁。
export function isNodeUnlocked(nodeName, { completedQuests = new Set(), flags = [] } = {}) {
  const node = QUCUO_MAP[nodeName];
  if (!node || !node.unlockCondition) return true;
  const c = node.unlockCondition;
  if (c.type === "questCompleted") return completedQuests.has ? completedQuests.has(c.questId) : (completedQuests || []).includes?.(c.questId);
  if (c.type === "flag") return (flags || []).includes(c.flag);
  return true;
}

// ── AI 兜底方向判定（本轮新增）──
// 背景：parseDir 是一套写死的正则，覆盖不了所有口语化的移动表达（"我想去后山逛逛"
// "沿着河边往喇嘛庙那边走"这类）。正则永远列不全，与其不断打补丁加更多分支，
// 不如在正则判不出方向时，加一次轻量的小模型调用兜底——但这次调用严格只回答
// "这句话对应 n/s/e/w/u/d 里哪一个，还是压根不是移动"这一个问题，绝不涉及
// "去了哪个具体据点"，后续依然是系统查 QUCUO_MAP 表来裁决目的地。这跟"AI提议，
// 系统裁决"的核心原则完全一致——AI 只是从"写死的正则"升级成"更聪明的正则"，
// 判断的输出空间还是那几个方向代码，权力边界没有变化。
// 只有正则先判不出来（返回 null）时才会调用这个函数，减少不必要的额外请求。
// 八向全收 + 上下。此前漏了 ne，而 ne 是锦官城**唯一**的出口——即便哪天把这条
// 兜底重新启用，从锦官城也照样出不来（跟 parseDir 那个 return null 是同一个 bug
// 的两个副本）。与 mudHelpers.parseDir 的输出集合保持一致，两边同增同减。
const VALID_DIR_CODES = ["n", "s", "e", "w", "ne", "nw", "se", "sw", "u", "d"];

export function buildDirectionJudgeRequest(cmd, currentRoomName, availableExits) {
  const exitsDesc = Object.entries(availableExits || {})
    .map(([d, destName]) => `${d}→${destName}`)
    .join("，") || "（无已知出口）";
  const system = "你是一个只负责判断移动方向的工具，不负责其他任何事。用户会给你一句游戏内输入，以及当前地点的已知出口方向。你只需判断这句话是不是在表达“往某个方向移动”的意图，如果是，指出是哪个方向；如果不是移动意图（比如查看、交谈、感叹、提问等），或者方向不在已知出口列表里，就说没有方向。只返回下面这些代码之一，不要任何解释、标点或多余文字：n（北）s（南）e（东）w（西）ne（东北）nw（西北）se（东南）sw（西南）u（上）d（下）none（不是移动或方向未知）";
  const messages = [{
    role: "user",
    content: `当前地点：${currentRoomName}\n已知出口：${exitsDesc}\n玩家输入："${cmd}"\n这句话对应哪个方向代码？只回答代码本身。`,
  }];
  return { system, messages, maxTokens: 10 };
}

// 解析小模型返回的原始文本，只接受严格的方向代码，其他一律视为无效（返回 null）。
// 绝不信任任何超出这个白名单的输出——哪怕模型多写了几个字、加了标点、混入了解释性
// 文字，也一律判定无效而不是尝试"模糊提取"，因为一旦做模糊匹配，模型说漏嘴的废话
// 里恰好包含某个方向字母就可能被误判成有效方向（比如提到"west"却不是在报告方向）。
// system prompt 已经明确要求"只返回代码本身"，这里必须严格对应，不做容错兼容。
export function parseDirectionJudgeResponse(rawText) {
  const t = (rawText || "").trim().toLowerCase().replace(/[.。！!，,]+$/, "");
  if (!t || t === "none") return null;
  return VALID_DIR_CODES.includes(t) ? t : null;
}

