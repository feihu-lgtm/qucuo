// 线描图标原语。name 直接用游戏数据里的取值（七维、武学门类、招式路数、修炼阶段等），
// 图形数据在 iconPaths.js。颜色跟随文字色；只有 ICON_TONE 里的几枚带语义色，由 data-tone 交给样式表。
import React from "react";
import { ICONS, ICON_TONE } from "./iconPaths.js";

export default function Icon({ name, size = 20, title, className = "", ...rest }) {
  const shapes = ICONS[name];
  if (!shapes) return null;
  const labelled = Boolean(title);
  return (
    <svg
      className={className ? `ui-icon ${className}` : "ui-icon"}
      data-icon={name}
      data-tone={ICON_TONE[name]}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={labelled ? "img" : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : "true"}
      {...rest}
    >
      {shapes.map(([tag, attrs], i) => {
        const { fill, ...props } = attrs;
        return React.createElement(tag, { key: i, ...props, ...(fill ? { fill: "currentColor", stroke: "none" } : {}) });
      })}
    </svg>
  );
}
