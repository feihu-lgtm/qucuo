// WO-25L：雪域三宗扩展包（纯数据，零逻辑）。
// 萨迦世家 / 噶举山人 / 古象雄苯门 三大世袭宗门 + 雪山派 / 喇嘛庙（白塔）雪域生态。
// 覆盖据点：喇嘛庙、白塔、后山平台、雪山派、丹霞城、琼隆古墟。
// 全部势力名/据点名由 validateWorldPacks 静态门禁兜底；核心机制零修改验证。

export const snowlandSectsPack = {
  id: "snowland_sects",

  // ── 6 条世界状态断言 ────────────────────────────────────────────────
  worldStates: [
    {
      id: "ws_sakya_decline",
      label: "萨迦世家威仪受损",
      when: { type: "factionPowerLte", faction: "萨迦世家", value: 40 },
    },
    {
      id: "ws_kagyu_secluded",
      label: "噶举山人封山避世",
      when: { type: "situationActive", id: "sit_snowstorm_seal" },
    },
    {
      id: "ws_bon_rising",
      label: "古象雄苯门香火复兴",
      when: { type: "factionRepGte", faction: "古象雄苯门", value: 40 },
    },
    {
      id: "ws_snowland_tension",
      label: "雪域宗门对峙",
      when: { type: "factionTensionGte", faction: "萨迦世家", value: 70 },
    },
    {
      id: "ws_xueshan_vigilant",
      label: "雪山派枕戈待旦",
      when: { type: "situationActive", id: "sit_wolf_howling" },
    },
    {
      id: "ws_pilgrim_season",
      label: "转山朝圣季",
      when: { not: [{ type: "worldState", id: "ws_kagyu_secluded" }] },
    },
  ],

  // ── 4 条据点覆写 ─────────────────────────────────────────────────────
  districtOverrides: [
    {
      id: "ovr_baita_bon_revived",
      district: "白塔",
      when: ["ws_bon_rising"],
      priority: 8,
      patch: {
        ownerFaction: "古象雄苯门",
        descAppend: "白塔下新煨起桑烟，苯门咒士摇着法鼓绕塔而行，信众比往日多出许多。",
        priceMod: { incense: 0.88 },
      },
    },
    {
      id: "ovr_lama_sakya_shaken",
      district: "喇嘛庙",
      when: ["ws_sakya_decline"],
      priority: 7,
      patch: {
        descAppend: "大殿前的法号声稀落了，萨迦家的执事僧低眉敛目，连施主们都放轻了脚步。",
        priceMod: { all: 0.94 },
      },
    },
    {
      id: "ovr_xueshan_vigilant",
      district: "雪山派",
      when: ["ws_xueshan_vigilant"],
      priority: 6,
      patch: {
        descAppend: "山门前弟子披裘按剑巡夜，雪窝里隐有狼嚎，派中上下枕戈待旦。",
        guardTier: 3,
      },
    },
    {
      id: "ovr_qionglong_bon_dig",
      district: "琼隆古墟",
      when: ["ws_bon_rising"],
      priority: 5,
      patch: {
        descAppend: "古墟残垣间有苯门居士结庐考古，风马旗挂满断墙，比往日添了几分人气。",
        priceMod: { sundries: 1.1 },
      },
    },
  ],

  // ── 6 张短期局势卡 ───────────────────────────────────────────────────
  situations: [
    {
      id: "sit_snowstorm_seal",
      label: "风雪封山",
      durationDays: 4,
      priceMod: { food: 1.25, all: 1.1 },
      promptHint: "暴雪封了山道，往来行旅绝迹，干粮燃料一天比一天金贵。",
      rumorTemplate: "听说{district}那边风雪封了山，鸟儿都飞不过去。",
      factionHint: "噶举山人每逢大雪便封山坐关，这是多少辈传下的规矩。",
      resolveTriggers: ["snowstorm_passed"],
    },
    {
      id: "sit_wolf_howling",
      label: "雪狼下山",
      durationDays: 3,
      priceMod: { medicine: 1.2 },
      promptHint: "饿急了眼的雪狼下山伤人，夜里行路凶险，金疮药紧俏。",
      rumorTemplate: "{district}狼群下山了，猎户都不敢单走夜路。",
      factionHint: "雪山派已放出话来要围猎狼群，正招聚人手。",
      resolveTriggers: ["wolves_hunted"],
    },
    {
      id: "sit_dharma_assembly",
      label: "法会盛况",
      durationDays: 3,
      priceMod: { incense: 1.25, food: 0.9 },
      promptHint: "大法会正盛，远近信众云集，香火纸马供不应求，斋饭倒是管够。",
      rumorTemplate: "{district}正办法会，去听一段经还能蹭顿热斋。",
      factionHint: "萨迦世家主持法会，噶举与苯门也来观礼，三家面上和气底下较劲。",
      resolveTriggers: [],
    },
    {
      id: "sit_bon_exhumation",
      label: "苯门掘藏",
      durationDays: 5,
      priceMod: { sundries: 1.15 },
      promptHint: "苯门在古墟发掘伏藏，出手阔绰收买旧物，什件杂项行情见长。",
      rumorTemplate: "听说苯门在{district}挖出了前朝伏藏，正四处收旧物件。",
      factionHint: "古象雄苯门在寻祖宗埋下的经卷法器，掘藏队出手大方得很。",
      resolveTriggers: ["dig_finished"],
    },
    {
      id: "sit_kagyu_alms",
      label: "噶举施药",
      durationDays: 2,
      priceMod: { medicine: 0.82 },
      promptHint: "噶举山人行医施药，丸散丹膏都比平日便宜，穷苦人排长队。",
      rumorTemplate: "{district}有噶举上师施药，头疼脑热的都去看看。",
      factionHint: "噶举山人下山施药是积德，也是跟萨迦家争信众的心。",
      resolveTriggers: [],
    },
    {
      id: "sit_pilgrim_crowded",
      label: "转山客潮",
      durationDays: 3,
      priceMod: { food: 1.15, incense: 1.1 },
      promptHint: "转山朝圣的人潮到了，食宿香火样样紧俏。",
      rumorTemplate: "转山的人都聚到{district}了，客栈通铺都住满了。",
      factionHint: "转山季三家宗门都想拉拢香客，布施施舍暗中比着来。",
      resolveTriggers: [],
    },
  ],

  // ── 4 支游走编队 ─────────────────────────────────────────────────────
  roamingSquads: [
    {
      id: "sq_sakya_procession",
      name: "萨迦仪仗队",
      faction: "萨迦世家",
      role: "pilgrim",
      route: ["丹霞城", "喇嘛庙", "白塔"],
      members: [],
      combatPower: 48,
      onDefeated: { tensionDelta: 14 },
    },
    {
      id: "sq_kagyu_doctors",
      name: "噶举行医队",
      faction: "噶举山人",
      role: "caravan",
      cargo: "medicine",
      route: ["雪山派", "后山平台", "白塔", "喇嘛庙"],
      members: [],
      combatPower: 35,
      onArrive: { clearSituation: "sit_wolf_howling", boostPower: 2 },
      onDefeated: { tensionDelta: 8 },
    },
    {
      id: "sq_bon_diggers",
      name: "苯门掘藏队",
      faction: "古象雄苯门",
      role: "patrol",
      route: ["白塔", "琼隆古墟", "丹霞城"],
      when: { not: ["ws_snowland_tension"] },
      members: [],
      combatPower: 40,
      onDefeated: { addTargetSituation: ["sit_bon_exhumation"], tensionDelta: 10 },
    },
    {
      id: "sq_xueshan_hunters",
      name: "雪山猎狼队",
      faction: "雪山派",
      role: "patrol",
      route: ["雪山派", "后山平台", "白塔"],
      members: [],
      combatPower: 50,
      onArrive: { clearSituation: "sit_wolf_howling" },
      onDefeated: { tensionDelta: 9 },
    },
  ],

  // ── 人物行为包 ───────────────────────────────────────────────────────
  aiPackages: [
    { id: "ai_lama_monk", prototype: "monk", goals: ["pray", "study", "rest"], healBelow: 0.6, migratePrefer: "temple" },
    { id: "ai_pilgrim", prototype: "pilgrim", goals: ["pray", "roam", "rest"], healBelow: 0.5, migratePrefer: "temple" },
    { id: "ai_digger", prototype: "digger", goals: ["work", "trade", "rest"], healBelow: 0.55, migratePrefer: "ruins" },
  ],
};
