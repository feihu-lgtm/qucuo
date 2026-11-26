// 面板原语：section（设置面板的分节，上方一条墨线）、box（带描边的面板块）。
import React from "react";

export default function Panel({ variant = "box", as: Tag = "div", className = "", children, ...rest }) {
  const v = variant === "section" ? "section" : "box";
  return (
    <Tag className={className ? `ui-panel ${className}` : "ui-panel"} data-variant={v} {...rest}>
      {children}
    </Tag>
  );
}
