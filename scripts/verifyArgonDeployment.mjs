#!/usr/bin/env node
// 部署后远端自检：manifest commit 必须等于刚部署的 commit；免配置 json 必须是 JSON；
// 首页与首个 JS 资产必须可访问。任一不符即非零退出，调用方负责回滚。
const base = (process.argv[2] || "https://argonmeow.online/qucuo/").replace(/\/?$/, "/");
const expectedCommit = process.argv[3] || "";
const fail = (msg) => { console.error(`argonmeow 部署自检失败：${msg}`); process.exit(1); };
const get = async (path) => {
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!res.ok) fail(`${path || "index"} HTTP ${res.status}`);
  return res;
};
try {
  const manifestRes = await get("deploy-manifest.json");
  const manifest = await manifestRes.json();
  if (expectedCommit && manifest.commit !== expectedCommit) {
    fail(`manifest commit ${manifest.commit} != ${expectedCommit}`);
  }
  const cfg = await (await get("argon-config.json")).json();
  if (!cfg.endpoint || !cfg.model || cfg.apiKey) fail("argon-config.json 缺少 endpoint/model 或误带 key");
  const html = await (await get("")).text();
  if (!html.includes("天都·曲措")) fail("首页不像 qucuo 页面");
  const asset = html.match(/(?:src|href)="(\/qucuo\/assets\/[^"]+\.js)"/)?.[1];
  if (!asset) fail("首页找不到 JS 资产引用");
  const assetRes = await fetch(`https://argonmeow.online${asset}`, { method: "HEAD", cache: "no-store" });
  if (!assetRes.ok) fail(`首个 JS 资产 HTTP ${assetRes.status}`);
  console.log(`argonmeow 部署自检通过：${manifest.commit} / ${manifest.versionTime}`);
} catch (err) {
  fail(err?.message || String(err));
}
