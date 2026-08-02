// 安全屋（四栋房子）· 数据与判定
// ============================================================================
import { makeItem } from "./equipment.js";

// 曲措乡境内四栋可长期落脚的房子，每栋锁着，各需一把钥匙，四把钥匙四种拿法：
//
//   鱼定村·溪边小屋   ← 开局背包自带（教会玩家"锁+钥匙"这套机制）
//   天都镇·山间别墅   ← 打赢镇口恶人赫连铸，必掉
//   雪山派·弟子别院   ← 拜入雪山派成为正式弟子，何雨谢发放
//   锦官城·蜀王庄     ← 城里拍卖行竞得（有托儿抬价）
//
// 【为什么按名字匹配而不是 id】
// 背包里的物品 id 是运行时拼的（`${name}_${Date.now()}`，见各处 setInv），
// 同一把钥匙每次入袋 id 都不一样，拿 id 去比对永远匹配不上。全项目物品的
// 稳定标识实际是 name（百物录 CATALOG_INDEX 也是按 name 索引），所以
// unlockCondition 用 { type: "item", itemName } 而不是 itemId。
//
// 【房间数据在哪】
// 四个房间本体挂在 innerMap.js 各自据点的 rooms 里（跟其他内层房间同级，
// 不另起一套地图结构）。这里只放"钥匙是什么、怎么拿、开哪扇门"的对照表，
// 供开局发钥匙、掉落、拜派、拍卖四个发放点共用同一份真值。

// ── 四把钥匙 ────────────────────────────────────────────────────────────
// category 一律 misc：equipment.js 的 ITEM_CATEGORY 只有 weapon/armor/
// accessory/misc 四类，没有 "quest" 这一类（设计稿里写的 quest 是不存在的）。
// quality 用中文六档（白绿蓝紫橙红），不是英文——makeItemSmart/rollQuality
// 全链路认的都是中文档位。
export const SAFE_HOUSE_KEYS = [
  {
    name: "溪边小屋钥匙",
    category: "misc",
    quality: "白",
    desc: "一把普通的铜钥匙，齿纹却极精密。柄上系着褪色的红绳，绳结打得很仔细，像是有人日日摩挲过。",
    source: "初始携带",
  },
  {
    name: "银灰色钥匙",
    category: "misc",
    quality: "蓝",
    desc: "从赫连铸脖子上搜出来的。材质不是铜也不是铁，摸上去始终冰凉，表面有极细的纹路，凑近看像某种没见过的文字。他说这是从天上掉下来的。",
    source: "击败赫连铸",
  },
  {
    name: "雪山派令牌钥匙",
    category: "misc",
    quality: "绿",
    desc: "雪山派正式弟子的令牌，青铜铸就，正面一座雪峰，背面刻着一个小小的「贰」。兼作弟子别院的门锁钥匙。",
    source: "拜入雪山派",
  },
  {
    name: "衔尾蛇门环",
    category: "misc",
    quality: "紫",
    desc: "锦官城拍卖所得。两条首尾相衔的蛇盘成一个环，蛇眼嵌着两粒红石。旋开蛇口，环身竟能拆成一把钥匙。",
    source: "锦官城拍卖竞得",
  },
];

export const SAFE_HOUSE_KEY_BY_NAME = Object.fromEntries(
  SAFE_HOUSE_KEYS.map(k => [k.name, k]),
);

// ── 四栋房子 ────────────────────────────────────────────────────────────
// district/room 必须与 innerMap.js 里的据点名/房间名逐字一致。
export const SAFE_HOUSES = [
  { district: "鱼定村", room: "溪边小屋", keyName: "溪边小屋钥匙", label: "溪边小屋" },
  { district: "天都镇", room: "山间别墅", keyName: "银灰色钥匙", label: "山间别墅" },
  { district: "雪山派", room: "弟子别院", keyName: "雪山派令牌钥匙", label: "弟子别院" },
  { district: "锦官城", room: "蜀王庄", keyName: "衔尾蛇门环", label: "蜀王庄" },
];

// ── 判定 ────────────────────────────────────────────────────────────────
// 背包条目既可能是字符串（纯剧情杂物）也可能是对象（走装备系统的），
// 两种都要认——这是全项目背包读取的通用形态，别处已踩过好几次坑。
export function invHasItemNamed(inv, itemName) {
  if (!itemName) return false;
  return (inv || []).some(it => (typeof it === "string" ? it : it?.name) === itemName);
}

// 玩家当前持有哪几把安全屋钥匙（供 UI/调试展示）。
export function ownedSafeHouseKeys(inv) {
  return SAFE_HOUSE_KEYS.filter(k => invHasItemNamed(inv, k.name)).map(k => k.name);
}

// 集齐四宅钥匙的奖励：土司礼服（橙档护甲，七维各+1）。
// 不进百物录 catalog——它是独一份的任务奖励，不想让 AI 在物件志里看见后随机发。
// 只在「四宅家产」任务完成时由 makeTusiRobe 现造一件入袋（见 MudRPG 的 watcher）。
export function makeTusiRobe() {
  return makeItem({
    name: "土司礼服",
    category: "armor",
    quality: "橙",
    sixDim: { 根骨: 1, 悟性: 1, 体魄: 1, 魅力: 1, 智谋: 1, 身法: 1, 气运: 1 },
    desc: "集齐曲措乡四宅钥匙后有人相赠的一套土司礼服。藏锦织就，金线滚边，胸前一枚小小的四曲交汇纹。穿上它，你便不再是个无名的过路人——四份家产在握，是有产有业的人了。",
  });
}

// 某据点的安全屋是否已对玩家开放。
export function isSafeHouseOpen(districtName, inv) {
  const h = SAFE_HOUSES.find(x => x.district === districtName);
  return !!h && invHasItemNamed(inv, h.keyName);
}
