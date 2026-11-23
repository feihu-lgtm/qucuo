import a from "./xueshan-1a.js";
import b from "./xueshan-1b.js";

export default { quest: { ...a.quest, ...b.quest } };
export * from "./xueshan-1-shared.js";
