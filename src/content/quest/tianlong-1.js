export default { quest: {
  tianlong_1_caodianxueshui: {
    id: "tianlong_1_caodianxueshui",
    type: "QT_TALK",
    title: "天1·草甸血税",
    giver: "厉天行",
    giverId: "resident_litianxing",
    localOnly: true,
    description: "大草甸西口被血刀哨卡封了路。红袍刀客把横刀搁在来人肩上——想进西风隘，先过血刀部这道税关。",
    stages: [
      {
        id: "shaokou",
        requireLocation: { district: "大草甸", inner: "血刀营地" },
        playerHint: "血刀营地的红袍刀客拦住了西去的路。",
        description: "厉天行提着人皮灯笼照你的脸，灯影里一排插在地上的刀还没擦干。血刀部的规矩，过路的要么留财，要么留命——西风隘里的天龙营，就是这么个进门法。",
        completionFlag: ["quest_tian1_hard", "quest_tian1_cold"],
        choices: [
          { flag: "quest_tian1_hard", label: "硬骨——税不交给拦路的死人", resolve: "combat", combatNpc: { name: "血刀哨头·初七", id: "resident_xuedao_chuqi", levelCap: 4 } },
          { flag: "quest_tian1_cold", label: "冷眼——替刀客把牧民轰下道", resolve: "none", narration: "你冷眼按住那对牧民老小的牦牛缰，替刀客把人撵下了草甸。厉天行在灯影后笑出了声：识相。西风隘的路，直走往西。" },
        ],
        onReach: {
          byFlag: {
            quest_tian1_hard: {
              money: 60,
              favorability: { 厉天行: 5 },
              factionRep: { 天龙教: 5, 玉泉寨: 10, 鱼定村: 5 },
              items: [
                { name: "西域止血散", category: "misc", quality: "绿", desc: "血刀部惯用的止血散，铁锈味比药味重。" },
                { name: "西域止血散", category: "misc", quality: "绿" },
              ],
            },
            quest_tian1_cold: {
              money: 120,
              reputation: -10,
              favorability: { 厉天行: 10 },
              factionRep: { 天龙教: 15, 玉泉寨: -15, 鱼定村: -10 },
              items: [
                { name: "血刀通行木牌", category: "misc", quality: "绿", desc: "血刀部发的通行木牌，牌面一道刀刻的深槽，哨卡见了便不拦。" },
              ],
            },
          },
        },
      },
      {
        id: "route",
        giver: null,
        requireLocation: { district: "大草甸" },
        playerHint: "哨卡让开了西去的路——穿过大草甸，西风隘的天龙营就在尽头。",
        description: "隘口亮起了连营的火。无论方才用的是刀口还是冷眼开的路，天龙教那道玄甲栅门，如今朝你开着。",
        completionFlag: "quest_tian1_done",
        onReach: {
          flags: ["tianlong_invited"],
        },
      },
    ],
    rewardText: "西风隘的天龙营已对你开放。营里玄甲军与白衣旧部各据一方——想在哪边挣声名，进门先看路。",
  },
} };
