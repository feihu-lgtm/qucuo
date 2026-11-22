import { chromium } from "playwright";
import { mkdirSync, readdirSync } from "node:fs";
import { resolve, basename, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { startServer } from "./harness/server.mjs";
import { installMockAi } from "./harness/mockAi.mjs";
import * as game from "./harness/game.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const specsDir = join(root, "e2e", "specs");
const artifactsDir = join(root, "e2e", ".artifacts");
const args = process.argv.slice(2);
const specFiles = args.length
  ? args.map((arg) => {
    const file = arg.includes("/") ? resolve(arg) : resolve(specsDir, arg.endsWith(".mjs") ? arg : `${arg}.spec.mjs`);
    return file;
  })
  : readdirSync(specsDir).filter((name) => name.endsWith(".spec.mjs")).sort().map((name) => join(specsDir, name));

let server;
let browser;
let failures = 0;
try {
  server = await startServer();
  browser = await chromium.launch({ headless: true });
  for (const file of specFiles) {
    const name = basename(file, ".spec.mjs");
    const { default: spec, viewport = { width: 1440, height: 900 } } = await import(pathToFileURL(file).href);
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        const source = message.location()?.url;
        errors.push(`${message.text()}${source ? ` (${source})` : ""}`);
      }
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("requestfailed", (request) => {
      // 换页/重载时浏览器会掐掉还在路上的模块请求（ERR_ABORTED），那是导航本身，不是页面报错。
      if (request.failure()?.errorText === "net::ERR_ABORTED") return;
      errors.push(`Request failed: ${request.url()} (${request.failure()?.errorText || "unknown"})`);
    });
    try {
      await page.route("https://jgijklgbbaszijpfcvdf.supabase.co/rest/v1/**", async (route) => {
        const headers = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "apikey,authorization,content-type,prefer,range,range-unit",
          "Access-Control-Allow-Methods": "GET,POST,HEAD,OPTIONS",
          "Access-Control-Expose-Headers": "content-range",
          "Content-Range": "*/0",
        };
        const method = route.request().method();
        await route.fulfill({
          status: method === "OPTIONS" ? 204 : 200,
          headers,
          contentType: "application/json",
          body: method === "HEAD" ? "" : "[]",
        });
      });
      const ai = await installMockAi(page);
      await page.goto(server.url);
      await spec({ page, ai, game: { ...game, consoleErrors: errors } });
      console.log(`PASS ${name}`);
    } catch (error) {
      failures += 1;
      mkdirSync(artifactsDir, { recursive: true });
      const screenshot = join(artifactsDir, `${name}-${Date.now()}.png`);
      await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
      console.error(`FAIL ${name}: ${error.stack || error.message}`);
      console.error(`Screenshot: ${screenshot}`);
    } finally {
      await context.close();
    }
  }
} catch (error) {
  failures += 1;
  console.error(`E2E runner failed: ${error.stack || error.message}`);
} finally {
  await browser?.close();
  await server?.stop();
}
if (failures) process.exitCode = 1;
