import { BUILDING_TYPE } from "../buildingType.js";

  // ── 喇嘛庙（6 种，宗教重地；护法禅院、山门施药棚照合稿新增） ──
  // ── 后山平台·跑马大会（总纲 v3 第四章） ──
  // 跑马场挂盛会屏；集市外围挂商行屏，摊位收成一家「跑马集市」。
export const houshan = [
    {
      id: "festival_paoma", name: "跑马大会会场", type: BUILDING_TYPE.FESTIVAL,
      desc: "一年一度的跑马大会：上午跑马、午后射箭、傍晚比武，土司当众看彩。外围集市人挤人，入夜另有文章。",
    },
    {
      id: "market_paoma", name: "跑马集市", type: BUILDING_TYPE.SHOP, shopKey: "跑马集市",
      desc: "大会期间才支起来的摊区：锦官商号的舶来货、本地土特产、送姑娘的小礼物、吃食药品，一摊挨一摊。",
    },
];
