import a from "./huanxijiao-1a.js";
import b from "./huanxijiao-1b.js";

export default { quest: { ...a.quest, ...b.quest } };
export * from "./huanxijiao-1-shared.js";
