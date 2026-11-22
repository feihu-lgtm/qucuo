// 百花门客卿晋升（合稿《百花门》7.4）：不设拜师堂、不占主门派槽位，按声誉和主线由兰姐授牌。
// 素梅牌在花3 末尾授予；这里补银梅令（声誉 ≥ 80 且完成花3）与百花尊客（合稿要 ≥ 140，声誉上限 100，按 100 卡，且完成花4）。
const item = (name) => ({ name, fromCatalog: true });
const BH = "百花门";

export default { quest: {
  baihuamen_rank_yinmeiling: {
    id: "baihuamen_rank_yinmeiling",
    type: "QT_TALK",
    localOnly: true,
    title: "花谱·银梅令",
    giver: "兰姐",
    requiresQuestCompleted: "baihuamen_3_shixinyudu",
    requiresFactionRep: { [BH]: 80 },
    description: "兰姐让小蝉关了前厅的门，从妆奁底层取出一枚银梅令：「素梅牌是外花谱的客，银梅令是内花谱的人。收了它，楼里的暗桩认你调遣。」",
    stages: [
      {
        id: "grant",
        requireLocation: { district: "天都镇", inner: "百花楼" },
        playerHint: "去百花楼见兰姐，受银梅令。",
        description: "兰姐把银梅令按在你掌心，指尖凉得像刚碰过井水：「从今往后，百花楼的账本你看得，镇楼的功夫你学得。终局那天，我这一楼的人听你一句话。」",
        completionFlag: "quest_bh_rank_yinmei",
        onReach: {
          items: [item("银梅令")],
          favorability: { "兰姐": 10 },
          flags: ["baihua_yinmei_holder"],
        },
      },
    ],
    rewardText: "银梅令入怀，内花谱上添了你的名字。",
  },
  baihuamen_rank_zunke: {
    id: "baihuamen_rank_zunke",
    type: "QT_TALK",
    localOnly: true,
    title: "花谱·百花尊客",
    giver: "兰姐",
    requiresQuestCompleted: ["baihuamen_rank_yinmeiling", "baihuamen_4_wuxianjiuan"],
    requiresFactionRep: { [BH]: 100 },
    description: "雾隐旧案了结之后，兰姐在百花楼摆了一桌苗家酸汤：「昆明阁的门，十年没给外人开过。今天开给你。」",
    stages: [
      {
        id: "feast",
        requireLocation: { district: "天都镇", inner: "百花楼" },
        playerHint: "去百花楼赴兰姐的酸汤宴，受封百花尊客。",
        description: "花婆、阿芷、苏折柳、小蝉各敬你一碗酒。兰姐最后起身，当众把你的名字用金粉写进花谱头一页：「百花尊客——往后百花门上下，见你如见我。」",
        completionFlag: "quest_bh_rank_zunke",
        onReach: {
          favorability: { "兰姐": 15, "花婆": 10 },
          flags: ["baihua_zunke"],
        },
      },
    ],
    rewardText: "花谱头一页上，你的名字和兰姐并排。",
  },
} };
