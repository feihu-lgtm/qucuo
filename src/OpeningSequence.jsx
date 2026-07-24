// 开场图文序列
// 仅在"全新开局"（没有存档、第一次点开始）时展示一次：
// 第一张——少年策马入村，远眺三曲交汇的鱼定村
// 第二张——信封特写，隶书"陈狐飞 启"，未干墨迹
// 点击画面或按任意键推进到下一张，第二张点击后关闭序列，正式进入游戏
import React, { useState } from "react";
import { ZONE_THEMES } from "./theme.js";

const theme = ZONE_THEMES.village;

const SLIDES = [
  {
    image: "/intro-1.jpg",
    caption: "你揣着一封无落款的旧信，一路翻山越岭走到这曲措乡地界。",
  },
  {
    image: "/intro-2.jpg",
    caption: "信上只有四字：陈狐飞 启。墨迹未干，却不知是谁人所书。",
  },
];

export default function OpeningSequence({ onFinish }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];

  const advance = () => {
    if (index < SLIDES.length - 1) {
      setIndex(index + 1);
    } else {
      onFinish();
    }
  };

  return (
    <div style={styles.container} onClick={advance}>
      <img src={slide.image} alt="" style={styles.image} />
      <div style={styles.vignette} />
      <div style={styles.captionBox(theme)}>
        <p style={styles.captionText}>{slide.caption}</p>
        <div style={styles.hint(theme)}>
          {index < SLIDES.length - 1 ? "点击继续 ▸" : "点击进入曲措乡"}
        </div>
      </div>
      <div style={styles.dots}>
        {SLIDES.map((_, i) => (
          <span key={i} style={styles.dot(theme, i === index)} />
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: "fixed",
    inset: 0,
    backgroundColor: "#000",
    cursor: "pointer",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  vignette: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, transparent 40%, rgba(0,0,0,0.75) 100%)",
    pointerEvents: "none",
  },
  captionBox: (t) => ({
    position: "absolute",
    bottom: "48px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "min(560px, 86vw)",
    textAlign: "center",
  }),
  captionText: {
    fontFamily: "'Noto Serif SC', 'Songti SC', serif",
    fontSize: "16px",
    lineHeight: 1.9,
    color: "#ece3d0",
    textShadow: "0 2px 8px rgba(0,0,0,0.8)",
    marginBottom: "14px",
  },
  hint: (t) => ({
    fontSize: "11px",
    letterSpacing: "3px",
    color: t.accent,
    opacity: 0.85,
  }),
  dots: {
    position: "absolute",
    top: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: "6px",
  },
  dot: (t, active) => ({
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: active ? t.accent : "rgba(255,255,255,0.3)",
    transition: "background-color 0.3s ease",
  }),
};
