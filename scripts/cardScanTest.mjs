// Node 里没有 localStorage / indexedDB。前者 rateLimiter 要用，polyfill 一个；
// 后者 scanStore.init 会自动降级到纯内存，不用管。
const _ls = new Map();
globalThis.localStorage = {
  getItem: k => (_ls.has(k) ? _ls.get(k) : null),
  setItem: (k, v) => _ls.set(k, String(v)),
  removeItem: k => _ls.delete(k),
};
globalThis.structuredClone = globalThis.structuredClone || (v => JSON.parse(JSON.stringify(v)));

const { readFileSync, readdirSync } = await import("fs");
const { parseCharacterCard } = await import("../src/cards/cardParse.js");
const { planScan, runScan } = await import("../src/cards/cardScan.js");
const store = await import("../src/cards/scanStore.js");
const { resetBucket, REFILL_MS } = await import("../src/cards/rateLimiter.js");

await store.init();

const dir = process.env.CARDS_DIR || "./cards-fixtures";
const cards = [];
for (const f of readdirSync(dir).filter(x => /\.png$/i.test(x)).sort()) {
  try {
    cards.push({ f, ...parseCharacterCard(new Uint8Array(readFileSync(`${dir}/${f}`)), { playerName: "陈狐飞" }) });
  } catch { /* 非卡跳过 */ }
}

console.log("=== 预算规划（asPlayer=true，批 4）===");
console.log("卡名".padEnd(16) + "人物 待定 批次  S1 S2 S3 S4 合计  预估等待");
console.log("-".repeat(64));
for (const c of cards) {
  if (!c.report.ok) { console.log((c.card.name||"?").slice(0,14).padEnd(16) + "  ← 被拦截，不扫"); continue; }
  resetBucket();
  const p = planScan(c, { asPlayer: true, batchSize: 4 });
  const b = p.breakdown;
  console.log((c.card.name || "?").slice(0, 14).padEnd(16)
    + String(c.npcLoreCandidates.length).padStart(4)
    + String(c.unclassified.length).padStart(5)
    + String(p.totalBatches).padStart(5)
    + String(b.stage1).padStart(5) + String(b.stage2).padStart(3)
    + String(b.stage3).padStart(3) + String(b.stage4).padStart(3)
    + String(p.calls).padStart(6)
    + `  ${Math.round(p.estimateMs/1000)}s`.padStart(9));
}

// ── mock callModel ──
let calls = 0;
const mkMock = (mode) => async (cfg, sys, msgs, opts) => {
  calls++;
  const stage = /归类判断/.test(sys) ? 1 : /换算成游戏内的 NPC/.test(sys) ? 2
    : /玩家自己的角色档案/.test(sys) ? 3 : 4;
  if (mode === "badjson" && stage === 2) return { text: "抱歉，我无法完成" };
  if (mode === "trunc" && stage === 2) return { text: "{\"人物\":[{\"i\":0,\"name\":\"x\",\"brief\":\"被截断了这里没有闭合括号也没有后续内容真的很长很长" };
  if (stage === 4) return { text: "客栈的木门吱呀一声。陈狐飞把包裹放在长凳上。" };
  if (stage === 1) {
    const n = (msgs[0].content.match(/^\[\d+\]/gm) || []).length;
    return { text: JSON.stringify({ 题材: "西域武侠", 条目: Array.from({length:n},(_,i)=>({i,kind:"person",why:"测试"})), 同人分组: [], 多人条目: [] }) };
  }
  if (stage === 2) {
    const n = (msgs[0].content.match(/━━ 人物 \d+ ━━/g) || []).length;
    return { text: JSON.stringify({ 人物: Array.from({length:n},(_,i)=>({
      i, name:"x", brief:"测试身份", brief_why:"依据", levelCap:3, levelCap_why:"公爵",
      special:{根骨:7,悟性:6,体魄:7,魅力:5,智谋:8,身法:4,气运:5}, special_why:"力能扛鼎",
      外貌锚点:"高大魁梧", 初始态度:"倨傲", 好感初值:0, 好感初值_why:"初见",
      里程碑:[{threshold:30,title:"点头",brief:"认得你"},{threshold:55,title:"共饮",brief:"肯喝酒"},
              {threshold:75,title:"托事",brief:"肯托付"},{threshold:95,title:"生死",brief:"生死相托"}] })) }) };
  }
  return { text: JSON.stringify({ name:"陈狐飞", bodyProfile:{height:"七尺",build:"精瘦",face:"",skin:"蜜色",hair:"半长",voice:"偏低",clothing:"深青短打"}, special:{根骨:5,悟性:7,体魄:5,魅力:6,智谋:6,身法:6,气运:5}, persona:"外堡少年" }) };
};

const target = cards.find(c => c.card.name === "封神异闻录");
console.log("\n=== mock 跑通：封神异闻录 ===");
resetBucket(); store.clearCard(store.fingerprintCard(target.card)); calls = 0;
const t0 = Date.now();
const r1 = await runScan(target, mkMock("ok"), {}, {
  playerName: "陈狐飞", asPlayer: true, batchSize: 4,
  onProgress: p => console.log(`  [${p.kind}] 阶段${p.stage ?? "-"}${p.batch != null ? ` 批${p.batch}` : ""} ${p.msg}`),
});
console.log(`  实际调用 ${calls} 次，耗时 ${Math.round((Date.now()-t0)/1000)}s（令牌桶生效）`);
console.log(`  产出 NPC ${r1.npcs.length} 个，来源 ${[...new Set(r1.npcs.map(n=>n.source))].join("/")}`);
const s = r1.npcs[0];
console.log(`  样例：${s.name} | ${s.brief} | ${s.levelCap}档(${s.levelCapWhy}) | 根骨${s.special.根骨} | 里程碑${s.milestones.length}档`);
console.log(`  玩家：体貌填了 ${7 - r1.player.missing.length}/7，缺 ${r1.player.missing.join(",") || "无"}`);
console.log(`  开场白：${r1.opening.source} · ${r1.opening.rewritten.slice(0,20)}…`);

console.log("\n=== 断点续传：同一张卡再跑一次 ===");
calls = 0;
const r2 = await runScan(target, mkMock("ok"), {}, { playerName: "陈狐飞", asPlayer: true, batchSize: 4 });
console.log(`  实际调用 ${calls} 次（全部命中缓存：${r2.report.fromCache.join(", ")}）`);

console.log("\n=== 降级链：阶段2 永远返回坏 JSON ===");
resetBucket(); store.clearCard(store.fingerprintCard(target.card)); calls = 0;
const r3 = await runScan(target, mkMock("badjson"), {}, {
  playerName: "陈狐飞", asPlayer: true, batchSize: 4,
  onProgress: p => { if (p.kind === "fail" || p.kind === "retry") console.log(`  [${p.kind}] ${p.msg.slice(0,50)}`); },
});
console.log(`  调用 ${calls} 次，NPC 来源 ${[...new Set(r3.npcs.map(n=>n.source))].join("/")}，失败记录 ${r3.report.failures.length} 条`);
console.log(`  兜底样例：${r3.npcs[0].name} | ${r3.npcs[0].brief} | ${r3.npcs[0].levelCap}档 | 里程碑${r3.npcs[0].milestones.length}档`);
console.log(`  → 导入没有被阻塞：${r3.npcs.length > 0 ? "是" : "否"}`);

console.log("\n=== 修复验证 1：全失败时的额度消耗 ===");
resetBucket(); store.clearCard(store.fingerprintCard(target.card)); calls = 0;
const r4 = await runScan(target, mkMock("badjson"), {}, {
  playerName: "陈狐飞", asPlayer: true, batchSize: 4,
  onProgress: p => { if (p.kind === "fail") console.log(`  [fail] ${p.msg.slice(0,60)}`); },
});
console.log(`  调用 ${calls} 次（修复前 21 次），NPC ${r4.npcs.length} 个全部 ${[...new Set(r4.npcs.map(n=>n.source))].join("/")}`);

console.log("\n=== 修复验证 2：截断类失败仍会拆小重试 ===");
resetBucket(); store.clearCard(store.fingerprintCard(target.card)); calls = 0;
await runScan(target, mkMock("trunc"), {}, {
  playerName: "陈狐飞", asPlayer: false, batchSize: 4,
  onProgress: p => { if (p.kind === "fail" || p.kind === "retry") console.log(`  [${p.kind}] ${p.msg.slice(0,45)}`); },
});
console.log(`  调用 ${calls} 次（截断值得拆小，但也不该失控）`);

console.log("\n=== 修复验证 3：玩家自己不会变成 NPC ===");
resetBucket(); store.clearCard(store.fingerprintCard(target.card)); calls = 0;
const r5 = await runScan(target, mkMock("ok"), {}, { playerName: "陈狐飞", asPlayer: true, batchSize: 4 });
console.log(`  人物名单：${r5.npcs.map(n=>n.name).join("、")}`);
console.log(`  含"陈狐飞"？${r5.npcs.some(n=>n.name==="陈狐飞") ? "是（还有问题）" : "否（已修）"}`);

console.log("\n=== 修复验证 4：勾选人物后的预算 ===");
resetBucket(); store.clearCard(store.fingerprintCard(target.card));
const pAll = planScan(target, { asPlayer: true, batchSize: 4 });
const pPick = planScan(target, { asPlayer: true, batchSize: 4, selectedPeople: ["金灵圣母", "三霄娘娘", "通天教主"] });
console.log(`  全跑：${pAll.calls} 次 / 勾选 3 人：${pPick.calls} 次`);
const noPerson = cards.find(c => c.card.name === "魔门宗主萧月寒");
console.log(`  零人物的卡（魔门宗主）：${planScan(noPerson, { asPlayer: true }).calls} 次，批次 ${planScan(noPerson, {asPlayer:true}).totalBatches}`);
