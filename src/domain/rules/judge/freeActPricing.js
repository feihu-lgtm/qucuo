// ── S3 自由行动破费查价链（纯函数）──────────────────────────────────
// 调度初审口径（#528 退回重修）：
// ①先识别目标物/具名——item 明确，或原文扫描命中「唯一不歧义」的货架/物件志具名
//   （多个互不为子串的具名同现=歧义，不猜，防把席面当饼价）；
// ②能确定货物才走查价链：货架同名价 → 货架同类价 → 物件志具名基价 → priceForQuality(category,"白")；
// ③无法确定货物/category（服务/请客/打点/歧义）返回 null——由调用方落 risk 默认，
//   绝不在所有 free_act 上默认套 misc 白档。
// 货架 = 在场商户 NPC（QUCUO_SHOPS[name]）的静态铺货 buildShopInventory；
// 不掷当日滚动 stock——查价只需「这家店这类货卖多少」的确定性锚。

import { QUCUO_SHOPS, buildShopInventory } from "../../data/shops/qucuoShops.js";
import { SERVICE_MENUS } from "../../data/buildings/menuData.js";
import { CATALOG_INDEX, catalogBuyPrice } from "../../data/items/catalog.js";
import { priceForQuality } from "../economy/equipment.js";

// 中文数字解析（破费原话数额）：三两/十五两/一百二十两 与阿拉伯数字并认。
const CN_DIGITS = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const CN_UNITS = { 十: 10, 百: 100, 千: 1000, 万: 10000 };
function parseCnNumeral(str) {
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  let total = 0, section = 0, num = 0, seen = false;
  for (const ch of str) {
    if (ch in CN_DIGITS) { num = CN_DIGITS[ch]; seen = true; }
    else if (ch in CN_UNITS) {
      const u = CN_UNITS[ch];
      seen = true;
      if (u === 10000) { total += (section + num) * u; section = 0; }
      else section += (num || 1) * u;
      num = 0;
    } else return NaN;
  }
  const out = total + section + num;
  return seen && Number.isFinite(out) ? out : NaN;
}

// 原话写数额按原话，但「两」是重量/银两同形——严格口径（调度初审）：
// 只有「N两银/两银子/银/钱」明确钱文，或支付动词（付/掏/掷/赏/出/花/给/递）近旁
// （前三字内）的「N两」才算原话数额；裸「N两+货名」（买一两茶叶）是货量不是价。
const PAY_VERBS = new Set([..."付掏掷赏出花给递"]);
export function parseStatedExpense(text) {
  const src = String(text || "");
  const re = /([零一二三四五六七八九十百千万\d]+)\s*(两银子|两银|银两|银|钱|两)/g;
  let m; let firstDefinite = null;
  // 动词候选收集（不再首个即返）——Review 五修保守原则：宁落兜底不超扣。
  // 多个不同动词近旁数额=歧义（先付三两订金/再付五两尾款），玩家的真实支付
  // 意图无法用正则确证，整句不签原话价落查价链兜底（小额，绝不超扣）。
  const verbAmounts = [];
  while ((m = re.exec(src))) {
    const prevCh = m.index > 0 ? src[m.index - 1] : "";
    const chBeforeDot = m.index > 1 ? src[m.index - 2] : "";
    const unit = m[2];
    const before = src.slice(Math.max(0, m.index - 3), m.index);
    // 动词点币分数：动词紧贴点号或仅隔空白（付.5/付 .8=分数钱文）——
    // 「付吧.8两」动词隔非空白字属前句句读，整数价不误伤。
    const verbIdxBeforeDot = chBeforeDot;
    const verbTouchingDot = PAY_VERBS.has(verbIdxBeforeDot)
      || (/\s/.test(verbIdxBeforeDot || "") && PAY_VERBS.has(m.index > 2 ? src[m.index - 3] : ""));
    const dotDigitBefore = /[0-9０-９]/.test(chBeforeDot);
    const isDecimal = (prevCh === "." || prevCh === "．") && (dotDigitBefore || verbTouchingDot);
    if (isDecimal) continue;
    const n = parseCnNumeral(m[1]);
    if (!(Number.isFinite(n) && n > 0)) continue;
    // 动词近旁但动词带意图/否定前置（够付/要付/想付/未付/没付/别付）不算实际支付——
    // 「囊中够付八两」是财力声明，真正的支付在后面的「先付三两」。
    const verbMatch = [...before].some((ch) => PAY_VERBS.has(ch));
    if (verbMatch) {
      const beforeVerb1 = src.slice(Math.max(0, m.index - 4), m.index);
      if (!/够|要|想|未|没|别/.test(beforeVerb1.replace(/付|掏|掷|赏|出|花|给|递/g, ""))) {
        verbAmounts.push(n);
      } else if (!/够付|要付|想付|未付|没付|别付|够掏|要掏/.test(beforeVerb1)) {
        verbAmounts.push(n);
      }
      // 动词近旁优先于余额语境，进候选不进 firstDefinite
      continue;
    }
    // 余额/欠账语境不是价——身上有/余额/囊中/身带/存有 近旁是财力声明；
    // 「还有」已从名单剔除：「房钱还有五两没付」是待付账单不是余额（Review 五修）。
    const beforeWide = src.slice(Math.max(0, m.index - 6), m.index);
    if (/身上有|身上还有|余额|囊中|身带|存有|我还有|俺还有|咱还有/.test(beforeWide)) continue;
    if (unit !== "两" && firstDefinite == null) firstDefinite = n;
  }
  // 动词候选唯一才取——零个回落钱文，多个不同额歧义保守 null，多个同额取同额。
  const uniqVerb = [...new Set(verbAmounts)];
  if (uniqVerb.length === 1) return uniqVerb[0];
  if (uniqVerb.length > 1) return null;
  return firstDefinite;
}

export function resolveFreeActExpense({ text = "", itemName = "", category = "", presentNpcNames = [], menuKey = "" } = {}) {
  // ①在场商户货架
  const shelves = [];
  for (const name of presentNpcNames || []) {
    if (!QUCUO_SHOPS[name]) continue;
    const inv = buildShopInventory(name);
    if (inv?.items?.length) shelves.push(...inv.items);
  }
  const txt = String(text || "");
  const wanted = String(itemName || "").trim();

  // Review 修（夜班银两单）：饭馆/酒楼服务菜单进查价链——点菜破费得按菜单实价扣，
  // 此前菜单不在链上，牦牛骨汤（8 两）落 quality 默认 18 两多扣一倍还多。
  // 菜单具名冲突处理：同名不同价（跨菜单）按歧义不落价；同名同价照用。
  // 二轮 Review 三修：
  // ①场地限定——当前建筑 menuKey 已知时只扫该店菜单，在醉仙楼点老孙饭馆的菜不落价；
  // ②谢绝排除——菜名前缀着 不/别/莫/无/免 的是推掉不要，不算点单、也不制造歧义；
  // ③份量乘算——「三份/两碗/一壶×3」贴在菜名前的份数按乘算（parseCnNumeral 同款数词）。
  const NEG_RE = /[不别莫无免][要不要来上吃点叫]?$/;
  const COUNT_RE = /([一二两三四五六七八九十\d]{1,3})[份碗壶盘杯个只]\s*$/;
  const menuHits = [];
  const scanMenus = menuKey && SERVICE_MENUS[menuKey] ? [SERVICE_MENUS[menuKey]] : Object.values(SERVICE_MENUS);
  for (const dishes of scanMenus) {
    for (const dish of dishes) {
      if (!dish?.name) continue;
      const at = txt.indexOf(dish.name);
      if (at < 0) continue;
      const before = txt.slice(Math.max(0, at - 8), at);
      if (NEG_RE.test(before.trimEnd().replace(/[，。、\s]+$/, ""))) continue; // 谢绝不算
      let portions = 1;
      const cm = COUNT_RE.exec(before.replace(/[\s，。、]+$/, ""));
      if (cm) {
        const n = parseCnNumeral(cm[1].replace(/两/g, "二"));
        if (Number.isFinite(n) && n >= 1 && n <= 20) portions = n;
      }
      menuHits.push({ ...dish, portions });
    }
  }

  // ②识别目标物：item 明确优先；否则原文扫描货架+物件志具名，子串归并取最长，
  // 剩余互不为子串的具名多于一个 = 歧义（席面/薄饼同现），不猜。
  let goodName = "";
  if (wanted && wanted !== "无") {
    goodName = wanted;
  } else {
    const shelfHits = shelves.filter((it) => it.name && txt.includes(it.name)).map((it) => it.name);
    const menuNames = menuHits.map((d) => d.name);
    const catHits = Object.keys(CATALOG_INDEX).filter((n) => n.length >= 2 && txt.includes(n));
    const all = [...new Set([...shelfHits, ...menuNames, ...catHits])];
    const distinct = all.filter((n) => !all.some((o) => o !== n && o.includes(n)));
    if (distinct.length === 1) goodName = distinct[0];
    else if (distinct.length > 1) return null; // 歧义不落价
  }
  if (!goodName) return null; // 服务/请客/打点——无目标物，走 risk 默认

  // ③查价链：货架同名 → 货架同类 → 物件志具名基价 → priceForQuality(category,"白")
  const shelfSame = shelves.find((it) => it.name === goodName);
  if (shelfSame?.buyPrice > 0) return { price: shelfSame.buyPrice, source: `货架同名（${goodName}）` };

  // 菜单具名价：命中菜品的价目唯一（或同名同价）才落——点菜实价优先于物件志/品质估价。
  const menuSame = menuHits.filter((d) => d.name === goodName);
  if (menuSame.length) {
    const prices = [...new Set(menuSame.map((d) => d.price))];
    if (prices.length === 1 && prices[0] > 0) {
      const portions = menuSame[0].portions || 1;
      return { price: prices[0] * portions, source: `菜单具名（${goodName}${portions > 1 ? `×${portions}份` : ""}）` };
    }
  }

  const entry = CATALOG_INDEX[goodName] || null;
  // category 确定源：货架同货物 > 物件志条目 > 调用方传入（inventory 实证），都没有则不定
  const cat = shelfSame?.category || entry?.category || category || "";
  if (cat) {
    const shelfCat = shelves.find((it) => it.category === cat);
    if (shelfCat?.buyPrice > 0) return { price: shelfCat.buyPrice, source: `货架同类（${shelfCat.name}）` };
  }
  // 物件志权威价 = catalogBuyPrice（武器/护甲按 atkMul/defMul 抬价，杂物饰品基准）——
  // 不裸套 priceForQuality，防具名装备经济洞（调度初审口径）
  if (entry) {
    const bp = catalogBuyPrice(entry);
    if (bp > 0) return { price: bp, source: `物件志（${goodName}）` };
  }
  if (cat) {
    const fallback = priceForQuality(cat, "白");
    if (fallback.buyPrice > 0) return { price: fallback.buyPrice, source: `${cat}白档基准` };
  }
  return null;
}
