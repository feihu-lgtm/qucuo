// 拜入青城派兼容导出：统一委托给 sectEntry.js（保留原有接口供 factionShop 与既有测试复用）。
import { SECT_ENTRIES, SECT_MEMBER_FLAGS, checkSectEntry } from "./sectEntry.js";

const entry = SECT_ENTRIES.青城派;

export const QINGCHENG_ENTRY = Object.freeze({
  sect: entry.sect,
  master: entry.master,
  buildingId: entry.buildingId,
  minRep: entry.minRep,
  repBonus: entry.repBonus,
  flag: entry.flag,
  token: entry.keyName,
  gifts: entry.bonusItems.map((item) => item.name),
});

export { SECT_MEMBER_FLAGS };

export function checkQingchengEntry({ varTree, flags = [] } = {}) {
  const status = checkSectEntry({ varTree, flags }, QINGCHENG_ENTRY.sect);
  return {
    already: status.already,
    rep: status.rep,
    reqs: status.reqs,
    eligible: status.eligible,
    missing: status.missing,
  };
}
