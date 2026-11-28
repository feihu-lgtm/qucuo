import { useEffect, useState } from "react";
import { itemArtUrl } from "../art/art.js";
import { Icon } from "../primitives/index.js";

// 优先显示具名物品专图，再按物品字段匹配通用实物图；加载失败时退回线描图标或空白。
export default function ItemIcon({
  item,
  size = "md",
  fallbackIcon = null,
  dim = false,
  className = "",
}) {
  const url = itemArtUrl(item);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const cls = [
    "item-art",
    `item-art--${size}`,
    dim ? "is-dim" : "",
    className,
  ].filter(Boolean).join(" ");

  const alt = typeof item === "object" ? (item?.name || "") : String(item || "");

  if (url && !failed) {
    return (
      <span className={cls}>
        <img
          src={url}
          alt={alt}
          className="item-art-img"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }
  if (fallbackIcon) {
    const px = size === "xs" ? 13 : size === "lg" ? 22 : 17;
    return (
      <span className={cls}>
        <Icon name={fallbackIcon} size={px} />
      </span>
    );
  }
  return null;
}
