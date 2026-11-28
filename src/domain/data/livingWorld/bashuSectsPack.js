// WO-25L：巴蜀门派扩展包（纯数据，零逻辑）。
// 青城 / 峨眉 / 唐门 / 五仙 / 天龙 五派 + 锦官城 / 三星派 / 百花门 / 欢喜教 / 丐帮三星分舵。
// 覆盖据点：雅江、锦官城、蜀南唐堡、雾隐寨、广汉、天龙营。
// 全部势力名/据点名由 validateWorldPacks 静态门禁兜底；核心机制零修改验证。

export const bashuSectsPack = {
  id: "bashu_sects",

  // ── 6 条世界状态断言 ────────────────────────────────────────────────
  worldStates: [
    {
      id: "ws_qingcheng_blood",
      label: "青城血案未雪",
      when: { type: "factionTensionGte", faction: "青城派", value: 75 },
    },
    {
      id: "ws_emei_mediation",
      label: "峨眉出面调停",
      when: { type: "factionRepGte", faction: "峨眉派", value: 45 },
    },
    {
      id: "ws_tangmen_poison",
      label: "唐门毒市暗涌",
      when: { type: "situationActive", id: "sit_poison_fair" },
    },
    {
      id: "ws_wuxian_vengeful",
      label: "五仙教蛊怒",
      when: { type: "factionTensionGte", faction: "五仙教", value: 70 },
    },
    {
      id: "ws_tianlong_expanding",
      label: "天龙教势涨",
      when: { type: "factionPowerLte", faction: "青城派", value: 35 },
    },
    {
      id: "ws_jinguan_prosper",
      label: "锦官夜市繁荣",
      when: { not: [{ type: "worldState", id: "ws_qingcheng_blood" }] },
    },
  ],

  // ── 4 条据点覆写 ─────────────────────────────────────────────────────
  districtOverrides: [
    {
      id: "ovr_jinguan_night_market",
      district: "锦官城",
      when: ["ws_jinguan_prosper"],
      priority: 6,
      patch: {
        ownerFaction: "锦官城",
        descAppend: "鬼市灯笼沿河挂出三里地，南来北往的稀罕物什都在夜里出手，吵嚷到五更才散。",
        priceMod: { misc: 0.92 },
      },
    },
    {
      id: "ovr_tangbao_lockdown",
      district: "蜀南唐堡",
      when: ["ws_tangmen_poison"],
      priority: 7,
      patch: {
        descAppend: "唐堡角楼机括声昼夜不息，堡内弟子验毒试药行色匆匆，外人进门都要搜身。",
        guardTier: 3,
        priceMod: { medicine: 1.18 },
      },
    },
    {
      id: "ovr_wuyin_poison_mist",
      district: "雾隐寨",
      when: ["ws_wuxian_vengeful"],
      priority: 7,
      patch: {
        descAppend: "寨口瘴雾比平日浓了三分，五仙教弟子腰挎蛊瓮巡哨，外乡人凑近便被冷眼盯住。",
        guardTier: 2,
        priceMod: { all: 1.12 },
      },
    },
    {
      id: "ovr_tianlongying_muster",
      district: "天龙营",
      when: ["ws_tianlong_expanding"],
      priority: 6,
      patch: {
        descAppend: "营中日夜操练，新入教的信徒排到了辕门外，伙房的炊烟比往日粗了一圈。",
        priceMod: { food: 1.1 },
      },
    },
  ],

  // ── 6 张短期局势卡 ───────────────────────────────────────────────────
  situations: [
    {
      id: "sit_poison_fair",
      label: "毒物暗市",
      durationDays: 3,
      priceMod: { medicine: 1.3, misc: 1.1 },
      promptHint: "毒物暗市开张，药材毒草行情飞涨，懂行的都揣着银钱摸黑去。",
      rumorTemplate: "听说{district}半夜有毒物暗市，唐门的蛇药蝎粉都摆出来了。",
      factionHint: "唐门暗中放货，五仙教也来分一杯羹，两家表面错开时辰实则互探底细。",
      resolveTriggers: ["fair_closed"],
    },
    {
      id: "sit_duel_season",
      label: "论剑之约",
      durationDays: 4,
      priceMod: { all: 1.08 },
      promptHint: "各派弟子论剑在即，城里生面孔多了，酒肆茶楼夜夜满座。",
      rumorTemplate: "{district}要办论剑，青城峨眉的弟子都来了，有热闹瞧。",
      factionHint: "青城派借论剑重振声威，峨眉派做和事佬，天龙教冷眼旁观伺机而动。",
      resolveTriggers: [],
    },
    {
      id: "sit_gu_outbreak",
      label: "蛊患流布",
      durationDays: 4,
      priceMod: { medicine: 1.35 },
      promptHint: "蛊患蔓延，镇上人人心惶惶，解毒药草有价无市。",
      rumorTemplate: "{district}闹蛊了，夜里莫乱走，药铺门口排队都排半条街。",
      factionHint: "五仙教失了控的蛊虫流窜出来，教中长老正挨家收蛊赔罪。",
      resolveTriggers: ["gu_contained"],
    },
    {
      id: "sit_salt_shortage",
      label: "盐路梗阻",
      durationDays: 3,
      priceMod: { food: 1.2 },
      promptHint: "井盐运不进来，食米油盐腾贵，家家户户都在算计。",
      rumorTemplate: "{district}盐价翻了跟头，听说路上不太平。",
      factionHint: "盐道过青城山地界，青城派和天龙教在道上较劲，苦了行商。",
      resolveTriggers: ["salt_arrived"],
    },
    {
      id: "sit_incense_festival",
      label: "庙会赛会",
      durationDays: 2,
      priceMod: { misc: 1.22, food: 0.92 },
      promptHint: "庙会赛会正热闹，香火紧俏、吃食便宜，江湖把式也来赶场。",
      rumorTemplate: "{district}赶庙会，看百戏去，丐帮的花子都在那扎了堆。",
      factionHint: "丐帮三星分舵借庙会收门徒散耳目，百花门的姑娘也来赶会。",
      resolveTriggers: [],
    },
    {
      id: "sil_koxinga_omen",
      label: "铜鼓异鸣",
      durationDays: 5,
      priceMod: { misc: 1.12 },
      promptHint: "古冢铜鼓夜里自鸣，乡人视为异兆，古董什件行情看涨。",
      rumorTemplate: "听说{district}的古铜鼓半夜里自己响了，要出大事咧。",
      factionHint: "三星派对古器异动最上心，已派人来查勘，欢喜教也在暗中窥探。",
      resolveTriggers: [],
    },
  ],

  // ── 5 支游走编队 ─────────────────────────────────────────────────────
  roamingSquads: [
    {
      id: "sq_qingcheng_swords",
      name: "青城执剑队",
      faction: "青城派",
      role: "patrol",
      route: ["雅江", "锦官城", "蜀南唐堡"],
      members: ["pool_dao_ren"],
      combatPower: 52,
      onDefeated: { addTargetSituation: ["sit_salt_shortage"], tensionDelta: 12 },
    },
    {
      id: "sq_emei_mediators",
      name: "峨眉调停团",
      faction: "峨眉派",
      role: "pilgrim",
      route: ["锦官城", "雅江", "雾隐寨"],
      members: ["pool_lai_fang"],
      combatPower: 45,
      onArrive: { boostPower: 2 },
      onDefeated: { tensionDelta: 10 },
    },
    {
      id: "sq_tangmen_runners",
      name: "唐门暗货脚队",
      faction: "唐门",
      role: "caravan",
      cargo: "medicine",
      route: ["蜀南唐堡", "锦官城", "雅江"],
      members: ["pool_hun_hun"],
      combatPower: 46,
      onArrive: { clearSituation: "sit_gu_outbreak" },
      onDefeated: { addTargetSituation: ["sit_poison_fair"], tensionDelta: 12 },
    },
    {
      id: "sq_wuxian_gu_keepers",
      name: "五仙收蛊队",
      faction: "五仙教",
      role: "patrol",
      route: ["雾隐寨", "雅江", "锦官城"],
      members: ["pool_lao_qi"],
      combatPower: 44,
      onArrive: { clearSituation: "sit_gu_outbreak" },
      onDefeated: { addTargetSituation: ["sit_gu_outbreak"], tensionDelta: 10 },
    },
    {
      id: "sq_tianlong_recruiters",
      name: "天龙布道团",
      faction: "天龙教",
      role: "raider",
      route: ["天龙营", "大草甸", "天都镇"],
      members: ["pool_za_shu"],
      combatPower: 48,
      when: { not: ["ws_emei_mediation"] },
      onDefeated: { addTargetSituation: ["sit_duel_season"], tensionDelta: 14 },
    },
  ],

  // ── 人物行为包 ───────────────────────────────────────────────────────
  aiPackages: [
    { id: "ai_sect_disciple", prototype: "disciple", goals: ["train", "patrol", "rest"], healBelow: 0.55, migratePrefer: "sect" },
    { id: "ai_pedlar", prototype: "pedlar", goals: ["trade", "roam", "rumor"], healBelow: 0.5, migratePrefer: "market" },
    { id: "ai_beggar_informant", prototype: "informant", goals: ["rumor", "roam", "rest"], healBelow: 0.5, migratePrefer: "market" },
  ],
};
