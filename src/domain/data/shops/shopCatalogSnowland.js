import { ITEM_CATEGORY } from "../../rules/economy/equipment.js";

export const shopsSnowland = {
  雪域珍宝行: {
    shopName: "雪域珍宝行",
    items: [
      { name: "康定红珊瑚串", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝" },
      { name: "马帮路引", category: ITEM_CATEGORY.ACCESSORY, quality: "绿" },
      { name: "九眼天珠", category: ITEM_CATEGORY.ACCESSORY, quality: "紫" },
      { name: "武侯破甲重弩", category: ITEM_CATEGORY.WEAPON, quality: "蓝" },
      { name: "康巴厚背重刀", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "康巴牛皮马帮甲", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
    ],
  },
  番市藏药铺: {
    shopName: "番市藏药铺",
    items: [
      { name: "止血散", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "金疮药", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "达摩驱寒膏", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "雪山当归丸", category: ITEM_CATEGORY.MISC, quality: "蓝" },
      { name: "焚风辟寒丹", category: ITEM_CATEGORY.MISC, quality: "蓝" },
    ],
  },
  溪卡纳租庄仓: {
    shopName: "溪卡纳租庄仓",
    items: [
      { name: "雅州边茶砖", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "酥油炒面", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "高原酥油膏", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "朱砂印经残卷", category: ITEM_CATEGORY.MISC, quality: "蓝" },
      { name: "三色花纹法袍", category: ITEM_CATEGORY.ARMOR, quality: "蓝" },
    ],
  },
  外姓护法堂: {
    shopName: "外姓护法堂",
    items: [
      { name: "乡勇木棓", category: ITEM_CATEGORY.WEAPON, quality: "白" },
      { name: "萨迦三色护法牌", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", minRep: 0 },
      { name: "巡捕营制式腰刀", category: ITEM_CATEGORY.WEAPON, quality: "绿", minRep: 0 },
      { name: "萨迦金铜飞轮", category: ITEM_CATEGORY.WEAPON, quality: "蓝", minRep: 15 },
      { name: "三色花纹法袍", category: ITEM_CATEGORY.ARMOR, quality: "蓝", minRep: 15 },
      { name: "日月五轮", category: ITEM_CATEGORY.WEAPON, quality: "紫", minRep: 40 },
      { name: "白玛草护法软甲", category: ITEM_CATEGORY.ARMOR, quality: "紫", minRep: 40 },
      { name: "八思巴玉印拓片", category: ITEM_CATEGORY.ACCESSORY, quality: "紫", minRep: 80 },
      { name: "昆氏金刚法杵", category: ITEM_CATEGORY.WEAPON, quality: "橙", minRep: 100, member: true, limitOnce: true },
    ],
  },
  渡口淘金集: {
    shopName: "渡口淘金集",
    items: [
      { name: "白牦牛酥油块", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "马帮硬皮褂", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
      { name: "白牦牛毛暖氅", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
      { name: "狼曲沙金袋", category: ITEM_CATEGORY.MISC, quality: "蓝" },
      { name: "火焰铜刀", category: ITEM_CATEGORY.WEAPON, quality: "蓝" },
    ],
  },
  四大八小盘道廊: {
    shopName: "四大八小盘道廊",
    items: [
      { name: "白牦牛酥油块", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "白幡口传信物", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", minRep: 0 },
      { name: "白牦牛毛暖氅", category: ITEM_CATEGORY.ARMOR, quality: "绿", minRep: 0 },
      { name: "火焰铜刀", category: ITEM_CATEGORY.WEAPON, quality: "蓝", minRep: 15 },
      { name: "噶举单层白布衣", category: ITEM_CATEGORY.ARMOR, quality: "蓝", minRep: 15 },
      { name: "辟寒火珠", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", minRep: 40 },
      { name: "焚风辟寒丹", category: ITEM_CATEGORY.MISC, quality: "蓝", minRep: 40 },
      { name: "三迦叶赤铜戒刀", category: ITEM_CATEGORY.WEAPON, quality: "紫", minRep: 80, member: true },
    ],
  },
  黑石山民集: {
    shopName: "黑石山民集",
    items: [
      { name: "青稞铁朵玛", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "天铁掘藏钢钎", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "羊肩胛卜骨挂坠", category: ITEM_CATEGORY.ACCESSORY, quality: "绿" },
      { name: "象雄黑石片甲", category: ITEM_CATEGORY.ARMOR, quality: "蓝" },
    ],
  },
  掘藏奇珍阁: {
    shopName: "掘藏奇珍阁",
    items: [
      { name: "脚夫铜牌", category: ITEM_CATEGORY.ACCESSORY, quality: "白" },
      { name: "左旋雍仲黑铜牌", category: ITEM_CATEGORY.ACCESSORY, quality: "绿", minRep: 0 },
      { name: "天铁掘藏钢钎", category: ITEM_CATEGORY.WEAPON, quality: "绿", minRep: 0 },
      { name: "黑木琼鸟面具", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", minRep: 15 },
      { name: "左旋黑铜转经轮", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", minRep: 15 },
      { name: "象雄黑石片甲", category: ITEM_CATEGORY.ARMOR, quality: "蓝", minRep: 40 },
      { name: "天铁九股黑杵", category: ITEM_CATEGORY.WEAPON, quality: "紫", minRep: 40 },
      { name: "黑门法王氅", category: ITEM_CATEGORY.ARMOR, quality: "紫", minRep: 80 },
      { name: "中阴还魂散", category: ITEM_CATEGORY.MISC, quality: "紫", minRep: 80 },
      { name: "大鹏裂石爪套", category: ITEM_CATEGORY.WEAPON, quality: "橙", minRep: 100, member: true, limitOnce: true },
    ],
  },
};
