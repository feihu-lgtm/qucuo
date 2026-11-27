// 美术图的唯一出口：横幅（江湖栏进场、建筑面板顶部、家园设施页）与小图（天地栏、家园卡片）。
// 2:1 素材按原比例整张显示，不另裁——小图与横幅是同一构图，只是尺寸不同；四边由样式表渐隐进底色。
// 图加载失败就整块隐藏，界面退回纯文字。
import { useState } from "react";

export default function ArtImage({ src, alt = "", variant = "banner", caption, subcaption, animate = false }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <figure className={`art art--${variant}${animate ? " art--enter" : ""}`}>
      <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />
      {caption && (
        <figcaption className="art-caption">
          <span className="art-caption-name">{caption}</span>
          {subcaption && <span className="art-caption-sub">{subcaption}</span>}
          <span className="art-caption-rule" aria-hidden="true" />
        </figcaption>
      )}
    </figure>
  );
}
