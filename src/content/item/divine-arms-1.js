const items = {
"霜天月": {
    name: "霜天月", category: "weapon", quality: "红", atkMul: 1.6,
    effect: { forceFirst: true, freezeEnergyRecovery: true },
    sixDim: { 身法: 3 },
    desc: "呼延大侠的佩剑。三十年前他从雪山之巅坠崖时，这把剑先他一步脱手，插在崖底冰壁上冻了三十年。剑身裹着一层永不解冻的薄霜，剑格处刻着一个“雪”字。何雨谢只见过它一次——大婚那天，呼延大侠执此剑挑开她的红盖头。",
  },
"地藏": {
    name: "地藏", category: "weapon", quality: "红", atkMul: 1.6,
    effect: { ignoreDefense: true, justiceStrike: true },
    sixDim: { 悟性: 2, 根骨: 1 },
    desc: "桑杰大侠的佩刀。他带这把刀来贡措海，本是想当着呼延大侠的面把假地契和刀一起沉进湖底——“桑杰家从此不沾兵戈”。刀没来得及沉。他死前用最后的力气把刀插进密室石壁，刀尖没入石中三寸，三十年没锈。",
  },
"不动明王杵": {
    name: "不动明王杵", category: "weapon", quality: "红", atkMul: 1.5,
    effect: { onCounterSuccessDamageRatio: 1.5, immuneControl: true, onCounterSuccessEnergyGain: 3 },
    sixDim: { 根骨: 3 },
    desc: "喇嘛庙前任经师从西域带回的法器，本是修“不动明王法”时杵地结界用的。经师去贡措海前把它留在白塔地宫，对守塔僧说：“等一个能听懂我为什么去贡措海的人。”杵身刻梵文“不动”，杵地时地面微微震动，像地下有东西在回应。",
  },
"虎啸": {
    name: "虎啸", category: "weapon", quality: "红", atkMul: 1.55,
    effect: { forceCrit: { multiplier: 1.8 }, lowHpBonus: 0.8 },
    sixDim: { 体魄: 2, 气运: 1 },
    desc: "用吊睛虎王的牙和筋制成的弓。弓胎是三十年前一具无名猎户遗骸旁的半成品，用了三十年等一根配得上的弦——虎王的筋正好。弓身是熊山老铁木，拉开时有虎啸声，方圆十里的野兽听到会四散奔逃。",
  },
"涅槃引": {
    name: "涅槃引", category: "weapon", quality: "红", atkMul: 1.4,
    effect: { selfSacrifice: { hpCost: 30, damageMultiplier: 3.5 }, rebirthOnce: true },
    sixDim: { 悟性: 3 },
    desc: "一根用凤凰木芯做的长香，前任经师游历天竺边境时从一个苦行僧手中所得。苦行僧说：“这香燃三次。第一次见你想见的人，第二次听他想说的话，第三次——你自己决定要不要跟他走。”经师只敢燃过一次，藏在了荤食地下室。",
  }
};

export default { item: items, itemGroup: { DIVINE_ARMS: Object.keys(items) } };
