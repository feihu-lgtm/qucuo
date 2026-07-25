import { chromium } from "playwright";

const BASE = "http://localhost:5199";
const OUT = "/var/folders/xp/xb0k04_16ws_129w6ybfwj000000gn/T/opencode";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });

// 注入假 API key 绕过"尚未配置 API Key"拦截（只看 UI，不发请求）
await page.addInitScript(() => {
  localStorage.setItem("wuxia_mud_api_config", JSON.stringify({ apiKey: "sk-dummy-ui-check" }));
  localStorage.setItem("wuxia_mud_day_mode", "0");
  localStorage.setItem("qucuo_tutorial_seen", "1"); // 跳过新手教程浮层
});

page.on("pageerror", e => console.error("[pageerror]", e.message));
page.on("console", m => { if (m.type() === "error") console.error("[console.error]", m.text()); });

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// 开始游戏 → 创角
await page.getByText("开始游戏", { exact: false }).first().click();
await page.waitForTimeout(600);
const nameInput = page.locator("input").first();
await nameInput.fill("测试侠");
await page.getByText("踏入曲措乡", { exact: false }).click();
await page.waitForTimeout(600);

// 开场序列：连点跳过（约 4-6 张）
for (let i = 0; i < 8; i++) {
  await page.mouse.click(800, 500);
  await page.waitForTimeout(400);
  const topbar = await page.getByText("新手教程", { exact: false }).count();
  if (topbar > 0) break;
}
await page.waitForTimeout(1200);

// 夜间模式截图
await page.screenshot({ path: `${OUT}/ui-night.png`, fullPage: false });
console.log("✓ ui-night.png");

// 切日间模式
await page.getByText("☾ 夜间", { exact: false }).click();
await page.waitForTimeout(1400); // 1.2s 过渡动画
await page.screenshot({ path: `${OUT}/ui-day.png`, fullPage: false });
console.log("✓ ui-day.png");

await browser.close();
console.log("done");
