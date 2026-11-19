import { expect, it } from "vitest";
import { switchCompanion } from "./logic.js";

it.each([["asuka", "明日香"], ["snowLeopard", "雪豹"], [null, null], ["missing", "雪豹"]])("switches the single active companion: %s", (key, label) => {
  const companionState = { asuka: { active: false }, snowLeopard: { active: true } };
  const result = switchCompanion({ companionState }, key);
  const next = result.changes.companionState(companionState);
  expect(next.asuka.active).toBe(key === "asuka");
  expect(next.snowLeopard.active).toBe(key === "snowLeopard");
  expect(companionState.snowLeopard.active).toBe(true);
  expect(result.logs).toEqual([{ t: "sys", text: label ? `  （${label}跟上了。）` : "  （让他们都留守了。）" }]);
});

it("handles an empty companion roster", () => {
  expect(switchCompanion({ companionState: {} }, null).changes.companionState({})).toEqual({});
});
