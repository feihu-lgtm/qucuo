// WO-10 天工铸物器：把判官签发的空白天机券（warrant）+ 说书人尾章填空（sealFill）
// 编译成真实可玩的物品实例。全程纯函数，禁 Date.now/Math.random：
// 实例 id 一律用 WO-05 ensureItemId 确定性覆写（makeItem/makeNamedItem 内部的
// 随机 id 不可信，出生落款必须可重放）。
import { CATALOG_INDEX, makeNamedItem } from "../../data/items/catalog.js";
import { makeItem, QUALITY } from "../economy/equipment.js";
import { ensureItemId, mintItemId } from "../clapboard/entityId.js";
import { compileAffix } from "./affixPointTable.js";

function qualityRank(q) {
  const i = QUALITY.indexOf(q);
  return i === -1 ? 0 : i;
}

// warrant: { warrantId, factId, op, category, quality, pointBudget, allowedAffixes, origin:{turn,day,place,fromNpc} }
// sealFill: { name, chosenAffix, desc }
// 返回物品实例；入参残缺返回 null。
export function compileEmergentItem(warrant, sealFill, { luck = 0 } = {}) {
  if (!warrant || !sealFill || !sealFill.name) return null;
  const turn = warrant.origin?.turn ?? 0;
  const seq = Number(String(warrant.warrantId || "").replace(/\D/g, "")) || 0;

  const entry = CATALOG_INDEX[sealFill.name];
  let item;
  let catalogHit = false;
  if (entry && qualityRank(entry.quality) <= qualityRank(warrant.quality)) {
    // 图鉴命中且品阶不超授信：出真品，数值以 catalog 为准
    item = makeNamedItem(sealFill.name);
    catalogHit = true;
  } else {
    // 奇遇新物：按授信品阶走 makeItem 攻防价格曲线
    item = makeItem({
      name: sealFill.name,
      category: warrant.category || "misc",
      quality: warrant.quality || "白",
      desc: sealFill.desc || "",
    });
  }
  if (!item) return null;

  // 校验 chosenAffix 在 warrant.allowedAffixes 白名单内才挂载真实词条；
  // 越界词条物理驳回（不挂载、不留垃圾字段），在实例上打 rejectedAffix 标记供校对器复读。
  let rejectedAffix = false;
  if (!catalogHit && sealFill.chosenAffix) {
    const allowed = Array.isArray(warrant.allowedAffixes) && warrant.allowedAffixes.includes(sealFill.chosenAffix);
    if (allowed) {
      const compiled = compileAffix(sealFill.chosenAffix);
      if (compiled?.effect) item.effect = { ...compiled.effect };
      if (compiled?.sixDim) item.sixDim = { ...compiled.sixDim };
      if (compiled?.consumable) item.consumable = { ...compiled.consumable };
    } else {
      rejectedAffix = true;
    }
  }

  // 确定性 id 覆写：真品图鉴物稳定 it_cat_<hash>；
  // 公式兜底物即使撞图鉴名也强制按新物派生 it_<hex>——它不是真品，
  // 撞 id 会让 toggleEquip 等按 id 寻址的逻辑联动错件。
  item.id = catalogHit
    ? ensureItemId({ name: item.name }, turn, seq)
    : mintItemId(item.name, turn, seq);
  if (sealFill.desc && !item.desc) item.desc = sealFill.desc;
  // 出生落款 + 空器史（器史演化在 WO-23）
  item.provenance = { ...(warrant.origin || {}), factId: warrant.factId || "" };
  item.history = [];
  if (rejectedAffix) item.rejectedAffix = true;
  // luck 入参当前只作接线占位（掷骰在判官侧，编译器不复掷），不进输出
  void luck;
  return item;
}
