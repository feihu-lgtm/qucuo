globalThis.structuredClone = globalThis.structuredClone || (v => JSON.parse(JSON.stringify(v)));
const R = await import("../src/cards/importedRegistry.js");
await R.init();

R.registerImported([
  { name: "雷纳德", brief: "北境公爵", levelCap: 4, placement: { mode: "resident", district: "锦官城", innerRoom: null } },
  { name: "米拉", brief: "灰道老板娘", levelCap: 2, placement: { mode: "wander", weights: { 天都镇: 100, 鱼定村: 25 }, timeSlot: [8, 20] } },
  { name: "通天教主", brief: "截教之主", levelCap: 5, placement: { mode: "mention" } },
  { name: "配置有误甲", brief: "驻场但没选据点", placement: { mode: "resident" } },
  { name: "配置有误乙", brief: "游走但没给权重", placement: { mode: "wander", weights: {} } },
], { cardName: "测试" });

console.log("=== normalizePlacement 降级 ===");
for (const n of ["雷纳德", "米拉", "通天教主", "配置有误甲", "配置有误乙"]) {
  const c = R.listImported().find(x => x.name === n);
  console.log(`  ${n.padEnd(6)} → ${c.placement.mode}${c.placement.district ? " @" + c.placement.district : ""}`);
}

console.log("\n=== 驻场：只在指定据点出现 ===");
for (const d of ["锦官城", "鱼定村", "天都镇"]) {
  const got = R.getImportedForDistrict(d, 10, () => 0);
  console.log(`  ${d.padEnd(5)} → ${got.map(x => x.name).join("、") || "无"}`);
}

console.log("\n=== 游走：权重与时段 ===");
console.log("  天都镇 权重100 时辰10（在 8-20 内）→", R.getImportedForDistrict("天都镇", 10, () => 0.5).map(x=>x.name).join("、") || "无");
console.log("  天都镇 权重100 时辰23（超出时段）  →", R.getImportedForDistrict("天都镇", 23, () => 0.5).map(x=>x.name).join("、") || "无");
console.log("  鱼定村 权重25 抽到0.1（命中）     →", R.getImportedForDistrict("鱼定村", 10, () => 0.1).map(x=>x.name).join("、") || "无");
console.log("  鱼定村 权重25 抽到0.9（未中）     →", R.getImportedForDistrict("鱼定村", 10, () => 0.9).map(x=>x.name).join("、") || "无");

console.log("\n=== 幽灵过滤名单（只含驻场者）===");
console.log(" ", R.getImportedResidentNames().join("、") || "无");

console.log("\n=== 转换出的字段（要能过 toRoomNpcWithCombat 白名单）===");
const lei = R.getImportedForDistrict("锦官城", 10, () => 0)[0];
console.log(" ", JSON.stringify(lei));

console.log("\n=== npcLore 形状 ===");
const lore = R.getImportedNpcLore().find(x => x.name === "雷纳德");
console.log(" ", JSON.stringify(lore).slice(0, 120));
