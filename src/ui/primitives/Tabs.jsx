// 标签页原语：一排 chrome 按钮，当前项用 aria-selected 标出（样式同 chromeBtn 的「开启」态）。
import React from "react";
import Button from "./Button.jsx";

export default function Tabs({ items = [], value, onChange, ariaLabel, className = "" }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={className ? `ui-tabs ${className}` : "ui-tabs"}>
      {items.map((item) => (
        <Button key={item.key} variant="chrome" role="tab" aria-selected={item.key === value}
          onClick={() => onChange?.(item.key)}>
          {item.label}
        </Button>
      ))}
    </div>
  );
}
