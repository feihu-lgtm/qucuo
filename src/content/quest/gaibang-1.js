import a from "./gaibang-1a.js";
import b from "./gaibang-1b.js";

export default { quest: { ...a.quest, ...b.quest } };
export * from "./gaibang-1-shared.js";
