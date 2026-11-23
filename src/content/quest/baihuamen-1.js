import a from "./baihuamen-1a.js";
import b from "./baihuamen-1b.js";

export default { quest: { ...a.quest, ...b.quest } };
export * from "./baihuamen-1-shared.js";
