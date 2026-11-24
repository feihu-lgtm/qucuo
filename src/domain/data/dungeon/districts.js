// 十宫配置数据（设计稿 docs/设计_地宫内层地图.md B 节，3.1pro 写实版 v4）。
// 字段约定（genMap.js / envTags.js / puzzles.js 消费）：
//   anchor: 入口锚点房名；prefixPool/suffixPool: 房名前后缀库；descPool: desc 模板（{name} 插值）
//   envTag: ENV_TAG_HANDLERS 键名；puzzle: {type: sequenceReset|recipeCraft|pushPull|timedAgility, config}
//   boss: {name, desc, movesHint}；adventurerFactions: 出没倾向门派；
//   branchRate/loopRate: 生成参数；eventSeeds: 十类互动落位压缩成可配置事件 {kind,desc,check,dc,outcome}
// 纯数据无逻辑。

export const DUNGEON_DISTRICTS = Object.freeze({
  白塔地宫: {
    anchor: "塔底佛殿",
    envTag: "baitaPrayerWheel",
    prefixPool: ["金漆", "蒙尘", "酥油", "密宗", "梵音"],
    suffixPool: ["经阁", "甬道", "禅房", "佛窟", "壁画廊"],
    descPool: ["{name}四壁绘满经变故事，酥油灯影摇曳。", "{name}经筒成排，铜铃在风里轻响。"],
    boss: { name: "盲眼护法老僧", desc: "大日如来主窟的听声辨位武僧。", movesHint: "听音掌/金钟罩" },
    puzzle: { type: "sequenceReset", config: { items: ["割肉", "喂鹰", "成佛"], stat: "wisdom", dc: 6, prompt: "打乱的本生故事唐卡需按剧情顺序重挂" } },
    adventurerFactions: ["峨眉", "少林", "散人"],
    branchRate: 0.35, loopRate: 0.15,
    eventSeeds: [
      { kind: "fight", desc: "护法武僧巡廊遭遇战", check: "combat", dc: 6, outcome: "胜得武学残页" },
      { kind: "event", desc: "踩中翻板跌落下层", check: "agility", dc: 6, outcome: "失败掉血跌至下层房" },
      { kind: "nsfw", desc: "酥油催情香中的峨眉女侠", check: "inner", dc: 5, outcome: "运功逼毒或趁人之危分支" },
      { kind: "supply", desc: "禅房搜刮金疮药", check: null, dc: 0, outcome: "补给若干" },
      { kind: "loot", desc: "死路佛龛开出武学残页", check: "craft", dc: 7, outcome: "品阶装备" },
      { kind: "watch", desc: "暗中观察两名武僧切磋", check: "stealth", dc: 4, outcome: "得招式感悟" },
      { kind: "meet", desc: "可雇佣的寻宝散人", check: "charm", dc: 5, outcome: "雇佣随行" },
      { kind: "appraise", desc: "鉴定古旧唐卡真伪", check: "wisdom", dc: 7, outcome: "真品得情报/赝品" },
      { kind: "puzzle", desc: "唐卡序列复位", check: "wisdom", dc: 6, outcome: "暗门开启" },
      { kind: "checkpoint", desc: "入口锚点房存档", check: null, dc: 0, outcome: "进度保存" },
    ],
  },

  大草甸子虚幻境: {
    anchor: "幻境入口草坡",
    envTag: "huanjingSpore",
    prefixPool: ["迷幻", "孢子", "斑斓", "腐生", "幽绿"],
    suffixPool: ["草甸", "泥沼", "菌林", "幽谷", "兽径"],
    descPool: ["{name}菌盖如伞，孢子在光里旋舞。", "{name}腐草沤出甜腻的迷香。"],
    boss: { name: "菇母·苗疆女刺客", desc: "以幻药御兽的毒理高手，携双毒獒。", movesHint: "幻毒粉/驭兽哨" },
    puzzle: { type: "recipeCraft", config: { recipe: { materials: ["清心草", "蛇胆"], action: "捣碎" }, materials: ["清心草", "蛇胆", "腐菌", "清水"], stat: "wisdom", dc: 6, prompt: "合成解幻药才能安全穿高浓度区" } },
    adventurerFactions: ["五毒", "合欢", "散人"],
    branchRate: 0.4, loopRate: 0.2,
    eventSeeds: [
      { kind: "fight", desc: "毒獒与劫匪", check: "combat", dc: 5, outcome: "摸包" },
      { kind: "event", desc: "毒气喷发需闪避", check: "agility", dc: 6, outcome: "中毒debuff" },
      { kind: "nsfw", desc: "致幻交媾·幻情女冒险者", check: "inner", dc: 5, outcome: "内力流失换幻境通行" },
      { kind: "supply", desc: "采集凝血草", check: null, dc: 0, outcome: "草药" },
      { kind: "loot", desc: "劫匪尸体摸包", check: "luck", dc: 4, outcome: "随机货" },
      { kind: "watch", desc: "看野猪陷入泥沼被吞", check: "stealth", dc: 3, outcome: "泥沼预警" },
      { kind: "meet", desc: "中毒的合欢宗弟子", check: "charm", dc: 5, outcome: "救治入队" },
      { kind: "appraise", desc: "辨别毒蘑菇", check: "wisdom", dc: 6, outcome: "食材/毒物" },
      { kind: "puzzle", desc: "合成解幻药", check: "wisdom", dc: 6, outcome: "高浓度区通行" },
      { kind: "checkpoint", desc: "上风口通风岩石", check: null, dc: 0, outcome: "存点" },
    ],
  },

  三星堆大墓: {
    anchor: "王陵入口青铜门",
    envTag: "sanxingduiPatrol",
    prefixPool: ["青铜", "纵目", "幽暗", "祭祀", "黄土"],
    suffixPool: ["悬廊", "深坑", "殉葬室", "甬道", "机关房"],
    descPool: ["{name}青铜纹饰森然，齿轮声在深处碾动。", "{name}纵目面具俯视来客，双目幽幽。"],
    boss: { name: "盗墓大锅头", desc: "驾齿轮油柜青铜战车喷火的首领。", movesHint: "火舌喷射/碾压" },
    puzzle: { type: "pushPull", config: { size: 3, start: { x: 0, y: 1 }, target: { x: 2, y: 1 }, stat: "strength", dc: 6, prompt: "青铜纵目面具推入卡槽拉起闸门" } },
    adventurerFactions: ["唐门", "散人", "摸金校尉"],
    branchRate: 0.35, loopRate: 0.15,
    eventSeeds: [
      { kind: "fight", desc: "盲眼地穴巨蟒/盗墓贼", check: "combat", dc: 6, outcome: "摸尸" },
      { kind: "event", desc: "青铜廊桥断裂", check: "agility", dc: 6, outcome: "跌落扣血" },
      { kind: "nsfw", desc: "机关网吊起的女飞贼可猥亵勒索", check: "craft", dc: 5, outcome: "赎金/情报" },
      { kind: "supply", desc: "盗墓贼遗留干粮", check: null, dc: 0, outcome: "干粮" },
      { kind: "loot", desc: "死路青铜宝箱", check: "craft", dc: 7, outcome: "青铜器" },
      { kind: "watch", desc: "看盗墓贼分赃内讧", check: "stealth", dc: 4, outcome: "趁乱渔利" },
      { kind: "meet", desc: "可雇佣的摸金校尉", check: "charm", dc: 5, outcome: "入队" },
      { kind: "appraise", desc: "鉴定青铜器暗记", check: "wisdom", dc: 7, outcome: "断代情报" },
      { kind: "puzzle", desc: "推拉青铜面具", check: "strength", dc: 6, outcome: "闸门升起" },
      { kind: "checkpoint", desc: "王陵入口青铜门", check: null, dc: 0, outcome: "存点" },
    ],
  },

  成都蜀王府地宫: {
    anchor: "地宫通风井口",
    envTag: "shuwangPhosphor",
    prefixPool: ["镇库", "金丝", "破败", "藩王", "阴森"],
    suffixPool: ["仪门", "宝库", "兵仗局", "享殿", "石库"],
    descPool: ["{name}鎏金残饰剥落，磷火在砖缝里明明灭灭。", "{name}藩王仪仗森列，纸甲死士垂目而立。"],
    boss: { name: "鬼王统领", desc: "披明光铠持斩马刀的无痛死士头目。", movesHint: "斩马横扫/重铠冲撞" },
    puzzle: { type: "timedAgility", config: { stat: "agility", dc: 7, prompt: "兵仗局铡刀长廊按摆动间隙穿行" } },
    adventurerFactions: ["丐帮", "散人", "锦衣残党"],
    branchRate: 0.35, loopRate: 0.15,
    eventSeeds: [
      { kind: "fight", desc: "磷火死士", check: "combat", dc: 6, outcome: "磷粉降命中" },
      { kind: "event", desc: "翻板掉进水牢", check: "agility", dc: 6, outcome: "湿身扣血" },
      { kind: "nsfw", desc: "官家女侠被俘受辱", check: "combat", dc: 6, outcome: "救人结缘/偷窥" },
      { kind: "supply", desc: "兵仗局取弩箭", check: null, dc: 0, outcome: "箭矢" },
      { kind: "loot", desc: "死路王府宝箱", check: "craft", dc: 7, outcome: "藩王库藏" },
      { kind: "watch", desc: "看死士换防", check: "stealth", dc: 4, outcome: "换防间隙图" },
      { kind: "meet", desc: "迷路的丐帮长老", check: "charm", dc: 5, outcome: "换情报" },
      { kind: "appraise", desc: "鉴定藩王玉玺材质", check: "wisdom", dc: 7, outcome: "真玺/赝品" },
      { kind: "puzzle", desc: "敏捷躲铡刀", check: "agility", dc: 7, outcome: "长廊通过" },
      { kind: "checkpoint", desc: "兵仗局锚点库房", check: null, dc: 0, outcome: "存点" },
    ],
  },

  雪山茫野: {
    anchor: "猎人木屋",
    envTag: "xueshanWindchill",
    prefixPool: ["风雪", "冰裂", "冻血", "呼啸", "苍白"],
    suffixPool: ["古战场", "绝壁", "废弃营帐", "冰窟", "雪丘"],
    descPool: ["{name}风雪漫卷，冻僵的战旗斜插在雪里。", "{name}冰面下隐隐透出冻结的人影。"],
    boss: { name: "冰封督军·康巴武士首领", desc: "吃雪莲生肉活下来的巨汉，持玄铁长戟。", movesHint: "顺风冲锋/破冰重击" },
    puzzle: { type: "recipeCraft", config: { recipe: { materials: ["雪莲汁", "牦牛脂肪"], action: "涂抹" }, materials: ["雪莲汁", "牦牛脂肪", "火镰", "碎石"], stat: "wisdom", dc: 6, prompt: "融冰膏涂抹锁芯开青铜门" } },
    adventurerFactions: ["天山", "昆仑", "散人"],
    branchRate: 0.3, loopRate: 0.1,
    eventSeeds: [
      { kind: "fight", desc: "疯癫雪人与拾荒者", check: "combat", dc: 6, outcome: "兽皮" },
      { kind: "event", desc: "冰裂隙塌陷", check: "agility", dc: 7, outcome: "坠落扣血减速" },
      { kind: "nsfw", desc: "睡袋肌肤相亲渡寒", check: "body", dc: 5, outcome: "解失温结缘" },
      { kind: "supply", desc: "伏击营地烈酒干肉", check: null, dc: 0, outcome: "御寒补给" },
      { kind: "loot", desc: "干尸怀中宝匣", check: "craft", dc: 7, outcome: "雪狐裘/残页" },
      { kind: "watch", desc: "看两派剑客雪中决斗", check: "stealth", dc: 4, outcome: "胜者剑谱" },
      { kind: "meet", desc: "寻雪莲的痴情剑客", check: "charm", dc: 5, outcome: "换秘籍" },
      { kind: "appraise", desc: "鉴定冻尸致命伤判怪物", check: "wisdom", dc: 6, outcome: "预警情报" },
      { kind: "puzzle", desc: "融冰膏开门", check: "wisdom", dc: 6, outcome: "大门开启" },
      { kind: "checkpoint", desc: "猎人木屋生火", check: null, dc: 0, outcome: "存点回暖" },
    ],
  },
});

import { DUNGEON_DISTRICTS_EXTRA } from "./districtsExtra.js";

// 十宫合并表：生成器/run 集成消费入口。
export const DUNGEON_DISTRICTS_ALL = Object.freeze({
  ...DUNGEON_DISTRICTS,
  ...DUNGEON_DISTRICTS_EXTRA,
});
