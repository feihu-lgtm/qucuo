import { ITEM_CATEGORY } from "../../rules/economy/equipment.js";

export const shopsB = {  鱼定商号: {
    shopName: "鱼定商号",
    items: [
      { name: "制式长刀", category: ITEM_CATEGORY.WEAPON, quality: "白" },
      { name: "皮甲背心", category: ITEM_CATEGORY.ARMOR, quality: "白" },
      { name: "藏银手镯", category: ITEM_CATEGORY.ACCESSORY, quality: "白" },
      { name: "精铁短刀", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "牛皮软甲", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
      { name: "青金石吊坠", category: ITEM_CATEGORY.ACCESSORY, quality: "绿" },
      { name: "三曲炒面干粮袋", category: ITEM_CATEGORY.MISC, quality: "绿", minRep: 15 },
      { name: "雅江细盐包", category: ITEM_CATEGORY.MISC, quality: "绿", minRep: 15 },
      { name: "熊山猎手短刃", category: ITEM_CATEGORY.WEAPON, quality: "蓝", minRep: 40 },
      { name: "藏银避瘴符", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", minRep: 40 },
      { name: "熊山活血药膏", category: ITEM_CATEGORY.MISC, quality: "紫", minRep: 80 },
      { name: "三曲通商路引", category: ITEM_CATEGORY.ACCESSORY, quality: "紫", minRep: 100, limitOnce: true },
    ],
  },

  // ── 护镖站（防身器具） ──
  护镖站: {
    shopName: "护镖站防身铺",
    items: [
      { name: "防刺护甲", category: ITEM_CATEGORY.ARMOR, quality: "白" },
      { name: "短匕首", category: ITEM_CATEGORY.WEAPON, quality: "白" },
      { name: "行脚皮靴", category: ITEM_CATEGORY.ARMOR, quality: "白" },
    ],
  },

  // ── 达磨药堂（喇嘛庙势力药堂）──
  // 货单照合稿「喇嘛庙·六、商城设计」10 件：前 4 件常规药剂无门槛，15/40/80 阶梯解锁；
  // 千年雪莲回天丹合稿写 ≥140（一代尊宿），引擎声誉封顶 100，取 100，每局限量 3 颗。拒售规则在 factionShop.js。
  达磨药堂: {
    shopName: "达摩药堂",
    items: [
      { name: "高原酥油膏", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "藏青稞健脾散", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "藏红花活血丸", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "达摩驱寒膏", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "药渍麻布僧袍", category: ITEM_CATEGORY.ARMOR, quality: "绿", minRep: 15 },
      { name: "青竹护法短杖", category: ITEM_CATEGORY.WEAPON, quality: "绿", minRep: 15 },
      { name: "雪莲清毒丸", category: ITEM_CATEGORY.MISC, quality: "蓝", minRep: 40 },
      { name: "老山檀香护心珠", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", minRep: 40 },
      { name: "白塔铜鎏金降魔杵", category: ITEM_CATEGORY.WEAPON, quality: "紫", minRep: 80 },
      { name: "千年雪莲回天丹", category: ITEM_CATEGORY.MISC, quality: "橙", minRep: 100, limit: 3 },
    ],
  },

  // ── 孟记铁铺 ──
  孟记铁铺: {
    shopName: "孟记铁铺",
    items: [
      { name: "精铁长剑", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "精铁短刀", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "精铁护手", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
      { name: "链甲背心", category: ITEM_CATEGORY.ARMOR, quality: "蓝" },
      { name: "铁甲腕护", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
    ],
  },

  // ── 天都镖局 ──
  天都镖局: {
    shopName: "天都镖局防身铺",
    items: [
      { name: "防刺护甲", category: ITEM_CATEGORY.ARMOR, quality: "白" },
      { name: "短匕首", category: ITEM_CATEGORY.WEAPON, quality: "白" },
      { name: "铁甲腕护", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
      { name: "皮甲头盔", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
    ],
  },

  // ── 玉器轩 ──
  玉器轩: {
    shopName: "玉器轩",
    items: [
      { name: "翡翠玉佩", category: ITEM_CATEGORY.ACCESSORY, quality: "绿" },
      { name: "碧玉扳指", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝" },
      { name: "藏银嵌绿松镯", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝" },
      { name: "白玉如意", category: ITEM_CATEGORY.ACCESSORY, quality: "紫" },
    ],
  },

  // ── 天下商行 ──
  天下商行: {
    shopName: "天下商行",
    items: [
      { name: "制式长刀", category: ITEM_CATEGORY.WEAPON, quality: "白" },
      { name: "精铁长剑", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "青钢斩马刀", category: ITEM_CATEGORY.WEAPON, quality: "蓝" },
      { name: "皮甲背心", category: ITEM_CATEGORY.ARMOR, quality: "白" },
      { name: "链甲背心", category: ITEM_CATEGORY.ARMOR, quality: "蓝" },
      { name: "银镶玉戒", category: ITEM_CATEGORY.ACCESSORY, quality: "绿" },
      { name: "赤金臂钏", category: ITEM_CATEGORY.ACCESSORY, quality: "紫" },
    ],
  },

  // ── 锦官镖局 ──
  锦官镖局: {
    shopName: "锦官镖局防身铺",
    items: [
      { name: "精铁护手", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
      { name: "链甲背心", category: ITEM_CATEGORY.ARMOR, quality: "蓝" },
      { name: "制式腰刀", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "铁叶护甲", category: ITEM_CATEGORY.ARMOR, quality: "蓝" },
    ],
  },

  // ── 云锦成衣铺 ──
  云锦成衣铺: {
    shopName: "云锦成衣铺",
    items: [
      { name: "藏地棉袍", category: ITEM_CATEGORY.ACCESSORY, quality: "白" },
      { name: "锦缎外袍", category: ITEM_CATEGORY.ACCESSORY, quality: "绿" },
      { name: "暗花云缎长衫", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝" },
      { name: "织金霞帔", category: ITEM_CATEGORY.ACCESSORY, quality: "紫" },
    ],
  },

  // ── 金玉行 ──
  金玉行: {
    shopName: "金玉行",
    items: [
      { name: "翠玉手串", category: ITEM_CATEGORY.ACCESSORY, quality: "紫" },
      { name: "赤金蟠龙佩", category: ITEM_CATEGORY.ACCESSORY, quality: "橙" },
      { name: "星月玉冠", category: ITEM_CATEGORY.ACCESSORY, quality: "紫" },
      { name: "乌木嵌金护腕", category: ITEM_CATEGORY.ACCESSORY, quality: "橙" },
    ],
  },

  // ── 天都香行（欢喜教，合稿·欢喜教 6.1）：明面 6 件 + 暗柜 6 件，按欢喜教声誉上架；
  // 天竺莲纹短刃合稿门槛 140，声誉封顶 100，改为拜入且声誉 100、限购一件。
  天都香行: {
    shopName: "天都香行",
    items: [
      { name: "滇南安神香", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "云南沉水香块", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "牧民解羊弯刀", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "靛青香行长衫", category: ITEM_CATEGORY.ARMOR, quality: "绿" },
      { name: "藏红花香囊", category: ITEM_CATEGORY.ACCESSORY, quality: "绿" },
      { name: "醒神草药茶", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "三息醉香粉", category: ITEM_CATEGORY.MISC, quality: "蓝", minRep: 15 },
      { name: "缅银吹香筒", category: ITEM_CATEGORY.WEAPON, quality: "蓝", minRep: 15 },
      { name: "大理素锦软绫衣", category: ITEM_CATEGORY.ARMOR, quality: "蓝", minRep: 40 },
      { name: "紫檀秘香囊", category: ITEM_CATEGORY.ACCESSORY, quality: "紫", minRep: 40 },
      { name: "极品金创香膏", category: ITEM_CATEGORY.MISC, quality: "紫", minRep: 80 },
      { name: "天竺莲纹短刃", category: ITEM_CATEGORY.WEAPON, quality: "橙", minRep: 100, member: true, limitOnce: true },
    ],
  },

  // ── 暗巷黑市 ──
  暗巷: {
    shopName: "暗巷黑市",
    karmaLoss: 1,
    items: [
      { name: "铁蒺藜暗器", category: ITEM_CATEGORY.WEAPON, quality: "绿" },
      { name: "见血封喉毒粉", category: ITEM_CATEGORY.MISC, quality: "蓝" },
      { name: "来路不明的玉佩", category: ITEM_CATEGORY.ACCESSORY, quality: "紫" },
      { name: "黑铁短戟", category: ITEM_CATEGORY.WEAPON, quality: "蓝" },
    ],
  },

  // ── 永丰粮行 ──
  永丰粮行: {
    shopName: "永丰粮行",
    items: [
      { name: "压缩干粮包", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "青稞饼", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "高原人参", category: ITEM_CATEGORY.MISC, quality: "蓝" },
    ],
  },

  // 百花暗阁（天都镇·百花暖棚拐角，掌柜花婆）。合稿 6.1 货单十件：
  // minRep 0/15/40/80/100（合稿写 140，引擎声誉封顶 100）。「百花净毒露」在册，不重复建物。
  百花暗阁: {
    shopName: "百花暗阁",
    items: [
      { name: "玫瑰花酿", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "祛瘴花茶", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "苗银花簪刺", category: ITEM_CATEGORY.WEAPON, quality: "绿", minRep: 0 },
      { name: "百草解瘴散", category: ITEM_CATEGORY.MISC, quality: "蓝", minRep: 15 },
      { name: "苗疆软皮护腕", category: ITEM_CATEGORY.ARMOR, quality: "蓝", minRep: 15 },
      { name: "百花软筋粉", category: ITEM_CATEGORY.MISC, quality: "蓝", minRep: 40 },
      { name: "素银易容粉盒", category: ITEM_CATEGORY.ACCESSORY, quality: "蓝", minRep: 40 },
      { name: "金丝软银鞭", category: ITEM_CATEGORY.WEAPON, quality: "紫", minRep: 80 },
      { name: "百花净毒露", category: ITEM_CATEGORY.MISC, quality: "紫", minRep: 80 },
      { name: "金蚕母蛊囊", category: ITEM_CATEGORY.ACCESSORY, quality: "橙", minRep: 100, limitOnce: true },
    ],
  },
  // ── 门派商坊（雪山派）。功德货币改银两，照合稿 §8.1 统一「银两+势力声誉折扣/门槛」；
  // 货单照合稿 6.2 十件：白绿无门槛、蓝品 15、紫品 40、千年冰魄莲 80、霜纹寒玉剑 100（合稿 140，引擎封顶 100）。
  门派商坊: {
    shopName: "雪山派门派商坊",
    items: [
      { name: "雪山姜枣干粮", category: ITEM_CATEGORY.MISC, quality: "白" },
      { name: "寒岭冻伤膏", category: ITEM_CATEGORY.MISC, quality: "绿" },
      { name: "雪松木剑", category: ITEM_CATEGORY.WEAPON, quality: "白" },
      { name: "雪山素棉袍", category: ITEM_CATEGORY.ARMOR, quality: "绿", minRep: 0 },
      { name: "寒铁细剑", category: ITEM_CATEGORY.WEAPON, quality: "蓝", minRep: 15 },
      { name: "雪莲清心丸", category: ITEM_CATEGORY.MISC, quality: "蓝", minRep: 15 },
      { name: "雪狐绒护肩", category: ITEM_CATEGORY.ARMOR, quality: "紫", minRep: 40 },
      { name: "听雪素玉佩", category: ITEM_CATEGORY.ACCESSORY, quality: "紫", minRep: 40 },
      { name: "千年冰魄莲", category: ITEM_CATEGORY.MISC, quality: "紫", minRep: 80 },
      { name: "霜纹寒玉剑", category: ITEM_CATEGORY.WEAPON, quality: "橙", minRep: 100 },
    ],
  },

};
