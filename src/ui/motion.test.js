import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AnimatedNumber, { easeOutCubic } from "./components/AnimatedNumber.jsx";
import LogEntry from "./components/LogEntry.jsx";

const MOTION = readFileSync("src/ui/motion.css", "utf-8");

function cssFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) cssFiles(path, out);
    else if (name.endsWith(".css")) out.push(path);
  }
  return out;
}

describe("动效样式表", () => {
  it("用到的每个动画名都有对应的 @keyframes", () => {
    const defined = new Set(cssFiles("src").flatMap((f) => [...readFileSync(f, "utf-8").matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])));
    const used = new Set([...MOTION.matchAll(/animation:\s*([^;]+);/g)]
      .flatMap((m) => m[1].split(",").map((part) => part.trim().split(/\s+/)[0]))
      .filter((name) => name && name !== "none"));
    for (const name of used) expect(defined.has(name), name).toBe(true);
  });

  it("只用 tokens.css 里的时长与缓动令牌，不写裸毫秒的缓动曲线", () => {
    expect(MOTION).not.toMatch(/cubic-bezier\(/);
  });

  it("在入口最后引入，覆盖各处零散的旧动效", () => {
    const main = readFileSync("src/main.jsx", "utf-8");
    const imports = [...main.matchAll(/import\s+"([^"]+\.css)"/g)].map((m) => m[1]);
    expect(imports.at(-1)).toBe("./ui/motion.css");
  });
});

describe("数值滚动", () => {
  it("缓出曲线两端固定、中段已过半", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.8);
  });

  it("首次渲染直接显示当前值、不着色", () => {
    const html = renderToStaticMarkup(createElement(AnimatedNumber, { value: 150, className: "profile-val-gold" }));
    expect(html).toContain(">150<");
    expect(html).toContain("anim-num profile-val-gold");
    expect(html).not.toContain("data-delta");
  });
});

describe("进房说明行", () => {
  const render = (entry) => renderToStaticMarkup(createElement(LogEntry, { entry, color: "var(--log-desc)", onAction: () => {} }));

  it("「你自某处向某方，来到此处」渲染成小字说明，不当正文", () => {
    expect(render({ t: "desc", text: "  你自「村口」向东，来到此处。", mapNote: "arrive" })).toContain("log-map-arrive");
    expect(render({ t: "desc", text: "  你自「马车行」向西，来到此处。" })).toContain("log-map-arrive");
  });

  it("普通正文照旧", () => {
    expect(render({ t: "desc", text: "  村里的客栈，往来行商都在此落脚。" })).not.toContain("log-map-arrive");
  });
});
