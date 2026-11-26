// 徽记原语：小号描边标签。tone 取 accent / dim / good / warn，描边跟随文字色。
import React from "react";

const TONES = new Set(["accent", "dim", "good", "warn"]);

export default function Badge({ tone = "dim", className = "", children, ...rest }) {
  return (
    <span className={className ? `ui-badge ${className}` : "ui-badge"} data-tone={TONES.has(tone) ? tone : "dim"} {...rest}>
      {children}
    </span>
  );
}
