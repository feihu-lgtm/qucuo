export const FREE_BOOKS = [
  { id: "book_zangdi", name: "《藏地风物志》", topic: "藏地风俗", desc: "记录曲措乡各村寨的风俗习惯、节庆传统和民间传说，读后对本地文化有更深理解。" },
  { id: "book_jianghu", name: "《江湖小道消息》", topic: "江湖传闻", desc: "流传甚广的江湖八卦集，真假参半，但偶尔能听到几个有用的线索。" },
  { id: "book_wuxue", name: "《武学浅论》", topic: "武学基础", desc: "浅显的武学入门读物，解释了攻击、防御、状态三类招式的相互克制关系。" },
];

export const LIBRARY_BOOKS_JINGGUAN = [
  { id: "book_wuying", name: "《无影步残篇》", topic: "轻功", skillEntry: { id: "kf_wuying", name: "无影步", type: "轻功", quality: "绿", moveType: "状态", passiveBonus: { speedBonus: 1 }, level: 1, exp: 0, maxExp: 100, stage: "入门", active: false }, price: 60, desc: "残缺的轻功秘籍，缺了关键章节，但基础仍在，练成后步法灵动。" },
  { id: "book_tiezhi", name: "《铁指功》", topic: "外功", skillEntry: { id: "kf_tiezhi", name: "铁指功", type: "招式", quality: "白", moveType: "攻击", passiveBonus: null, level: 1, exp: 0, maxExp: 100, stage: "入门", active: false }, price: 30, desc: "简单粗暴的指力练习，练成后攻击招式更为凌厉。" },
];
