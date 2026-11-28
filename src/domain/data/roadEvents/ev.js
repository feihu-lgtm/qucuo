// 路遇事件条目构造器。
//
// ev(id, name, where, seed, opts)
//   id     类别字母 + 两位序号（A01…T20），类别取首字母。
//   where  「|」分隔的地图节点名或地形标签（见 categories.js 的 PLACE_TAGS）。
//   seed   手写情节核：只属于这一件事的人、物、处境，拼进说书人提示词。
//   opts.cast   遇见谁（人物一律从现有池子取，不新造具名人物）：
//               「oc:性别|任[:亲密][:就近势力]」= 人物槽，从游走冒险者池抽（同伴、美人一律走这里）；
//               「势力:身份:性别:年纪」= 身份由事件定，姓名性格由过路人姓名库生成；
//               「传闻」= 从传闻人物里指定；auto = 无固定来人。
//   opts.check  主行动检定的六维（根骨/悟性/体魄/魅力/智谋/身法/气运），null = 不检定必成。
//   opts.dc     难度，默认 6；成功率按 calcDungeonCheckRate(六维, dc)。
//   opts.win    主行动成功的奖励码；opts.lose 失败的代价；opts.alt 次行动的结果。
//   opts.tier   稀有度 1 常见 / 2 少见 / 3 罕见（美人、同伴、紫橙武学多在 2–3）。
//   opts.time   "昼" / "夜" / 缺省不限。
//   opts.when   触发前提，用活世界蓝图（#686）的谓词格式：all / any / not 组合，
//               内置 factionRepGte、factionTensionGte、situationActive、flag、questDone，
//               路遇另补 statGte（六维门槛）、rumorKnown（有传闻人物）、knownEventsHere（本地已有风声）。
//   opts.once   true = 一辈子只遇一次（美人、同伴、名器线索）。
//               主行动奖励含永久六维、武学、同伴、美人、兽伴时自动只遇一次，免得冷却过后反复刷。
//
// 奖励码（「|」分隔，系统解析成判官事实，说书人不得增减）：
//   silver:+30 / silver:-20        银两（CHANGE_VITALS_SILVER）
//   hp:-10                         气血（CHANGE_VITALS_SILVER）
//   item:武器:蓝 / item:护甲:roll / item:饰品:roll+1 / item:杂物:绿
//                                  空白天机券，说书人起名（GRANT_ITEM → compileEmergentItem）
//                                  roll = 按气运掷品阶，roll+1 = 再升一阶（封顶红）
//   skill:峨眉:蓝:成长 / skill:any:roll:独门
//                                  武学天机券（BESTOW_SKILL → compileEmergentSkill）
//   stat:悟性+1                    永久六维（SHIFT_SPECIAL_STAT）
//   exp:+20 / pot:+15              江湖经验、潜能（PROGRESS_CULTIVATION）
//   rep:萨迦世家+6                 势力声誉（applyFactionRep，带涟漪）
//   aff:+10                        与来人好感（MUTATE_SOCIAL）
//   ally                           来人愿意同行：以 imported 人物入场，玩家可「邀同行」入队
//   mate                           美人投缘：同 ally，另钉较高初始好感
//   beast:名字:坐骑|兽伴           兽类伙伴入场，可邀同行
//   cond:风寒:4                    挂状态若干回合（APPLY_CONDITION）
//   clue                           来人捎一条传闻，点到新具名人物（mentionedNewNpcs）
//   pact                           与来人立约（BIND_OR_SETTLE_PACT）
//   scene                          此地场景留下改动（ALTER_WORLD_SCENE）
//   tension:甲/乙+8                两家势力张力（adjustTension）
//   situation:+sit_id / situation:-sit_id   给本据点挂上或撤下一张局势卡（据点局势）
//   trigger:caravan_arrived:medicine        局势卡的化解触发词
const ONCE_REWARD_RE = /(^|\|)(stat:|skill:|beast:|ally(\||$)|mate(\||$))/;

export function ev(id, name, where, seed, opts = {}) {
  return Object.freeze({
    id,
    cat: id[0],
    name,
    where: where.split("|"),
    seed,
    cast: opts.cast || "auto",
    check: opts.check ?? null,
    dc: opts.dc ?? 6,
    win: opts.win || "",
    lose: opts.lose || "",
    alt: opts.alt || "",
    tier: opts.tier || 1,
    time: opts.time || "",
    when: opts.when || null,
    once: Boolean(opts.once) || ONCE_REWARD_RE.test(opts.win || ""),
  });
}
