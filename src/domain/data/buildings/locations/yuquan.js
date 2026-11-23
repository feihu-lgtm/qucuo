import { BUILDING_TYPE } from "../buildingType.js";

  // ── 玉泉寨（2 种，水路要道） ──
export const yuquan = [
    {
      id: "inn_yuquan", name: "玉泉小栈", type: BUILDING_TYPE.INN, innPrice: 8,
      desc: "藏寨风格的小客栈，牛毛毡作床，青稞酒管够，朴实无华。",
    },
    {
      id: "wuguan_yuquan", name: "玉泉练武场", type: BUILDING_TYPE.WUGUAN, skillSet: "玉泉",
      desc: "玉泉寨猎人和牧民自发组的练武场，藏地摔跤和步法为主，平时也传外人。",
    },
    {
      id: "forge_yuquan", name: "寨门铁作棚", type: BUILDING_TYPE.FORGE,
      desc: "索朗的露天铁作棚，打马掌、修牧刀，炉火常年不熄。",
    },
    {
      id: "hospital_yuquan", name: "巴登草药棚", type: BUILDING_TYPE.HOSPITAL, healPerLiang: 3,
      desc: "巴登阿妈的草药棚，跌打接骨膏远近闻名，声誉够的常客看病不收钱。",
    },
    {
      id: "teahouse_yuquan", name: "寨场酥油茶棚", type: BUILDING_TYPE.TEAHOUSE,
      desc: "寨场边的酥油茶棚，茶马古道的行商歇脚处，消息比酥油茶还热乎。",
    },
    {
      id: "kitchen_yuquan", name: "狼曲篝火灶台", type: BUILDING_TYPE.KITCHEN,
      desc: "狼曲河边的公共篝火灶台，牧民共用的炊事地。",
    },
    {
      id: "shop_yuquan", name: "玉泉茶马货栈", type: BUILDING_TYPE.SHOP, shopKey: "玉泉货栈",
      desc: "茶马古道上的中转货栈，茶砖皮货青稞酒，价钱看你在寨里的名声。",
    },
];
