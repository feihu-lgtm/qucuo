// 拜入雪山派 · 入门判定（纯函数，不碰 React 状态）
// ============================================================================
// 曲措乡此前没有任何"入门/拜派"系统——门派内容全是任务线（虎胆三重门那条），
// 弟子身份只在叙事里存在，代码里没有对应状态。这里补一套最小可用的：
// 何雨谢在内堂坐镇（掌门不在，她是实际主事的），够格的人递上束脩便可入门，
// 拿到弟子令牌——那块令牌同时也是弟子别院的钥匙。
//
// 【为什么门槛是这三条】
//   · 好感度：拜派是托付终身的事，跟一个刚照面的生人不谈这个。
//   · 内功底子：雪山派不是善堂，收的是能练的苗子，不是来蹭住处的。
//   · 束脩：江湖规矩，拜师要有个礼数。数目不大，象征意义为主。
// 三条都可调，集中放在 SECT_ENTRY 里，别散到 UI 里去。

export const SECT_ENTRY = {
  sect: "雪山派",
  master: "何雨谢",
  minAffection: 30,   // 何雨谢对玩家的好感度
  minNeigong: 5,      // 内功底子
  tuition: 100,       // 束脩（两）
  keyName: "雪山派令牌钥匙",
  flag: "雪山派弟子",  // 入门后写进 flags，供世界书/任务/叙事判断身份
};

// 玩家当前是不是雪山派弟子。
export function isSectDisciple(flags) {
  return (flags || []).includes(SECT_ENTRY.flag);
}

// 逐条检查入门资格，返回每一条的达成情况——UI 要把"差在哪"逐条摊开给玩家看，
// 只回一个 false 玩家不知道该去补什么。
export function checkSectEntry({ affection = 0, neigong = 0, money = 0, flags = [] } = {}) {
  const already = isSectDisciple(flags);
  const reqs = [
    {
      key: "affection",
      label: `${SECT_ENTRY.master}的认可（好感度 ≥ ${SECT_ENTRY.minAffection}）`,
      have: affection, need: SECT_ENTRY.minAffection, ok: affection >= SECT_ENTRY.minAffection,
    },
    {
      key: "neigong",
      label: `内功底子（内功 ≥ ${SECT_ENTRY.minNeigong}）`,
      have: neigong, need: SECT_ENTRY.minNeigong, ok: neigong >= SECT_ENTRY.minNeigong,
    },
    {
      key: "tuition",
      label: `束脩（银 ${SECT_ENTRY.tuition} 两）`,
      have: money, need: SECT_ENTRY.tuition, ok: money >= SECT_ENTRY.tuition,
    },
  ];
  return {
    already,
    reqs,
    eligible: !already && reqs.every(r => r.ok),
    missing: reqs.filter(r => !r.ok).map(r => r.key),
  };
}
