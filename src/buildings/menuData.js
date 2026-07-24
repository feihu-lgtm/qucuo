// 服务场所菜单：饭馆/酒楼/戏楼的菜品配置
// buff 字段对应 char.special 里的七维属性名，duration 是持续时间单位数（1天=100）

export const SERVICE_MENUS = {
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
