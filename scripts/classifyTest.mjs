const _ls = new Map();
globalThis.localStorage = { getItem: k => (_ls.has(k) ? _ls.get(k) : null), setItem: (k,v) => _ls.set(k,String(v)), removeItem: k => _ls.delete(k) };
globalThis.structuredClone = globalThis.structuredClone || (v => JSON.parse(JSON.stringify(v)));
const { readFileSync } = await import("fs");
const { parseCharacterCard } = await import("../src/cards/cardParse.js");
const { runClassify, peopleAfterClassify } = await import("../src/cards/cardScan.js");
const { buildStage1 } = await import("../src/cards/scanPrompts.js");
const store = await import("../src/cards/scanStore.js");
const { resetBucket } = await import("../src/cards/rateLimiter.js");
await store.init();

const cards = {
  封神异闻录: "bddc867e0c13188e.png", 断法大陆: "1_0.png",
  逐玉: "6d6aa7b14bf78914.png", 哀鸿城破: "3b1fb3666c4799b9.png", 春明子: "2.png",
};

console.log("=== 阶段1 输入量：发摘要(120字) vs 发正文(3000字上限) ===");
console.log("卡名".padEnd(14) + "条目  世界书总字  发摘要   发正文  单条最长");
for (const [n, f] of Object.entries(cards)) {
  const p = parseCharacterCard(new Uint8Array(readFileSync(`/mnt/user-data/uploads/${f}`)), { playerName: "陈狐飞" });
  const full = buildStage1(p.card, p.card.entries);
  const brief = buildStage1(p.card, p.card.entries, { perEntry: 120 });
  const tot = p.card.entries.reduce((a,e)=>a+e.length,0);
  const mx = Math.max(...p.card.entries.map(e=>e.length));
  console.log(n.padEnd(14) + String(p.card.entries.length).padStart(4)
    + String(tot).padStart(12) + String(brief.user.length).padStart(8)
    + String(full.user.length).padStart(8) + String(mx).padStart(9));
}

// mock：把机器判 unknown 的也认成 person
const target = parseCharacterCard(new Uint8Array(readFileSync("/mnt/user-data/uploads/bddc867e0c13188e.png")), { playerName: "陈狐飞" });
console.log("\n=== 认人前（机器初判）===");
console.log("  人物候选:", target.npcLoreCandidates.map(c=>c.name).join("、") || "无");
console.log("  待定    :", target.unclassified.map(u=>u.label).join("、") || "无");

const PEOPLE = new Set(["金灵圣母","三霄","通天教主","周室发祥·西岐"]);
const mock = async (cfg, sys, msgs) => {
  const n = (msgs[0].content.match(/^\[\d+\]/gm) || []).length;
  const items = target.card.entries.slice(0, n).map((e,i)=>({
    i, kind: PEOPLE.has(e.label) ? "person" : (e.kind === "unknown" ? "rule" : e.kind), why: "测试",
  }));
  return { text: JSON.stringify({ 题材:"殷周神话", 条目: items,
    同人分组: [{ 人名:"三霄娘娘", 条目: target.card.entries.filter(e=>e.label==="三霄").map(e=>e.index), why:"同一组人" }],
    多人条目: [{ i: target.card.entries.find(e=>e.label?.includes("次要"))?.index ?? 0, 人名:["元始天尊","帝辛","苏妲己"], why:"一条并列多人" }] }) };
};

resetBucket(); store.clearCard(store.fingerprintCard(target.card));
const out = await runClassify(target, mock, {}, { onProgress: p => console.log(`  [${p.kind}] ${p.msg}`) });
const people = peopleAfterClassify(target, out.kindMap, out.groups);
console.log("\n=== 认人后 ===");
console.log("  认出:", people.map(p=>`${p.name}${p.from==="ai"?"(合)":""}`).join("、"));
console.log("  题材:", out.genre, "| 多人条目:", out.multiPerson.map(m=>m.人名.join("/")).join("；"));
console.log("  entry 都带上了吗:", people.every(p=>p.entry && p.entry.length) ? "✓" : "✗ 有空的：" + people.filter(p=>!p.entry).map(p=>p.name).join(","));
console.log("\n=== 缓存：再认一次不该花调用 ===");
const again = await runClassify(target, mock, {}, {});
console.log("  calls =", again.calls, again.calls === 0 ? "✓ 走缓存" : "✗ 又花了");
