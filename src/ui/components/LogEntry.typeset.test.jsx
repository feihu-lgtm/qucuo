import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LogEntry from "./LogEntry.jsx";
import NpcActionMenu from "./NpcActionMenu.jsx";
import ItemActionMenu from "./ItemActionMenu.jsx";

const render = (entry, props = {}) => renderToStaticMarkup(createElement(LogEntry, { entry, color: "var(--log-desc)", onAction: () => {}, ...props }));

describe("中栏统一排版", () => {
  it("正文去掉原文的前导空格，逐段落成 .log-para，缩进只交给样式表", () => {
    const html = render({ t: "desc", text: "  第一段很短。\n　　第二段。" });
    expect(html.match(/class="log-para"/g)).toHaveLength(2);
    expect(html).not.toMatch(/>\s+第一段/);
    expect(html).not.toContain("　　第二段");
    expect(html).not.toContain("text-indent");
  });

  it("事实行不缩进，房间行的居中与字距交给样式表", () => {
    expect(render({ t: "sys", text: "  这里的出口：西 北 南" })).toContain("log-entry--fact");
    const room = render({ t: "room", text: "鱼定村" });
    expect(room).toContain("log-entry--room");
    expect(room).not.toContain("letter-spacing");
  });

  it("「新人物出现」的名字用人名色，给了 onOpenNpc 就能点", () => {
    const html = render({ t: "sys", text: "  ※ 新人物出现 大公鸡（点击可细看其人）" }, { onOpenNpc: () => {} });
    expect(html).toMatch(/<button type="button" class="log-npc-name log-npc-link">大公鸡<\/button>/);
    expect(render({ t: "sys", text: "  ※ 新人物出现 大公鸡（点击可细看其人）" })).not.toContain("<button");
    expect(html).toContain("（点击可细看其人）");
  });

  it("细看卡片的抬头行拆成人名与来历，不当正文段落", () => {
    const html = render({ t: "desc", text: "  大公鸡 村口一只油亮好斗的大公鸡" }, { lookName: "大公鸡" });
    expect(html).toContain("log-look-head");
    expect(html).toMatch(/class="log-npc-name">大公鸡</);
    expect(html).toContain("村口一只油亮好斗的大公鸡");
    expect(html).not.toContain("log-para");
  });

  it("补写的描写即使以人名开头也照常落正文段，不再当第二个抬头", () => {
    const html = render({ t: "desc", text: "  雪豹伏在青石上，尾尖微动。", fillKey: "k", fillProse: true }, { lookName: "雪豹" });
    expect(html).not.toContain("log-look-head");
    expect(html).toContain("log-para");
    expect(render({ t: "desc", text: "  雪豹伏在青石上。" }, { lookName: "雪豹" })).not.toContain("log-look-head");
  });

  it("同组的补写描写照常落正文段", () => {
    const html = render({ t: "desc", text: "  那公鸡一身油亮毛羽。" }, { lookName: "大公鸡" });
    expect(html).toContain("log-para");
  });
});

describe("头像与物品图放大", () => {
  const npc = { name: "雪豹", brief: "长卧村口青石的雪白灵兽" };
  const noop = () => {};
  const menu = (props) => renderToStaticMarkup(createElement(NpcActionMenu, {
    npc, inv: [], onClose: noop, onTalk: noop, onGift: noop, onDuel: noop, onSteal: noop, onLook: noop, onLearnSkill: noop, ...props,
  }));

  it("人物互动菜单默认是小头像，可点放大；以放大态打开时直接给整幅立绘", () => {
    expect(menu()).toContain('title="放大立绘"');
    const zoomed = menu({ initialZoom: true });
    expect(zoomed).toContain("npc-menu-portrait");
    expect(zoomed).toMatch(/<img src="[^"]*雪豹|<img src="[^"]*%E9%9B%AA%E8%B1%B9/);
  });

  it("没有立绘的人物只有印章，放大态也不出空图", () => {
    const html = menu({ npc: { name: "无名过客" }, initialZoom: true });
    expect(html).not.toContain("npc-menu-portrait");
    expect(html).not.toContain('title="放大立绘"');
  });

  it("物品菜单在有实物图时把图放进抬头，放大态用大尺寸", () => {
    const item = { name: "青锋剑", category: "weapon", quality: "白" };
    const base = { item, onClose: noop, onInspect: noop, onConsume: noop, onGive: noop, onSell: noop, onCollect: noop };
    const small = renderToStaticMarkup(createElement(ItemActionMenu, base));
    const big = renderToStaticMarkup(createElement(ItemActionMenu, { ...base, initialZoom: true }));
    expect(small).toContain("item-menu-art");
    expect(small).toContain("item-art--lg");
    expect(big).toContain("item-art--zoom");
    expect(big).toContain("查看");
  });
});

describe("包袱与装备的放大入口可用键盘", () => {
  it("包袱图标是原生按钮", async () => {
    const { default: InventoryModule } = await import("../panels/right/InventoryModule.jsx");
    const html = renderToStaticMarkup(createElement(InventoryModule, { inv: [{ id: "a", name: "青锋剑", category: "weapon", quality: "白" }] }));
    expect(html).toMatch(/<button type="button" class="pack-row-art"/);
  });
});
