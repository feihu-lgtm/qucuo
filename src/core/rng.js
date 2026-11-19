// Mulberry32. The unsigned 32-bit state is sufficient to resume the sequence.
export function createRng(seed) {
  let state = seed >>> 0;

  function random() {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 2 ** 32;
  }

  function setSeed(seed) {
    state = seed >>> 0;
  }

  function getRngState() {
    return state;
  }

  // Missing or invalid saved state leaves the generator untouched.
  function setRngState(savedState) {
    if (!Number.isInteger(savedState) || savedState !== (savedState >>> 0)) return false;
    state = savedState;
    return true;
  }

  return { random, setSeed, getRngState, setRngState };
}

export const { random, setSeed, getRngState, setRngState } = createRng(Date.now());
