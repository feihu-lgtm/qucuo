import { expect, it, vi } from "vitest";
import { birthStone, rollBidders } from "../domain/rules/economy/gambleStone.js";
import { createRng, getRngState, random, setRngState, setSeed } from "./rng.js";

const sequence = (draw) => Array.from({ length: 8 }, () => draw());

it("repeats a seed's sequence and keeps independently created generators isolated", () => {
  const seed = 42;
  const expected = sequence(createRng(seed).random);
  const independent = createRng(seed);
  setSeed(seed);
  expect(sequence(random)).toEqual(expected);
  expect(sequence(independent.random)).toEqual(expected);
  expect(sequence(createRng(7).random)).not.toEqual(expected);
  expect(expected.every((value) => value >= 0 && value < 1)).toBe(true);
});

it("resumes an isolated generator from a serialized 32-bit state", () => {
  const first = createRng(42);
  first.random();
  const checkpoint = JSON.parse(JSON.stringify(first.getRngState()));
  const resumed = createRng(7);
  expect(resumed.setRngState(checkpoint)).toBe(true);
  expect(sequence(resumed.random)).toEqual(sequence(first.random));

  expect(setRngState(0)).toBe(true);
  expect(getRngState()).toBe(0);
  expect(setRngState("0")).toBe(false);
  expect(getRngState()).toBe(0);
});

it("repeats stone outcomes and bids while keeping negotiation IDs distinct", () => {
  const clock = vi.spyOn(Date, "now");
  try {
    clock.mockReturnValue(1000);
    setSeed(42);
    const stone = birthStone("鹰曲新场");
    const bids = rollBidders(stone);

    clock.mockReturnValue(2000);
    setSeed(42);
    const repeatedStone = birthStone("鹰曲新场");
    expect(repeatedStone.id).not.toBe(stone.id);
    expect(repeatedStone).toEqual({ ...stone, id: repeatedStone.id });
    expect(rollBidders(repeatedStone)).toEqual(bids);
  } finally {
    clock.mockRestore();
  }
});
