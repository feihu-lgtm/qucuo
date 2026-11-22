// 蛊支2 可选延伸（合稿《五仙教》四.7 第 4 步）：把乌婆婆抄的赤焰压寒方送去雪山派给何雨谢，雪山派声誉 +10。
export default { quest: {
  wuxianjiao_side_2_ext_yaofang: {
    id: "wuxianjiao_side_2_ext_yaofang",
    type: "QT_TALK",
    localOnly: true,
    title: "蛊支2·赤焰压寒方",
    giver: "何雨谢",
    giverId: "resident_heyuxie",
    requiresQuestCompleted: "wuxianjiao_side_2_xueshanhanlu",
    description: "乌婆婆说过，这张赤焰压寒方虽拔不尽三十年的旧创，却能大减何雨谢每逢霜雪的刺骨之痛。",
    stages: [
      {
        id: "deliver",
        requireLocation: { district: "雪山派", inner: "内堂" },
        requiresItems: ["赤焰压寒方"],
        playerHint: "把赤焰压寒方送到雪山派内堂，交给何雨谢。",
        description: "何雨谢展开方子，看见右下角那枚苗家朱印时怔了很久：「当年替我求药的，原来是她……」她把方子收进袖里，咳声比往常轻了些。",
        completionFlag: "quest_wxs2_ext_done",
        onReach: {
          consumeItems: ["赤焰压寒方"],
          factionRep: { 雪山派: 10 },
          favorability: { "何雨谢": 10 },
        },
      },
    ],
    rewardText: "一张苗疆旧方，让雪山的冬天也少了三分冷。",
  },
} };
