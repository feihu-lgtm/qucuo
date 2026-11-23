import a from "./wuxianjiao-1a.js";
import b from "./wuxianjiao-1b.js";

export default { quest: { ...a.quest, ...b.quest } };
export * from "./wuxianjiao-1-shared.js";
