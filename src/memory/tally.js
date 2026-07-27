// 起居注 · 行动计数（纯函数）
// ============================================================================
// 【为什么要这个】
// 玩家的动作分两种：走 AI 的（act 一轮，AI 产 p.memory，进小纸条/事实账本/日总结原料）
// 和**不走 AI 的**（内层移动、打坐、安抚、装备、捡地上的东西、换队友……）。
// 后者此前**等于没发生过**：一件都不留痕，日总结拿不到这些素材，旁白也无从知道
// "这笨蛋今天在村里来回走了十二趟"。
//
// 但也不能给它们每件都配一条 AI 摘要——那是高频动作，一天几十次，
// 烧调用不说，还会把真正重要的那几条事实冲淡。
//
// 【做法】走 AI 的照旧走 AI（memory 不动）；不走 AI 的只**记数**：
//   今日  当前这一整天（24 回合）之内的次数，跨天自动清零
//   累计  开局以来的总次数，永不清零
// 计数极便宜（一个整数），却足够给叙事上色："今日打坐三回""累计走了四百段路"。
// 两个视野各有各的用处：今日供旁白当天叙事引用，累计供年鉴/成就/日记回顾。
//
// 【为什么两种都记】
// 走 AI 的也记数——不是为了替代 memory，而是为了让"这一天做了多少事"这个量是全的。
// 只记非 AI 的，日总结里就会出现"今天什么都没干"却实际打了三场架的怪事。

// 动作种类登记表。aiBacked 只是标注（说明这一类另有 memory 落在别处），
// 不影响计数行为——两种都记。
export const TALLY_KINDS = {
  // ── 不走 AI（此前完全无痕）──
  innerMove:   { label: "在据点内走动", aiBacked: false },
  meditate:    { label: "打坐调息",     aiBacked: false },
  equipToggle: { label: "更换装备",     aiBacked: false },
  pickGround:  { label: "拾取地上之物", aiBacked: false },
  comfort:     { label: "安抚旁白",     aiBacked: false },
  companionSwitch: { label: "更换同行", aiBacked: false },
  seaEnter:    { label: "进出心灵之海", aiBacked: false },
  // ── 走 AI（另有 memory，这里只补一个量）──
  action:      { label: "行动",     aiBacked: true },
  talk:        { label: "与人说话", aiBacked: true },
  whisper:     { label: "私聊旁白", aiBacked: true },
  settle:      { label: "结算事务", aiBacked: true },
  duel:        { label: "切磋",     aiBacked: true },
};

export const DAY_TURNS = 24; // 与 MudRPG 的跨天侦测一致：24 回合 = 1 天

export function emptyTally() {
  return { today: {}, lifetime: {}, dayStamp: 0 };
}

export function dayOf(time) {
  return Math.floor((Number(time) || 0) / DAY_TURNS);
}

// 记一次。time 用来判跨天——**跨天在写入时就地滚**，不依赖任何外部 effect 来清零。
// 【为什么在写入时滚而不是靠 effect】effect 有可能因为组件卸载/存档读取时序而漏跑一次，
// 漏一次就会把昨天的数混进今天，而且没人会发现。写入时判最稳：只要还在记数，
// 日界就一定是对的。
export function tallyAdd(tally, kind, time, n = 1) {
  const cur = { ...emptyTally(), ...(tally || {}) };
  if (!TALLY_KINDS[kind]) return cur;         // 未登记的种类一律忽略，避免拼错字段污染
  const inc = Number(n) || 0;
  if (inc <= 0) return cur;

  const d = dayOf(time);
  const today = d === cur.dayStamp ? { ...cur.today } : {};   // 跨天：今日清零
  today[kind] = (today[kind] || 0) + inc;
  const lifetime = { ...cur.lifetime };
  lifetime[kind] = (lifetime[kind] || 0) + inc;
  return { today, lifetime, dayStamp: d };
}

// 读今日（自动处理"上次记数是昨天"的情况：那今天就是空的）
export function tallyToday(tally, time) {
  const cur = { ...emptyTally(), ...(tally || {}) };
  return dayOf(time) === cur.dayStamp ? cur.today : {};
}

export function tallyLifetime(tally) {
  return { ...emptyTally(), ...(tally || {}) }.lifetime;
}

const sumOf = (obj) => Object.values(obj || {}).reduce((a, b) => a + (Number(b) || 0), 0);

// 给 AI 看的一行（进 ctx）。只报今日、只报有数的、按次数降序，最多几项——
// 这是给叙事上色的调料不是账本，铺开反而喧宾夺主。
// 刻意不报累计：累计是给玩家看的年鉴，AI 每轮读它没有意义。
export function describeTodayForAI(tally, time, max = 5) {
  const t = tallyToday(tally, time);
  const items = Object.entries(t)
    .filter(([k, v]) => TALLY_KINDS[k] && v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k, v]) => `${TALLY_KINDS[k].label}${v}次`);
  if (!items.length) return "";
  return `\n[今日行迹] ${items.join("、")}`;
}

// 给日总结当原料的一行（跨天时随当日原料一起交给 summarizeDay）
export function describeDayForSummary(tally, time) {
  const t = tallyToday(tally, time);
  const total = sumOf(t);
  if (!total) return "";
  const items = Object.entries(t)
    .filter(([k, v]) => TALLY_KINDS[k] && v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${TALLY_KINDS[k].label}${v}次`);
  return `这一日共动作${total}次：${items.join("、")}。`;
}

// 给玩家看的年鉴（累计，全量、按次数降序）
export function describeLifetime(tally) {
  const l = tallyLifetime(tally);
  return Object.entries(l)
    .filter(([k, v]) => TALLY_KINDS[k] && v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ key: k, label: TALLY_KINDS[k].label, count: v, aiBacked: TALLY_KINDS[k].aiBacked }));
}

export function tallyTotals(tally, time) {
  return { today: sumOf(tallyToday(tally, time)), lifetime: sumOf(tallyLifetime(tally)) };
}
