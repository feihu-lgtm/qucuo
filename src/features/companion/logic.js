import { setActiveCompanion } from "../../domain/rules/companion/companion.js";

export function switchCompanion(state, key) {
  const label = key ? (key === "asuka" ? "明日香" : "雪豹") : null;
  return {
    changes: { companionState: cs => setActiveCompanion(cs, key) },
    logs: [{ t: "sys", text: label ? `  （${label}跟上了。）` : "  （让他们都留守了。）" }],
  };
}
