// 天龙教主线天2～天5（合稿·天龙教 四）。合稿里的石重岳/安世衡在本作是厉苍龙/厉苍天（PR274 改名）。
// 天4、天5 按天王/龙王两条路线各拆一条任务：一条线走过第一段就立 route flag，另一条线永久锁死。
// 门槛用顶层 requiresFactionRep / requiresQuestCompleted（PR237 写法），潜伏分支的声誉走 quietFactionRep。
export const T = "天龙教";
export const camp = (inner) => ({ district: "天龙营", inner });
export const catalog = (...names) => names.map((name) => ({ name, fromCatalog: true }));
