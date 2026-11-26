// 按钮原语。variant 决定外观：settings（设置面板）、chrome（主界面按钮）、
// primary / secondary（建筑面板）。样式在 primitives.css，组件不写内联 style；
// style 只透传调用方的布局属性（flex、宽高、外边距）。
import React from "react";

const VARIANTS = new Set(["settings", "chrome", "primary", "secondary"]);

export default function Button({
  variant = "settings", active, className = "", type = "button", children, ...rest
}) {
  const v = VARIANTS.has(variant) ? variant : "settings";
  return (
    <button
      type={type}
      className={className ? `ui-btn ${className}` : "ui-btn"}
      data-variant={v}
      aria-pressed={v === "chrome" && active !== undefined ? Boolean(active) : undefined}
      {...rest}
    >
      {children}
    </button>
  );
}
