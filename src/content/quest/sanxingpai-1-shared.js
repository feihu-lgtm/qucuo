// 三星派任务线（合稿·三星派第 4 节）。主线 星1~星5 与支线 星支1~3；星4 旧客、星5 金乌破妄是终局拉拢线。
// 星5 纵目亲临合稿门槛 140，声誉上限 100，收到 100；合稿「进入终局拉拢阶段」main 上还没有阶段旗，暂不卡。
// 声誉奖励按合稿原值写在收尾阶段；联动扣分由 applyFactionRep 统一结算，这里不手写。
export const SX = "三星派";
export const GB = "丐帮三星分舵";
export const at = (inner, district = "广汉") => ({ district, inner });
export const catalog = (name, count = 1) => Array.from({ length: count }, () => ({ name, fromCatalog: true }));
