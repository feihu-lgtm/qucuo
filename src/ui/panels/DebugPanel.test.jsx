import { describe, expect, it, vi } from "vitest";
import { bar } from "../../utils/mudHelpers.js";
import DebugPanel from "./DebugPanel.jsx";

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal(),
  useState: (initial) => [initial, vi.fn()],
}));

function inputs(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(inputs);
  return [...(node.type === "input" ? [node] : []), ...inputs(node.props?.children)];
}

describe("debug martial skill inputs", () => {
  it.each(["waigong", "neigong"])("clamps %s to the game's integer 0–100 range", (stat) => {
    let char = { waigong: 27, neigong: 38 };
    const tree = DebugPanel({
      char, setChar: (update) => { char = update(char); },
      zoneTheme: {}, dao: {}, varTree: {}, narrator: {}, room: { npcs: [] },
    });
    const input = inputs(tree).find((node) => node.props.value === char[stat]);
    for (const [value, expected] of [["250", 100], ["-5", 0], ["42.7", 42], ["", 0], ["invalid", 0]]) {
      input.props.onChange({ target: { value } });
      expect(char[stat]).toBe(expected);
    }
  });
});

describe("rendered text bars", () => {
  it.each([
    [250, 100, 6, "██████"],
    [-5, 100, 6, "░░░░░░"],
    [50, 100, 6, "███░░░"],
    [50, 0, 6, "░░░░░░"],
    [NaN, 100, 6, "░░░░░░"],
    [Infinity, 100, 6, "░░░░░░"],
    [50, Infinity, 6, "░░░░░░"],
    [50, 100, 6.5, "███░░░"],
    [50, 100, -1, ""],
    [50, 100, NaN, ""],
    [0, 100, 0, ""],
  ])("safely renders %s/%s at width %s", (value, max, width, expected) => {
    expect(bar(value, max, width)).toBe(expected);
  });
});
