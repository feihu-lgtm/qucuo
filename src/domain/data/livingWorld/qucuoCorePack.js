// WO-25G：曲措首批核心扩展包（纯数据，零逻辑）。
// 围绕主线高活跃区：鱼定村 / 鱼定土司 / 玉泉寨 / 黑风寨 / 打箭炉 / 天都镇。
// 所有 NPC id / 据点名 / 势力名全部来自既有 residentNpcs/npcPool/qucuoMap/factions，
// 由 validateWorldPacks 静态门禁兜底。雪域三宗与巴蜀外地势力归 WO-25L，本包不写。

export const qucuoCorePack = {
  id: "qucuo_core",

  // ── 6 条世界状态断言 ────────────────────────────────────────────────
  worldStates: [
    {
      id: "ws_heifeng_weakened",
      label: "黑风寨元气大伤",
      when: {
        any: [
          { type: "npcStatus", npcId: "resident_basang", in: ["dead", "injured", "recruited"] },
          { type: "factionPowerLte", faction: "黑风寨", value: 35 },
        ],
      },
    },
    {
      id: "ws_heifeng_broken",
      label: "黑风寨树倒猢狲",
      when: { type: "npcStatus", npcId: "resident_basang", in: ["dead", "recruited"] },
    },
    {
      id: "ws_tusi_shaken",
      label: "土司府威势动摇",
      when: { type: "factionPowerLte", faction: "鱼定土司府", value: 40 },
    },
    {
      id: "ws_dajianlu_blockade",
      label: "打箭炉商路吃紧",
      when: { type: "situationActive", id: "sit_road_blockade" },
    },
    {
      id: "ws_yuquan_allied",
      label: "玉泉寨结盟安靖",
      when: { type: "factionRepGte", faction: "玉泉寨", value: 50 },
    },
    {
      id: "ws_chama_revived",
      label: "茶马商路复兴",
      when: { not: [{ type: "worldState", id: "ws_dajianlu_blockade" }] },
    },
  ],

  // ── 4 条据点覆写（Kenshi 式整包切换驻场，不当玩家面闪变）──────────────
  districtOverrides: [
    {
      id: "ovr_yuquan_prosper",
      district: "玉泉寨",
      when: ["ws_heifeng_weakened", "ws_yuquan_allied"],
      priority: 10,
      patch: {
        ownerFaction: "玉泉寨",
        descAppend: "狼曲岸边新起了木栈，寨口不再剑拔弩张，马帮牵着驮牛往来不绝。",
        priceMod: { all: 0.92 },
        guardTier: 2,
      },
    },
    {
      id: "ovr_heifeng_leaderless",
      district: "黑风寨",
      when: ["ws_heifeng_broken"],
      priority: 8,
      patch: {
        descAppend: "聚义厅的虎皮交椅空着，寨丁三三两两蹲在墙根，眼神飘忽没了主心骨。",
        removeResidents: ["resident_basang"],
        guardTier: 0,
      },
    },
    {
      id: "ovr_dajianlu_shut",
      district: "打箭炉",
      when: ["ws_dajianlu_blockade"],
      priority: 6,
      patch: {
        descAppend: "炉城门口商队绝迹，茶包堆在廊下积灰，脚夫蹲在墙根晒太阳等消息。",
        priceMod: { all: 1.12 },
      },
    },
    {
      id: "ovr_tusi_alert",
      district: "鱼定土司",
      when: ["ws_tusi_shaken"],
      priority: 5,
      patch: {
        descAppend: "土司府门前加了双岗，府兵按刀来回巡走，进出人等都要盘问几句。",
        guardTier: 3,
      },
    },
  ],

  // ── 6 张短期局势卡（2-5 天自动到期）─────────────────────────────────
  situations: [
    {
      id: "sit_herb_shortage",
      label: "伤药紧俏",
      durationDays: 3,
      priceMod: { medicine: 1.3 },
      promptHint: "近来山道不靖、伤员增多，铺子里金疮药与草药格外紧俏。",
      rumorTemplate: "听说{district}那边伤药断了顿，一瓶金疮药卖到平日三成高。",
      resolveTriggers: ["caravan_arrived:medicine", "player_donate_herb"],
    },
    {
      id: "sit_tea_horse_fair",
      label: "茶马云集",
      durationDays: 2,
      priceMod: { medicine: 0.9, all: 0.95 },
      promptHint: "茶马帮齐集于此，驮牛满街，各色山货药材都比平日便宜些。",
      rumorTemplate: "{district}正赶茶马云集，南来北往的稀罕物件都能寻着。",
      resolveTriggers: ["caravan_departed"],
    },
    {
      id: "sit_road_blockade",
      label: "山道封锁",
      durationDays: 4,
      priceMod: { all: 1.15 },
      promptHint: "山道被封锁盘查，商路断绝，物价眼见着往上窜。",
      rumorTemplate: "听说{district}的山道叫人封了，进出都要过筛子。",
      resolveTriggers: ["blockade_lifted", "caravan_arrived:any"],
    },
    {
      id: "sit_grain_cheap",
      label: "粮米平价",
      durationDays: 3,
      priceMod: { food: 0.85 },
      promptHint: "新粮入仓，米面价钱落了些，庄户人家眉头舒展。",
      rumorTemplate: "{district}新粮下来了，米价便宜，正好囤些干粮。",
      resolveTriggers: [],
    },
    {
      id: "sit_jianghu_alert",
      label: "江湖戒严",
      durationDays: 2,
      priceMod: {},
      promptHint: "城里戒严盘查，江湖人等都收敛了行迹，入夜街面冷清。",
      rumorTemplate: "{district}戒严了，听说在缉拿什么要紧人物。",
      resolveTriggers: ["alert_lifted"],
    },
    {
      id: "sit_pilgrim_flow",
      label: "香客盈门",
      durationDays: 3,
      priceMod: { incense: 1.2 },
      promptHint: "进香的季节，远近香客络绎不绝，香火纸马供不应求。",
      rumorTemplate: "{district}香会正盛，去拜拜还能赶上一口热乎斋饭。",
      resolveTriggers: [],
    },
  ],

  // ── 4 支游走编队（A-Life 离线步进，与 #685 个人 OC 游走册互补）────────
  roamingSquads: [
    {
      id: "sq_chama_caravan",
      name: "康巴茶马帮",
      faction: "鱼定村",
      role: "caravan",
      cargo: "medicine",
      route: ["打箭炉", "鱼定村", "大草甸", "天都镇"],
      when: { not: ["ws_dajianlu_blockade"] },
      members: ["pool_zhang_shang", "pool_dao_scar"],
      combatPower: 40,
      onArrive: { clearSituation: "sit_herb_shortage", boostPower: 2 },
      onDefeated: { addTargetSituation: "sit_herb_shortage", tensionDelta: 12 },
    },
    {
      id: "sq_tusi_patrol",
      name: "土司府巡山队",
      faction: "鱼定土司府",
      role: "patrol",
      route: ["鱼定土司", "鱼定村", "打箭炉"],
      members: ["pool_awang", "pool_mu_tong"],
      combatPower: 45,
      onDefeated: { tensionDelta: 10 },
    },
    {
      id: "sq_heifeng_raiders",
      name: "黑风寨游骑",
      faction: "黑风寨",
      role: "raider",
      route: ["黑风寨", "玉泉寨", "大草甸"],
      when: { not: ["ws_heifeng_broken"] },
      members: ["pool_da_hu", "pool_young_xia"],
      combatPower: 42,
      onDefeated: { addTargetSituation: "sit_road_blockade", tensionDelta: 12 },
    },
    {
      id: "sq_xueshan_pilgrims",
      name: "雪山弟子游历队",
      faction: "雪山派",
      role: "pilgrim",
      route: ["大草甸", "鱼定村", "喇嘛庙"],
      members: ["pool_shi_sheng", "pool_xi_ban"],
      combatPower: 38,
      onDefeated: { tensionDelta: 8 },
    },
  ],

  // ── 人物行为包原型（Goal/Routine 声明，本批先备底）────────────────────
  aiPackages: [
    { id: "ai_merchant", prototype: "merchant", goals: ["trade", "rest", "rumor"], healBelow: 0.6, migratePrefer: "market" },
    { id: "ai_patrol", prototype: "patrol", goals: ["guard", "patrol", "rest"], healBelow: 0.5, migratePrefer: "post" },
    { id: "ai_ranger", prototype: "ranger", goals: ["roam", "hunt", "rest"], healBelow: 0.5, migratePrefer: "wild" },
    { id: "ai_injured_rest", prototype: "injured_rest", goals: ["heal", "rest"], healBelow: 1.0, migratePrefer: "home" },
  ],
};
