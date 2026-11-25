// 入册界面共用零件 · 框条层（从 widgets.jsx 拆出）
// ============================================================================
// 木牌标题条（border-image 9-slice）、品阶徽记、加减号。

import React from "react";
import { S, TIERS } from "./widgetsMeta.js";

// ── 木牌标题条 ────────────────────────────────────────────────────────────────

/**
 * 横条素材的 9-slice。
 *
 * 【为什么必须切片】这三张横条素材（bar_wood 458×120、bar_paper 425×132、
 * bar_paper2 441×134）的结构都是：两端各一块约 95px 宽的金色包角装饰，上下各
 * 约 15px 金边，只有中段的木纹／纸面是可以拉伸的。原来一律 backgroundSize
 * "100% 100%" 整幅强拉——面板还锁在 1120 宽的时候 Bar 实际宽 230~890px、拉伸
 * 1.5 到 3 倍，观感还过得去（version.js 里那条注释的原话就是"拉伸幅度不大时
 * 观感没问题"）。改成全屏之后左栏有 1000px 宽而高度仍是 34px，比例从原图的
 * 3.8 变成 29，横向拉了近 8 倍：两端装饰件糊成一片、上下金边压成细线，底栏那
 * 条还把"回名单"按钮整个盖住了。
 *
 * border-image 让四角保持原始像素、四边只沿一个方向拉伸、中段双向填充，正是
 * 这类"两端有装饰、中间可延展"的素材该用的方式。
 *
 * 【连带好处】border 占掉左右各 95px 的盒模型空间，文字自然落在中段木纹上，
 * 不必再靠 padding 去躲装饰件——原来 padding 只有 16px，标题就压在装饰件上。
 */
export function barFrame(img, slice = 15, side = 95) {
  const w = `${slice}px ${side}px`;
  return {
    boxSizing: "border-box",
    borderStyle: "solid",
    borderColor: "transparent",
    borderWidth: w,
    borderImageSource: `url('${img}')`,
    borderImageSlice: `${slice} ${side} fill`,
    borderImageWidth: w,
    borderImageRepeat: "stretch",
  };
}

export function Bar({ children, right }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      ...barFrame(S("ui/bar_wood.webp")),
      // 上下 border 各 15px，留 16px 给文字，故 minHeight 46
      padding: "0 10px", minHeight: 46,
    }}>
      <span style={{ color: "var(--tutorial-title)", fontSize: "var(--fs-md)", letterSpacing: 2, textShadow: "0 1px 3px rgba(0,0,0,.8)" }}>
        {children}
      </span>
      <span style={{ flex: 1 }} />
      {right}
    </div>
  );
}

// ── 品阶徽记 ──────────────────────────────────────────────────────────────────

export function JadeTier({ value, onChange, size = 30, title, withSelect = false }) {
  const idx = Math.max(0, Math.min(5, value ?? 0));
  const t = TIERS[idx];
  const jade = (
    <span
      title={title || `品阶 ${t.label}档`}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: size, height: size, flexShrink: 0,
        backgroundImage: `url('${S(t.jade)}')`,
        backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat",
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,.6))",
      }}
    >
      <span style={{ fontSize: size * 0.36, fontWeight: 700, color: "var(--bg-deep)", textShadow: `0 0 3px ${t.color}` }}>
        {t.label}
      </span>
    </span>
  );
  if (!withSelect || !onChange) return jade;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      {jade}
      <div style={{
        position: "relative", width: 86, height: 30,
        backgroundImage: `url('${S("ui/box_wood.webp")}')`,
        backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <select value={idx} onChange={e => onChange(Number(e.target.value))}
          style={{
            appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
            width: "100%", height: "100%", background: "transparent", border: "none",
            textAlign: "center", textAlignLast: "center",
            color: t.color, fontSize: "var(--fs-sm)", fontWeight: 700, outline: "none",
            cursor: "pointer", fontFamily: "inherit", textShadow: "0 1px 2px rgba(0,0,0,.9)",
          }}>
          {TIERS.map((x, i) => (
            <option key={x.key} value={i} style={{ background: "var(--bg-deep)", color: x.color }}>
              {i}·{x.label}档
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── 加减号 ────────────────────────────────────────────────────────────────────

export function Step({ children, onClick, disabled }) {
  return (
    <span onClick={disabled ? undefined : onClick}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 18, height: 18, flexShrink: 0, userSelect: "none",
        backgroundImage: `url('${S("ui/btn_blank.webp")}')`,
        backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
        cursor: disabled ? "default" : "pointer",
        color: disabled ? "var(--gamble-button-edge)" : "var(--paper)", fontSize: "var(--fs-xs)", lineHeight: 1,
        opacity: disabled ? .35 : 1,
      }}>{children}</span>
  );
}
