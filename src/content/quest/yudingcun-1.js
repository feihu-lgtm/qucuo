// 鱼定村支线（合稿「鱼定村·四、4.2」）：村支1～村支3，新 ID 用 yudingcun_ 前缀；主线村1～村6沿用 yiding-1.js 的 village 旧 ID。
// 合稿里「已踏足锦官城/结识柳青鸢」这类条件引擎还没有对应判定，只按鱼定村声誉与前置任务卡。
// 写明 鱼定土司府: 0 等是为挡住 factionRepDeltas 的对头自动联动（合稿：民生互助、潜行线不扣土司府）。
const c = (name, count = 1) => Array.from({ length: count }, () => ({ name, fromCatalog: true }));

export default { quest: {
  yudingcun_side1_yushan_chuhuan: {
    id: "yudingcun_side1_yushan_chuhuan",
    type: "QT_CHAIN",
    title: "村支1·熊山除患",
    giver: "老猎户",
    requiresFactionRep: { 鱼定村: 0 },
    description: "老猎户桑登说近来熊山脚下有头狂躁的恶熊下山毁田伤人，怀疑是大草甸那边有人惊了山林。",
    stages: [
      {
        id: "s1_track",
        requireLocation: { district: "大草甸", inner: "熊山口" },
        playerHint: "照老猎户教的辨踪诀窍，去大草甸北侧熊山口找恶熊的足迹，把它解决掉。",
        description: "熊山口的雪泥里满是乱踩的熊掌印和被蹭断的灌木。狂熊从坡后冲出，肩头还扎着一支暗红羽尾的断箭。",
        completionFlag: "quest_ydside1_bear",
        choices: [
          { flag: "quest_ydside1_bear", label: "击退失控的狂熊", resolve: "combat", combatNpc: { name: "失控的狂熊", levelCap: 2, hostile: true } },
        ],
        onReach: { exp: 2 },
      },
      {
        id: "s2_report",
        playerHint: "带着断箭和熊掌回猎户小屋向老猎户复命；熊皮分给寒户还是自留，你定。",
        description: "桑登捻着那支暗红羽尾的断箭沉吟：「血刀部的箭……大草甸那帮人越界了。」",
        completionFlag: ["quest_ydside1_share", "quest_ydside1_keep"],
        choices: [
          { flag: "quest_ydside1_share", label: "把熊皮交给鱼定大娘分给寒户", resolve: "none" },
          { flag: "quest_ydside1_keep", label: "熊皮自己留着", resolve: "none" },
        ],
        onReach: {
          exp: 2, money: 40, favorability: { 老猎户: 15 },
          factionRep: { 鱼定村: 15, 玉泉寨: 3, 鱼定土司府: 0 },
          byFlag: { quest_ydside1_share: { factionRep: { 鱼定村: 5 }, favorability: { 鱼定大娘: 10 } } },
        },
      },
    ],
    rewardText: "得 40 两，鱼定村声誉 +15（分熊皮再 +5）、玉泉寨 +3；鱼定村声誉 ≥ 40 后可在晒谷演武场学《熊山剔骨刀》《踏雪寻踪步》。",
  },

  yudingcun_side2_shuangshui_ka: {
    id: "yudingcun_side2_shuangshui_ka",
    type: "QT_CHAIN",
    title: "村支2·东桥厘金风声",
    giver: "才旦",
    requiresFactionRep: { 鱼定村: 20 },
    description: "锦官城府衙派了两名书吏来东桥丈量商道、登记马队，村里盛传官府要设厘金卡收「过桥双税」。周铭章想凑一百两孝敬打发，才旦却托你查明这到底是柳青鸢的公令，还是下面人趁火打劫。",
    stages: [
      {
        id: "s1_inquire",
        playerHint: "去茶摊套书吏的话，或找丐帮周小满核实川西逃民的实情。",
        description: "书吏酒过三巡说漏了嘴：上头只叫丈量，没说设卡。周小满那边整理的《川西商税实录》也到了你手里。",
        completionFlag: "quest_ydside2_s1",
        onReach: { exp: 2 },
      },
      {
        id: "s2_settle",
        playerHint: "拿着实情去和东桥书吏交涉：据实上陈劝止设卡，还是默许周铭章行贿遮掩。",
        description: "官府的脸面和鱼定村的生计，总得定下一个章程。",
        completionFlag: ["quest_ydside2_report", "quest_ydside2_bribe"],
        choices: [
          { flag: "quest_ydside2_report", label: "据实上陈，以逃民实录劝止设卡", resolve: "none" },
          { flag: "quest_ydside2_bribe", label: "默许周铭章行贿遮掩", resolve: "none" },
        ],
        onReach: {
          exp: 2,
          byFlag: {
            quest_ydside2_report: { money: 60, items: c("广汉细棉布", 2), factionRep: { 鱼定村: 20, 丐帮三星分舵: 10, 锦官城: 8, 天龙教: 0, 欢喜教: 0 }, favorability: { 柳青鸢: 10 } },
            quest_ydside2_bribe: { money: 80, factionRep: { 鱼定村: 5, 锦官城: -5 }, favorability: { 才旦: -10, 周铭章: 10 } },
          },
        },
      },
    ],
    rewardText: "据实上陈得 60 两、广汉细棉布×2，鱼定村声誉 +20、丐帮三星分舵 +10、锦官城 +8；默许行贿得 80 两，鱼定村 +5、锦官城 -5，才旦好感 -10。",
  },

  yudingcun_side3_ye_song_chaomian: {
    id: "yudingcun_side3_ye_song_chaomian",
    type: "QT_CHAIN",
    title: "村支3·雪夜一袋炒面",
    giver: "鱼定大娘",
    requiresQuestCompleted: "village1_lubujianbuping",
    requiresFactionRep: { 鱼定村: 25 },
    description: "一场早雪突降，鱼定大娘连夜炒了两大袋酥油盐巴炒面，悄悄塞给你：一袋送去玉泉寨给快断粮的扎西父女，另一袋放到狼曲河谷西侧的老松树洞下——那是留给黑风寨巡夜弟兄的。",
    stages: [
      {
        id: "s1_yuquan",
        playerHint: "顶风踏雪，把第一袋炒面送到玉泉寨扎西父女手里。",
        description: "卓玛含泪说起大娘年年冬天都这么暗中接济牧民。",
        completionFlag: "quest_ydside3_s1",
        onReach: { exp: 2, favorability: { 扎西: 10, 卓玛: 10 } },
      },
      {
        id: "s2_pine",
        playerHint: "摸黑把第二袋放到狼曲河谷西侧的老松树洞下——守口如瓶，还是向土司府告发大娘。",
        description: "出来取粮的黑风寨斥候告诉你，十年前大娘走天都镇山道险些冻死在雪沟里，是巴桑拿命背回来的。",
        completionFlag: ["quest_ydside3_secret", "quest_ydside3_betray"],
        outcomeByFlag: { quest_ydside3_betray: "negative" },
        choices: [
          { flag: "quest_ydside3_secret", label: "守口如瓶，雪夜送完两袋粮", resolve: "none" },
          { flag: "quest_ydside3_betray", label: "向土司府告发大娘「私通山匪」", resolve: "none" },
        ],
        onReach: {
          exp: 2,
          byFlag: {
            quest_ydside3_secret: { items: c("大娘秘制酥油茶壶"), factionRep: { 鱼定村: 15, 玉泉寨: 10, 黑风寨: 10, 鱼定土司府: 0 }, favorability: { 鱼定大娘: 20 } },
            quest_ydside3_betray: { money: 100, factionRep: { 鱼定土司府: 15, 鱼定村: -25, 黑风寨: -25, 玉泉寨: -10, 雪山派: 0 }, favorability: { 鱼定大娘: -40 } },
          },
        },
      },
    ],
    rewardText: "守口如瓶得「大娘秘制酥油茶壶」，鱼定村声誉 +15、玉泉寨 +10、黑风寨 +10；告发得 100 两、鱼定土司府 +15，鱼定村 -25、黑风寨 -25、玉泉寨 -10。",
  },
} };
