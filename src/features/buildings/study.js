// 书房与茶馆：读书 / 买书 / 听传闻。
// 从 logic.js 按动作分组拆出。
import { invalidAmountResult, noOpResult, isPositiveAmount } from "./helpers.js";
import { buildDefaultRegistry } from "../../domain/data/livingWorld/index.js";

export function readBook(_state, book) {
  if (!book?.name || !book?.topic) return noOpResult();
  return { settle: `翻开「${book.name}」细细阅读，对${book.topic}有了更多了解` };
}

export function buyBook(state, book) {
  if (!book?.name || !book.skillEntry) return noOpResult();
  if (!isPositiveAmount(book.price)) return invalidAmountResult();
  if ((state.skills || []).some((skill) => skill.id === book.skillEntry.id)) return noOpResult();
  if ((state.char.money || 0) < book.price) return noOpResult();

  return {
    changes: {
      char: { ...state.char, money: (state.char.money || 0) - book.price },
      skills: [...(state.skills || []), { ...book.skillEntry }],
    },
    settle: `购得「${book.name}」，花费${book.price}两，习得${book.skillEntry.name}`,
  };
}

const LISTEN_RUMOR_REGISTRY = buildDefaultRegistry();

export function listenToRumor(state, rumor, cost) {
  if (!rumor) return noOpResult();
  if (!isPositiveAmount(cost)) return invalidAmountResult();
  if ((state.char.money || 0) < cost) return noOpResult();
  // WO-25L 打探暗线：智谋够高，掌柜压低声多交两句底——
  // >=6 解出局势剩余天数，>=8 再解出背后的势力原委（factionHint 数据驱动）。
  let extra = "";
  const wit = state?.char?.special?.智谋 ?? state?.char?.智谋 ?? 5;
  if (wit >= 6) {
    const district = state?.room?.name;
    const cards = district ? (state?.varTree?.世界?.据点局势?.[district] || []) : [];
    const day = Math.floor((state?.time || 0) / 24);
    const active = cards.filter((c) => !(Number.isFinite(c?.expireDay) && day > c.expireDay));
    if (active.length > 0) {
      const first = active[0];
      const decl = LISTEN_RUMOR_REGISTRY.situations?.find((sit) => sit.id === first.id);
      const lines = [];
      if (Number.isFinite(first.expireDay)) {
        lines.push(`这阵势约莫还得${Math.max(1, first.expireDay - day)}天才散`);
      }
      if (wit >= 8 && typeof decl?.factionHint === "string" && decl.factionHint) {
        lines.push(decl.factionHint);
      }
      if (lines.length > 0) extra = `掌柜又压低嗓子补了句：「${lines.join("；")}。」`;
    }
  }
  return {
    changes: {
      char: (previous) => ({ ...previous, money: (previous.money || 0) - cost }),
    },
    settle: `在茶馆花${cost}两，听掌柜低声说了个传闻：「${rumor}」${extra}`,
  };
}
