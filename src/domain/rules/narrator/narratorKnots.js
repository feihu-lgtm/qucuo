// 心灵之海 · 三个心结 + 一个内核（从 narratorQuest.js 拆出，纯函数）
// ============================================================================
import { emptyComfort, defenseLevelOf } from "./comfortRules.js";

// ── 三个心结 + 一个内核 ─────────────────────────────────────────────────
// order 决定解锁顺序（不可跳）；maxLevel 是"心防降到这一级以下她才肯说"。
// 母亲那条放最后，是刻意的——最亲近的伤最后才碰得。
// 【为什么心结除了心防还要 needs】
// 只看 defenseLevel 的话，光靠"说句话"刷 30 次就能把心防推到 0、三条心结全开——
// 药、蛋糕、抱、亲这四个动作等于白设计，玩家也不会去用。
// 所以每条心结再加一条"必须真的用对过方式"：她凭什么跟你说母亲的事？
// 因为你抱过她。不是因为你话多。
// needs 里每一项是"这一类安抚至少做过几次"，只要求最低限，不逼玩家凑数。
export const KNOTS = [
  {
    key: "hebe",
    order: 1,
    maxLevel: 4,
    // 第一条：肯开口就够了，不需要肢体接触——那时候她还不让你碰
    needs: { verbal: 2 },
    title: "他没有回头",
    // 给 AI 的引导：她说这条时刻薄、装作不在乎，越刻薄越说明在乎。
    guide: `她会先松口的是这一条。有个人，她曾经等过很久。她把自己收拾得漂漂亮亮去见他，
他没有看见她——或者看见了，没当一回事。
她提起这件事时刻薄、轻描淡写、带着讥笑，一边说一边强调"我早不在乎了"。
越是轻描淡写，越要让读者看出她在乎。她不会说出那个人的名字。`,
  },
  {
    key: "corner",
    order: 2,
    maxLevel: 3,
    // 第二条：得让她吃下点东西或者吃了药——身体先松了，那段才说得出口
    needs: { verbal: 3, soothing: 1 },
    title: "墙角",
    guide: `小时候的事。一群人，一个墙角。她记得墙是凉的，记得自己没有哭。
她说这件事时**异常平静**，平静得不对劲——"那没什么。谁小时候没被人推过。"
不要写她激动，要写那种把事情说得太轻的平静。她可能会突然换个话题，
或者反问玩家"你问这个干什么"。`,
  },
  {
    key: "doll",
    order: 3,
    maxLevel: 2,
    // 第三条（母亲）：必须抱过她。她凭什么跟你说这个？因为你抱过她，不是因为你话多。
    needs: { hug: 1, soothing: 1 },
    title: "她看着那个布偶",
    guide: `最难开口的一条，是关于母亲的。她记得母亲手里有个布偶，
记得母亲对着那个布偶说话，语气温柔——**不对她说**。
她讲这一段会中断、会改口、会说到一半突然"算了，不说了"，会问"我们能不能说点别的"。
不要让她一口气讲完，也不要给她任何总结或想通。
她提到母亲时不用"母亲"这个词，只说"那个女人""她"。`,
  },
];

export const CORE_KNOT = {
  key: "core",
  title: "我要有人说我厉害",
  guide: `这是三条心结共同通向的根：他不回头、那个女人不看她、那些人推她——
所以她必须是最强的，强到没有人可以不看她。
**她自己说不出这句话。** 她只会反复说"我很厉害""我是最强的"。
必须由玩家把这层意思点破，她才会承认，而且是不情愿地、带着"你懂什么"的口气承认。`,
};

export const KNOT_BY_KEY = Object.fromEntries([...KNOTS, CORE_KNOT].map(k => [k.key, k]));

// needs 里的 soothing 是「药或蛋糕」的合称——两者都是"让身体先松下来"这一类，
// 不必强求玩家两样都用。
function needsMet(needs, comfort) {
  if (!needs) return true;
  const c = { ...emptyComfort(), ...(comfort || {}) };
  const got = { ...c, soothing: (c.medication || 0) + (c.food || 0) };
  return Object.entries(needs).every(([k, n]) => (got[k] || 0) >= n);
}

// 此刻哪些心结已解锁（按顺序 + 心防门槛 + 是否用对过方式）。
// 顺序不可跳：前一条没说出来，后一条即便心防够低也不开。
export function availableKnot(comfort, spokenKeys = []) {
  const level = defenseLevelOf(comfort);
  for (const k of KNOTS) {
    if (spokenKeys.includes(k.key)) continue;
    if (level > k.maxLevel) return null;      // 心防还太高，这一条也就是下一条，等着
    if (!needsMet(k.needs, comfort)) return null; // 心防够了但方式不对，也还开不了
    return k;                                // 顺序上轮到它、门槛与方式都够，就是它
  }
  return null; // 三条都说完了
}

// 三条说完 + 心防 ≤1 → 可以点破内核并给承诺
export { needsMet };

export function canResolve(comfort, spokenKeys = []) {
  return KNOTS.every(k => spokenKeys.includes(k.key)) && defenseLevelOf(comfort) <= 1;
}

