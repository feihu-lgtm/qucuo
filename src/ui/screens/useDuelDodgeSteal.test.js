import { describe, expect, it } from "vitest";
import { addTeamDodgeStealNotes } from "./useDuelDodgeSteal.js";

const owner = { id: "元朵朵", carriedItems: [{ name: "金叶子" }] };
const dodge = (actor, target, side) => ({
  actor: { id: actor }, target: { id: target },
  result: { notes: [], dodgeSuccessA: side === "A", dodgeSuccessB: side === "B" },
});

describe("团战闪避偷窃", () => {
  it("闪过随从时不从主敌身上摸东西，闪过主敌才偷", () => {
    const calls = [];
    const trySteal = (_move, items) => (calls.push(items), items[0]);
    const vsServant = dodge("铁伯", "player", "B");
    const vsOwner = dodge("元朵朵", "player", "B");
    addTeamDodgeStealNotes([vsServant, vsOwner], "player", { stealOnDodge: 1 }, owner, trySteal);
    expect(calls).toHaveLength(1);
    expect(vsServant.result.notes).toEqual([]);
    expect(vsOwner.result.notes).toEqual(["顺手摸走了金叶子"]);
  });
});
