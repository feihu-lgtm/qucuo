import a from "./tianlong-3a.js";
import b from "./tianlong-3b.js";

export default { quest: { ...a.quest, ...b.quest } };
export * from "./tianlong-3-shared.js";
