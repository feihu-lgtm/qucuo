import a from "./lamamiao-1a.js";
import b from "./lamamiao-1b.js";

export default { quest: { ...a.quest, ...b.quest } };
export * from "./lamamiao-1-shared.js";
