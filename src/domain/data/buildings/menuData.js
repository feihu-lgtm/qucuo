// 服务场所菜单：饭馆/酒楼/戏楼的菜品配置
// buff 字段对应 char.special 里的七维属性名，duration 是持续时间单位数（1天=100）

export const SERVICE_MENUS = {
  // 青衣楼（雅江）。此前 qucuoBuildings.js 里 restaurant_yajiang 写了
  // menuKey: "冷锅鱼"，但这张表里没有这个键——玩家进青衣楼是一张空菜单。
  // 菜品按设计稿第十节列的四样（冷锅鱼/青城老酒/熊猫笋/竹叶青蛇胆汤）。
  冷锅鱼: [
    { name: "冷锅鱼", price: 14, buff: "体魄", val: 2, duration: 50, desc: "雅江人待客必点。冷锅底料铺上七分熟江团鱼片，不开火先吃鱼，鱼吃完加高汤涮菜，一锅两吃。" },
    { name: "青城老酒", price: 6, buff: "悟性", val: 1, duration: 30, desc: "青城山后山泉酿的米酒，甜润不烈。道士们晚课后喝一碗。" },
    { name: "熊猫笋炒腊肉", price: 9, buff: "身法", val: 1, duration: 35, desc: "熊猫啃剩的冷箭竹笋尖配腊肉，嫩得能掐出水。护谷弟子说别捡——但确实好吃。" },
    { name: "竹叶青蛇胆汤", price: 18, buff: "根骨", val: 2, duration: 45, desc: "玉真子配的方子，蛇胆吊汤解毒清火。取胆不杀蛇——蛇吐着信子走了，他也走了。" },
  ],
  饭馆: [
    { name: "青稞糌粑", price: 3, buff: "体魄", val: 1, duration: 30, desc: "藏地主食，扎实管饱，吃了腿脚有劲。" },
    { name: "牦牛骨汤", price: 8, buff: "根骨", val: 1, duration: 50, desc: "慢火熬一整天的浓汤，筋骨滋补，入口劲道。" },
    { name: "辣子炒肉", price: 12, buff: "体魄", val: 2, duration: 40, desc: "火候十足，热气腾腾，吃完血气翻涌，力道见长。" },
  ],
  素斋: [
    { name: "野菜豆腐", price: 4, buff: "根骨", val: 1, duration: 30, desc: "寺里自制豆腐配山野菜，清淡但养人。" },
    { name: "糌粑奶茶", price: 3, buff: "悟性", val: 1, duration: 20, desc: "僧人日常，喝了心清气净，杂念渐消。" },
  ],
  荤食地下室: [
    { name: "烤全羊腿", price: 20, buff: "体魄", val: 2, duration: 60, desc: "背着清规戒律从外面带进来的，火气大，吃了力道猛增。", isHidden: true },
    { name: "三炮台", price: 15, buff: "根骨", val: 1, duration: 40, desc: "清真风格的功夫茶，滋味浓烈，喝了筋骨通泰。", isHidden: true },
  ],
  酒楼: [
    { name: "曲措老酒", price: 5, buff: "悟性", val: 1, duration: 20, desc: "微醺之间思路清晰，是本地酿了三年的烈酒。" },
    { name: "醉仙酿", price: 18, buff: "体魄", val: 2, duration: 40, desc: "烈酒下肚，血气上涌，战意高昂。" },
    { name: "松茸炖鸡", price: 22, buff: "根骨", val: 2, duration: 50, desc: "秋日时节的珍馐，入药一般的功效，筋骨大补。" },
  ],
  醉仙楼: [
    { name: "曲措老酒", price: 5, buff: "悟性", val: 1, duration: 20, desc: "微醺之间思路清晰，是本地酿了三年的烈酒。" },
    { name: "醉仙酿", price: 18, buff: "体魄", val: 2, duration: 40, desc: "烈酒下肚，血气上涌，战意高昂。" },
    { name: "松茸炖鸡", price: 22, buff: "根骨", val: 2, duration: 50, desc: "秋日时节的珍馐，入药一般的功效，筋骨大补。" },
    { name: "夜明珠肴羹", price: 35, buff: "智谋", val: 1, duration: 60, desc: "只用深山野果酿制，口感奇特，喝了心思愈发敏锐。" },
  ],
  戏楼: [
    { name: "看折子戏", price: 10, buff: "魅力", val: 1, duration: 60, desc: "耳濡目染，举手投足之间气度自然提升。" },
    { name: "看全本大戏", price: 25, buff: "魅力", val: 2, duration: 80, desc: "整场大戏下来，言谈举止都多了几分腔调。" },
  ],
  粮行: [
    { name: "干粮包", price: 5, buff: "体魄", val: 1, duration: 20, desc: "压缩的行路口粮，吃了体力略有回升。" },
    { name: "高原人参", price: 40, buff: "体魄", val: 2, duration: 100, desc: "高原特产的药材，效力持久，体质明显增强。" },
  ],
};
