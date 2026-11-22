import { QUCUO_MAP } from "../../data/map/qucuoMap.js";

// 心灵之海是好感解锁的意识空间、第三新东京市是终章一次性据点，都不该当日常落脚点
export const DISTRICTS = Object.keys(QUCUO_MAP).filter(d => d !== "心灵之海" && d !== "第三新东京市");
