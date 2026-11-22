// 拜入青城派（合稿青城章七·4）：青城声誉 ≥ 40、威望 ≥ 0、剑坪试剑得胜、未拜他派。
// 入门立加青城声誉 20，发青城玄门竹牌、三清松风铁剑、青城道袍。
import { factionRepOf } from "../economy/factionRep.js";
import { SECT_ENTRY } from "./sectEntry.js";

export const QINGCHENG_ENTRY = {
  sect: "青城派",
  master: "一清道长",
  buildingId: "sect_entry_yajiang",
  minRep: 40,
  repBonus: 20,
  flag: "青城派弟子",
  token: "青城玄门竹牌",
  gifts: ["三清松风铁剑", "青城道袍"],
};

// sectSpar.js 青城首胜写入的 flag，即「剑坪试剑」已过。
const SECT_SPAR_FIRST_FLAG = "qingcheng_spar_first";

export const SECT_MEMBER_FLAGS = { 雪山派: SECT_ENTRY.flag, 青城派: QINGCHENG_ENTRY.flag };

export function checkQingchengEntry({ varTree, flags = [] } = {}) {
  const rep = factionRepOf(varTree, QINGCHENG_ENTRY.sect);
  const prestige = Number(varTree?.世界?.威望) || 0;
  const other = Object.entries(SECT_MEMBER_FLAGS).find(([sect, flag]) => sect !== QINGCHENG_ENTRY.sect && flags.includes(flag));
  const reqs = [
    { key: "rep", label: `青城派声誉 ≥ ${QINGCHENG_ENTRY.minRep}（门墙之交）`, have: rep, ok: rep >= QINGCHENG_ENTRY.minRep },
    { key: "prestige", label: "威望 ≥ 0（不收恶名昭彰之徒）", have: prestige, ok: prestige >= 0 },
    { key: "trial", label: "剑坪试剑：堂堂正正胜过青玄或松鹤道长", have: flags.includes(SECT_SPAR_FIRST_FLAG) ? "已胜" : "未胜", ok: flags.includes(SECT_SPAR_FIRST_FLAG) },
    { key: "single", label: "未拜入他派", have: other ? other[0] : "无", ok: !other },
  ];
  const already = flags.includes(QINGCHENG_ENTRY.flag);
  return { already, rep, reqs, eligible: !already && reqs.every((r) => r.ok), missing: reqs.filter((r) => !r.ok).map((r) => r.key) };
}
