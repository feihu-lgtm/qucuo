import { REACTIONS_1 } from "./data1.js";
import { REACTIONS_2 } from "./data2.js";

const sourcePools = Object.assign({}, REACTIONS_1, REACTIONS_2);
let placeholderDrops = 0;

export const REACTION_POOLS = Object.fromEntries(
  Object.entries(sourcePools).map(([family, bands]) => [
    family,
    Object.fromEntries(Object.entries(bands).map(([band, fragments]) => [
      band,
      fragments.filter((fragment) => {
        if (!/\{(?:actor|move)\}/.test(fragment)) return true;
        placeholderDrops += 1;
        return false;
      }),
    ])),
  ]),
);

export const REACTION_PLACEHOLDER_DROPS = placeholderDrops;
