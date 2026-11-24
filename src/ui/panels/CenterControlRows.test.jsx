import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ZONE_THEMES } from "../../utils/theme.js";
import CenterControlRows from "./CenterControlRows.jsx";

const props = {
  isMobile: true,
  mobileColumn: "center",
  zoneTheme: ZONE_THEMES.village,
  room: { name: "鱼定村", npcs: [{ name: "才旦" }, { name: "老孙" }], items: ["铜铃", "青锋剑"] },
  innerRoomName: "",
  handleCollectGround: () => {},
  setInteractMode: () => {},
  interactMode: "talk",
  activeTarget: "才旦",
  setActiveTarget: () => {},
  setTalkTarget: () => {},
  setPigeonTarget: () => {},
  activeGroundItem: null,
  setActiveGroundItem: () => {},
  nsfwOn: false,
  setNsfwOn: () => {},
  meditate: () => {},
  justMeditated: false,
};

function render(overrides = {}) {
  return renderToStaticMarkup(createElement(CenterControlRows, { ...props, ...overrides }));
}

describe("CenterControlRows", () => {
  it("renders mobile selections in one row before the standalone controls", () => {
    const html = render();
    expect(html.match(/class="mobile-control-row"/g)).toHaveLength(1);
    expect(html).toContain("自动 ▾");
    expect(html).toContain("才旦 ▾");
    expect(html).toContain("地上 2 ▾");
    const positions = [
      html.indexOf('data-control-trigger="mode"'),
      html.indexOf('data-control-trigger="people"'),
      html.indexOf('data-control-trigger="ground"'),
      html.indexOf('data-control-action="nsfw"'),
      html.indexOf('data-control-action="meditate"'),
    ];
    expect(positions.every(position => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("keeps only the two interaction modes in its submenu", () => {
    const html = render({ initialOpenMenu: "mode", interactMode: "action" });
    const menuStart = html.indexOf('data-control-menu="mode"');
    const menu = html.slice(menuStart, html.indexOf("</div>", menuStart) + 6);
    expect(menu.match(/role="menuitem"/g)).toHaveLength(2);
    expect(menu).toContain("◈ 自动");
    expect(menu).toContain("◆ 私聊旁白");
    expect(menu).not.toContain(">NSFW</button>");
    expect(menu).not.toContain("打坐");
  });

  it("offers a separate ground-item selection and pickup control", () => {
    const html = render({ initialOpenMenu: "ground", activeGroundItem: "青锋剑" });
    const menuStart = html.indexOf('data-control-menu="ground"');
    const menu = html.slice(menuStart);
    expect(html).toContain("青锋剑 ▾");
    expect(menu.indexOf(">不选</button>")).toBeLessThan(menu.indexOf('data-ground-select="铜铃"'));
    expect(menu).toContain('data-ground-select="青锋剑"');
    expect(menu).toContain('data-ground-pickup="青锋剑"');
    expect(menu).toContain(">拾取</button>");
  });

  it("disables the people label in whisper mode", () => {
    const html = render({ interactMode: "whisper", activeTarget: "老孙" });
    const peopleTrigger = html.match(/<button[^>]*data-control-trigger="people"[^>]*>/)?.[0] || "";
    expect(peopleTrigger).toContain('aria-disabled="true"');
    expect(peopleTrigger).toContain("disabled");
    expect(peopleTrigger).toContain("opacity:0.4");
    expect(peopleTrigger).not.toContain('aria-expanded="true"');
    expect(html).toContain("老孙 ▾");
    expect(html).not.toContain('data-control-menu="people"');
  });

  it("keeps the original separate rows on desktop", () => {
    const html = render({ isMobile: false, interactMode: "action" });
    expect(html.match(/class="mobile-control-row"/g)).toHaveLength(1);
    expect(html.match(/class="mobile-people-row"/g)).toHaveLength(1);
    expect(html.match(/class="mobile-ground-strip"/g)).toHaveLength(1);
    expect(html).toContain("人选：");
    expect(html).not.toContain("data-control-trigger=");
  });
});
