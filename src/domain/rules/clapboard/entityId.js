// 全局实体唯一编号器（WO-05，契约 A）
// ============================================================================
// 全仓实体统一前缀短编号：器物 it_<6位hex>（具名图鉴物固定 it_cat_<hash>）、
// 事件事实 F<回合>_<序号>、原文段落 P<回合>_<段号>、江湖契约 pact_<回合>_<序号>、
// 备料 prep_<状态版本>_<序号>。本模块只管器物编号与按编号/名字反查实体。
//
// 【确定性铁律】禁 Date.now / Math.random：同一个物件在同一回合同一序号下
// 无论何时何地调用，生成的 id 都必须逐字节相同——场记板引用、判官落盘、
// 存档迁移全指望这份稳定。hex 由 FNV-1a 哈希派生，不消耗 rng 序列
// （rng 序列要留给战斗掉落等真正需要"随机"的地方，且消耗次序易受调用次数污染）。

import { CATALOG_INDEX } from "../../data/items/catalog.js";

function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (Math.imul(h, 0x01000193)) >>> 0;
  }
  return h >>> 0;
}

const hex6 = (n) => (n >>> 0).toString(16).padStart(6, "0").slice(-6);

// 规范 id 形如 it_<4-8位hex> 或 it_cat_<4-8位hex>。历史 id 只要带 it_ 前缀一律
// 保留不重修（ WO-05 规格："已有规范 it_ 前缀保留"），这条正则只用于识别与宽松匹配。
export const ITEM_ID_RE = /^it_(?:cat_)?[0-9a-z]{4,8}$/;

// 确保一件器物有全局唯一 id，返回 id 字符串（纯函数，不改入参）：
//   1. 已有 it_ 前缀的 id → 原样保留（含历史遗留的非标后缀，敬重存量数据）；
//   2. 名字命中图鉴 CATALOG_INDEX → 稳定 it_cat_<hash(name)>，与回合/序号无关，
//      同一把「断念剑」在任何时刻都是同一个 id；
//   3. 其余新物 → it_<hash(name|turn|seq)>，同回合同序号同名幂等，
//      换回合或换序号自然分叉。
// item 可以是对象也可以是纯字符串名（AI 回包里 items_add 常见两种形态）。
export function ensureItemId(item, turn = 0, seq = 0) {
  if (item == null) return "";
  const name = typeof item === "string" ? item : (item.name || "");
  const existing = typeof item === "object" ? item.id : null;
  if (typeof existing === "string" && existing.startsWith("it_")) return existing;
  if (name && CATALOG_INDEX[name]) return `it_cat_${hex6(hashString(name))}`;
  return `it_${hex6(hashString(`${name}|${turn}|${seq}`))}`;
}

// 按 id 或名字在实体池里反查。pool 接受数组或 name→实体 的对象表，
// 实体只需带 id/name 字段（器物、人物通用）。匹配次序：
//   1. id 精确命中；
//   2. name 精确命中；
//   3. 宽松命中：token 与实体的 id/name 去空白后相等，或实体 id 的 hex 尾段命中
//      （判官/小模型常把 it_8f3a21 截写成 8f3a21，放它一马）。
// 找不到返回 null，绝不抛——调用方拿 null 走"未知实体"分支即可。
// 无条件按新物派生 it_<hex>（跳过图鉴查表）——用于"名字撞图鉴但并非真品"
// 的场景（如 WO-10 品阶超授信的公式兜底物），避免与真品 it_cat_<hash> 撞 id。
export function mintItemId(name, turn = 0, seq = 0) {
  return `it_${hex6(hashString(`${name}|${turn}|${seq}`))}`;
}

export function resolveEntityByIdOrName(pool, token) {
  if (!pool || token == null) return null;
  const list = Array.isArray(pool) ? pool : Object.values(pool);
  const raw = String(token).trim();
  if (!raw) return null;
  for (const e of list) {
    if (e && e.id === raw) return e;
  }
  for (const e of list) {
    if (e && e.name === raw) return e;
  }
  const squash = (s) => String(s || "").replace(/\s+/g, "");
  const sq = squash(raw);
  for (const e of list) {
    if (!e) continue;
    if (squash(e.id) === sq || squash(e.name) === sq) return e;
    if (typeof e.id === "string" && e.id.startsWith("it_")) {
      const tail = e.id.replace(/^it_(?:cat_)?/, "");
      if (tail && tail === sq) return e;
    }
  }
  return null;
}
