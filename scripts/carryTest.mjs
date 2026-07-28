globalThis.structuredClone = globalThis.structuredClone || (v => JSON.parse(JSON.stringify(v)));
const R = await import("../src/cards/importedRegistry.js");
const { makeItemSmart } = await import("../src/items/catalog.js");
const { makeItem } = await import("../src/equipment.js");
const makeGameItem = (spec) => makeItemSmart(spec, makeItem);
await R.init(); R.clearImported();

R.registerImported([{
  name: "试造者", levelCap: 3,
  carry: [
    "霜牙",                                                    // 在册物品，只给名字
    { name: "青楼旧账簿", category: "misc", quality: "绿",
      desc: "边角被水浸过，字迹晕成一团。", sixDim: { 智谋: 2 }, custom: true },
    { name: "无名钝刀", category: "weapon", quality: "白", custom: true },
  ],
  placement: { mode: "resident", district: "锦官城" },
}], {});

const got = R.getImportedForDistrict("锦官城", 10, () => 0)[0];
console.log("归一后的 carry：");
for (const c of got.carry) console.log("  ", JSON.stringify(c));

console.log("\n过 makeGameItem 之后（这是运行时真正拿到的东西）：");
for (const c of got.carry) {
  const it = makeGameItem({ name: c.name, category: c.category || "misc", quality: c.quality || "白", desc: c.desc, sixDim: c.sixDim });
  console.log(`   ${String(it.name).padEnd(12)} ${it.quality}档 ${String(it.category).padEnd(10)} atk=${it.atk ?? "-"} def=${it.def ?? "-"} sixDim=${JSON.stringify(it.sixDim||{})} 价=${it.price ?? "-"}`);
  if (it.name === "霜牙") console.log(`      ↑ 在册物品自动补全：${it.desc ? it.desc.slice(0,24)+"…" : "无描述"}`);
}
console.log("\n修复前会是什么样（直接传字符串数组）：");
const it = makeGameItem({ name: undefined, category: "misc", quality: "白" });
console.log("   name =", JSON.stringify(it.name), "→ 无名杂物");
