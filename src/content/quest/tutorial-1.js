export default { quest: {
"snow_leopard_quest": {
  "id": "snow_leopard_quest",
  "type": "QT_COLLECT",
  "title": "收复雪豹",
  "giver": null,
  "description": "鱼定村有头无主的雪豹，长长久久卧在村口那块青石上，不亲近谁，也不归谁所有，只静静等着一个它自己认准的人。它只认有灵之人；七样灵性占得五样，才肯随你踏遍山川。",
  "rewardText": "雪豹以额抵掌，从此山长水远，与你同行。",
  "stages": [
    {
      "id": "s1",
      "title": "证明与山川有缘",
      "description": "先莫急着招手。割肉喂它，留心它为何坐立不安，治好前爪旧伤；或为鱼定村出力，练得体魄七分、魅力七分，打赢一个恶人。七样灵性占得五样，青石上的金瞳自会认你。",
      "completionFlag": "snow_leopard_trusted"
    },
    {
      "id": "s2",
      "title": "伸手相邀",
      "description": "雪豹不再背过身去，粗长尾巴轻轻拂着你的脚踝。伸出手，邀它入队；它若将额头抵入掌心，这份山川之缘便算定了。",
      "completionFlag": "snow_leopard_invited"
    }
  ]
},
"hunter_learn_quest": {
    id: "hunter_learn_quest",
    type: "QT_KILL",
    title: "熊山除患",
    giver: "老猎户",
    description: "老猎户念叨着熊山上野兽越发凶悍，若是能帮他清剿几只，他便愿意指点几手压箱底的功夫。",
    targetTag: "熊山野兽",
    requiredCount: 3,
    rewardText: "老猎户认可了你的身手，愿意收你为徒，指点一路拳脚。",
  },
"tutorial_four_estates": {
    id: "tutorial_four_estates",
    type: "QT_COLLECT",
    title: "四宅家产",
    giver: null,
    requiredCount: 4,
    description: "钥匙柄上那截褪色的红绳，像有人日日摩挲过。曲措乡境内有四栋落了锁的房子——溪边小屋、山间别墅、弟子别院、蜀王庄，四把钥匙散在四条不同的路上。集齐四把钥匙，把这四份家产都握进手里，门后无数的宝藏和秘密都在等着你。",
    stages: [
      {
        id: "s1_first_home",
        description: "溪边小屋的门已经为你开了——灶膛余烬未冷，菜畦里还长着葱。这是你在曲措乡的第一处落脚，但绝不会是最后一处。还有三栋房子落着锁：天都镇赫连铸脖子上那把银灰钥匙、雪山派弟子别院的令牌、锦官城拍卖行的衔尾蛇门环。",
      },
      {
        id: "s2_two_homes",
        description: "两处产业在握，门后的宝藏与秘密已窥得一二。再寻两处——剩下的钥匙还在前面几条路上。集齐四把，这曲措乡便真正有你一席之地。",
      },
      {
        id: "s3_three_homes",
        description: "三宅在握，只差最后一把钥匙。四宅齐备之日近在眼前——到那时，自有一份配得上你身份的物事相赠。",
      },
      {
        id: "s4_four_homes",
        description: "四把钥匙齐了，四份家产尽握在手。溪边小屋、山间别墅、弟子别院、蜀王庄——从今往后，你在曲措乡是有产有业的人了。",
      },
    ],
    rewardText: "四把钥匙齐了。有人捧来一套土司礼服——藏锦金线，胸前一枚四曲交汇纹。从今往后，你在曲措乡是有产有业的人了。",
  }
} };
