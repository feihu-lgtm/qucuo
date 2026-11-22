// 斗蛐蛐通用文字按钮。

import React, { useState } from "react";

export default function TextBtn({ children, onClick, style }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: "none", border: "none", cursor: "pointer", color: hover ? "var(--gold-light)" : "var(--parchment)",
        fontSize: 13, letterSpacing: 1, transition: "color .2s", ...style }}>
      {children}
    </button>
  );
}
