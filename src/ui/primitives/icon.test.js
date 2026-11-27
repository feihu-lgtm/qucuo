import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Icon, ICONS, ICON_GROUPS, ICON_TONE, iconSvg } from "./index.js";
import { SPECIAL_KEYS } from "../../domain/data/character/specialKeys.js";
import { SKILL_TYPE } from "../../domain/data/kungfu/skillType.js";
import { STAGES } from "../../utils/mudHelpers.js";

// 招式路数：武学数据里 moveType 的全部中文取值。
const MOVE_TYPES = ["攻击", "防御", "状态", "回气", "疗伤"];

describe("Icon 原语", () => {
  it("七维、武学门类、招式路数、修炼阶段，每个数据取值都有图标", () => {
    const needed = [...SPECIAL_KEYS, ...Object.values(SKILL_TYPE), ...MOVE_TYPES, ...STAGES];
    for (const name of needed) expect(ICONS[name], name).toBeTruthy();
  });

  it("每个图标都能渲染成 24 视框的线描 SVG", () => {
    for (const name of Object.keys(ICONS)) {
      const html = renderToStaticMarkup(createElement(Icon, { name }));
      expect(html, name).toContain('viewBox="0 0 24 24"');
      expect(html, name).toContain('stroke="currentColor"');
      expect(html, name).toContain('aria-hidden="true"');
      expect(iconSvg(name), name).toContain("<svg");
    }
  });

  it("给了 title 就作为图片朗读，不再隐藏", () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: "气血", title: "气血" }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="气血"');
    expect(html).not.toContain("aria-hidden");
  });

  it("未知名字不渲染任何东西", () => {
    expect(renderToStaticMarkup(createElement(Icon, { name: "不存在" }))).toBe("");
  });

  it("图标册每组内不重复、合起来覆盖全部图标，语义色只给登记过的图标", () => {
    // “内功”既是人物数值又是武学门类，允许在两组里各出现一次。
    for (const [group, names] of ICON_GROUPS) expect(new Set(names).size, group).toBe(names.length);
    const grouped = new Set(ICON_GROUPS.flatMap(([, names]) => names));
    expect([...grouped].sort()).toEqual(Object.keys(ICONS).sort());
    for (const name of Object.keys(ICON_TONE)) expect(ICONS[name], name).toBeTruthy();
  });
});
