import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EffectReceiptCard from "./EffectReceiptCard.jsx";
import LogEntry from "./LogEntry.jsx";

const grantReceipt = {
  kind: "grant_item", factId: "F42_3",
  item: {
    id: "it_a1b2c3", name: "裂风豹骨哨", category: "accessory", quality: "蓝",
    desc: "哨口沁着血纹",
    sixDim: { 身法: 2 },
    provenance: { turn: 42, day: 2, place: "鱼定村·茶馆", fromNpc: "才旦", factId: "F42_3" },
    history: [],
  },
};
const weaponReceipt = {
  kind: "grant_item", factId: "F42_5",
  item: { id: "it_d4e5f6", name: "霜牙短刀", category: "weapon", quality: "紫", atk: 33, effect: { forceFirst: true } },
};
const pillReceipt = {
  kind: "grant_item", factId: "F42_6",
  item: { id: "it_g7h8i9", name: "熊油膏", category: "misc", quality: "绿", consumable: { hpRestore: 0.2 } },
};
const skillReceipt = {
  kind: "bestow_skill", factId: "F42_4",
  skill: { id: "kf_emg_x", name: "断崖一剑", type: "招式", moveType: "攻击", quality: "紫", stage: "入门" },
};
const neigongReceipt = {
  kind: "bestow_skill", factId: "F42_7",
  skill: { id: "kf_emg_y", name: "寒潭服气法", type: "内功", quality: "紫", passiveBonus: { maxHp: 28 } },
};

const render = (receipt) => renderToStaticMarkup(createElement(EffectReceiptCard, { receipt, onAction: () => {} }));

describe("EffectReceiptCard 天机落账卡", () => {
  it("grant_item 饰品：品阶色变量、六维词条翻译、出生落款齐全", () => {
    const html = render(grantReceipt);
    expect(html).toContain("裂风豹骨哨");
    expect(html).toContain("天工賜物");
    expect(html).toContain("身法+2");          // 词条翻译（effectBrief）
    expect(html).toContain("第2日 · 鱼定村·茶馆 · 得自才旦"); // 出生落款
    expect(html).toContain("佩挂");
    expect(html).not.toContain("服用");
  });

  it("武器：攻防数值与特效翻译", () => {
    const html = render(weaponReceipt);
    expect(html).toContain("攻 33");
    expect(html).toContain("必先手");
    expect(html).toContain("佩挂");
  });

  it("consumable 物品出「服用」钮", () => {
    const html = render(pillReceipt);
    expect(html).toContain("服用");
    expect(html).not.toContain("佩挂");
  });

  it("bestow_skill 招式出「设为主招」；内功显示 passiveBonus 翻译且无按钮", () => {
    const html = render(skillReceipt);
    expect(html).toContain("傳功頓悟");
    expect(html).toContain("设为主招");
    expect(html).toContain("攻击");
    const nei = render(neigongReceipt);
    expect(nei).toContain("气血上限+28");
    expect(nei).not.toContain("设为主招");
  });

  it("残缺 receipt 不炸：null/无 payload 渲染空", () => {
    expect(render(null)).toBe("");
    expect(render({ kind: "grant_item", factId: "F1_1" })).toBe("");
  });

  it("无裸 px 字号与 #hex 颜色", () => {
    const html = render(grantReceipt);
    expect(html).not.toMatch(/font-size:\s*\d/);
    expect(html).not.toContain("#");
  });
});

describe("LogEntry receipts 接线", () => {
  it("日志项带 receipts 时正文下方渲染落账卡", () => {
    const html = renderToStaticMarkup(createElement(LogEntry, {
      entry: { t: "desc", text: "才旦把骨哨塞进你手里。", receipts: [grantReceipt] },
      color: "var(--text)", onAction: () => {},
    }));
    expect(html).toContain("才旦把骨哨塞进你手里。");
    expect(html).toContain("裂风豹骨哨");
    expect(html).toContain("effect-receipt-card");
  });

  it("无 receipts 不渲染卡", () => {
    const html = renderToStaticMarkup(createElement(LogEntry, {
      entry: { t: "desc", text: "寻常一段。" }, color: "var(--text)", onAction: () => {},
    }));
    expect(html).not.toContain("effect-receipt-card");
  });
});
