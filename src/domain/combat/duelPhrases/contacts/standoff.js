const expand = (left, right, render) => left.flatMap((a) => right.map((b) => render(a, b)));

export const STANDOFF_FRAGMENTS = expand(
  ["双方", "二人", "两人", "两道身影", "两边", "攻守之间", "一来一往", "彼此", "场中", "二人之间"],
  ["对峙片刻", "互相试探", "各守门户", "静待破绽", "气机相持", "步步相逼"],
  (a, b) => `${a}${b}`,
);
