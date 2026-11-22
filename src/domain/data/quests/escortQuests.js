export const ESCORT_QUESTS = [
  { id: "eq_zhangshang_yuquan", title: "布料押送", fromLocations: ["天都镇", "鱼定村"], targetNpc: "张商人", targetLocation: "玉泉寨·玉泉小栈", reward: 80, desc: "将一批布料押送到玉泉寨，交给正在那里等候的张商人。" },
  { id: "eq_lizhang_tiandu", title: "茶叶转运", fromLocations: ["锦官城", "鱼定村"], targetNpc: "李掌柜", targetLocation: "天都镇·天都香行", reward: 60, desc: "把一箱上等茶叶送到天都镇，交给李掌柜的茶叶仓库管事。" },
  { id: "eq_zhusi_yiding", title: "商队随行", fromLocations: ["锦官城", "天都镇"], targetNpc: "大胡子朱四", targetLocation: "鱼定村·护镖站", reward: 100, desc: "跟着大胡子朱四的商队走一段路到鱼定村，护送货物安全到达。" },
  { id: "eq_zhuoma_goncuo", title: "牧品运送", fromLocations: ["玉泉寨", "鱼定村"], targetNpc: "卓玛", targetLocation: "贡措海·湖畔", reward: 50, desc: "帮卓玛把一批牛毛制品送到贡措海边，那里有人在等。" },
  { id: "eq_awang_tiandu", title: "骡马跑腿", fromLocations: ["鱼定村", "玉泉寨"], targetNpc: "赶马人阿旺", targetLocation: "天都镇·天都镖局", reward: 45, desc: "赶马人阿旺要去天都镇交货，路上帮着看住骡马，防止出意外。" },
  // 喇嘛庙·七、加分行为 3「保护行脚僧/商队」(+6~10 取 8)：每日一镖，送到山门交洛桑。
  { id: "eq_lama_xingjiao", title: "护送行脚僧", fromLocations: ["鱼定村", "天都镇"], targetNpc: "洛桑", targetLocation: "喇嘛庙·山门", reward: 30, daily: "lama_escort_day_", factionRep: { 喇嘛庙: 8 }, desc: "云游行脚僧洛桑要回喇嘛庙，路上马匪血刀都不安生——镖局接了喇嘛庙的托，护他一路到山门。" },
];
