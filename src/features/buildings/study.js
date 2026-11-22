// 书房与茶馆：读书 / 买书 / 听传闻。
// 从 logic.js 按动作分组拆出。
import { invalidAmountResult, noOpResult, isPositiveAmount } from "./helpers.js";

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

export function listenToRumor(state, rumor, cost) {
  if (!rumor) return noOpResult();
  if (!isPositiveAmount(cost)) return invalidAmountResult();
  if ((state.char.money || 0) < cost) return noOpResult();
  return {
    changes: {
      char: (previous) => ({ ...previous, money: (previous.money || 0) - cost }),
    },
    settle: `在茶馆花${cost}两，听掌柜低声说了个传闻：「${rumor}」`,
  };
}
