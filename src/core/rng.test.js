import { expect, it, vi } from "vitest";
import { birthStone, rollBidders } from "../gambleStone.js";
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

it("repeats a stone and its bids when the wall clock changes", () => {
  const clock = vi.spyOn(Date, "now");
  try {
    clock.mockReturnValue(1000);
    setSeed(42);
    const stone = birthStone("鹰曲新场");
    const bids = rollBidders(stone);

    clock.mockReturnValue(2000);
    setSeed(42);
    const repeatedStone = birthStone("鹰曲新场");
    expect(repeatedStone).toEqual(stone);
    expect(rollBidders(repeatedStone)).toEqual(bids);
  } finally {
    clock.mockRestore();
  }
});
