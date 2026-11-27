import { useEffect, useState } from "react";
import { npcArtUrl } from "../art/art.js";

// 统一人物头像框（夜色精修 · 镂空水墨底）：
//   size: xs(22px) | sm(28px) | md(40px) | lg(56px) | xl(92px) | dossier(144px)
//   有图时显示 transparent cutout webp；缺图或加载失败时优雅降级为单字印章，永不破图。
export default function NpcAvatar({
  name = "",
  size = "md",
  src = null,
  locked = false,
  dim = false,
  lotus = false,
  className = "",
  onClick,
  title,
}) {
  const url = src || npcArtUrl(name);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const cls = [
    "npc-ava",
    `npc-ava--${size}`,
    onClick ? "is-clickable" : "",
    lotus ? "is-lotus" : "",
    dim ? "is-dim" : "",
    locked ? "is-locked" : "",
    className,
  ].filter(Boolean).join(" ");

  const sealText = locked ? "？" : (String(name || "？").trim().slice(0, 1) || "？");

  return (
    <span
      className={cls}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(e);
        }
      } : undefined}
      title={title}
    >
      {url && !failed ? (
        <>
          <img
            src={url}
            alt={locked ? "未谋面" : name}
            className="npc-ava-img"
            onError={() => setFailed(true)}
          />
          {locked && <span className="npc-ava-lock-tag" aria-hidden="true">未逢</span>}
        </>
      ) : (
        <span className="npc-ava-seal" aria-hidden="true">{sealText}</span>
      )}
    </span>
  );
}
