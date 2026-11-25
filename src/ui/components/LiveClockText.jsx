import React, { useEffect, useState } from "react";
import { formatRealDateTime } from "../../utils/mudHelpers.js";

export default function LiveClockText({
  withDate = true,
  withSeconds = true,
  intervalMs = 1000,
  prefix = "",
  style,
  className,
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return (
    <span
      className={className}
      style={{ fontVariantNumeric: "tabular-nums", ...(style || {}) }}
    >
      {prefix}{formatRealDateTime(now, { withDate, withSeconds })}
    </span>
  );
}
